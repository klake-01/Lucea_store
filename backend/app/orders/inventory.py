"""Inventory movements.

One place decides what happens to stock, because inventory arithmetic scattered
across handlers is how a shop ends up overselling.

The model has two counters per variant:

    stock      physical units on hand
    reserved   units promised to open orders
    available  = stock - reserved, what the storefront may sell

and an order carries `stock_state` recording where its units currently sit, so
setting the same status twice can never double commit or double release.

    place order              reserved += qty                 state: reserved
    delivered, cash taken    stock -= qty, reserved -= qty    state: committed
    cancelled or returned    reserved -= qty                  state: released

Why not decrement `stock` at placement, as the first implementation did? Because
`stock` then means two different things at once, on hand and sold, and a
cancelled cash on delivery order silently loses the units. Under cash on
delivery a refused parcel is common, so that distinction is not academic.
"""

import logging
from typing import Iterable, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.catalog.models import StockMovement, Variant

logger = logging.getLogger(__name__)

# Terminal states, and what each one means for the units held by the order
COMMIT_STATUSES = {"delivered"}
RELEASE_STATUSES = {"cancelled", "returned"}


def available_units(variant: Variant) -> int:
    """What may still be sold. Never negative, even if data drifted."""
    return max(0, (variant.stock or 0) - (variant.reserved or 0))


async def _variants_for(db: AsyncSession, items: Iterable) -> dict:
    ids = {item.variant_id for item in items}
    if not ids:
        return {}
    res = await db.execute(select(Variant).where(Variant.id.in_(ids)))
    return {v.id: v for v in res.scalars().all()}


async def reserve_for_order(db: AsyncSession, order, items: Iterable) -> None:
    """Holds units against an order without reducing what is on hand."""
    variants = await _variants_for(db, items)
    for item in items:
        variant = variants.get(item.variant_id)
        if not variant:
            continue
        variant.reserved = (variant.reserved or 0) + item.quantity
        db.add(StockMovement(
            variant_id=variant.id, delta=0, reason=f"reserved:{order.order_number}"
        ))
    order.stock_state = "reserved"


async def commit_for_order(db: AsyncSession, order, items: Iterable) -> list:
    """The goods left the workshop and the cash was taken.

    Physical stock drops now, and the reservation is consumed with it.
    """
    if order.stock_state == "committed":
        return []  # already settled, nothing to do

    variants = await _variants_for(db, items)
    changes = []
    for item in items:
        variant = variants.get(item.variant_id)
        if not variant:
            continue

        qty = item.quantity
        variant.stock = max(0, (variant.stock or 0) - qty)
        # Only release what this order was actually holding
        if order.stock_state == "reserved":
            variant.reserved = max(0, (variant.reserved or 0) - qty)

        db.add(StockMovement(
            variant_id=variant.id, delta=-qty, reason=f"sold:{order.order_number}"
        ))
        changes.append({"sku": variant.sku, "quantity": -qty, "stock": variant.stock})

    order.stock_state = "committed"
    return changes


async def release_for_order(db: AsyncSession, order, items: Iterable) -> list:
    """The order will not complete. Units go back on the shelf.

    A delivered order that is later returned has already had its stock
    committed, so the units are added back rather than un reserved.
    """
    if order.stock_state == "released":
        return []

    variants = await _variants_for(db, items)
    was_committed = order.stock_state == "committed"
    changes = []

    for item in items:
        variant = variants.get(item.variant_id)
        if not variant:
            continue

        qty = item.quantity
        if was_committed:
            # Goods came back through the door
            variant.stock = (variant.stock or 0) + qty
            db.add(StockMovement(
                variant_id=variant.id, delta=qty, reason=f"returned:{order.order_number}"
            ))
            changes.append({"sku": variant.sku, "quantity": qty, "stock": variant.stock})
        else:
            variant.reserved = max(0, (variant.reserved or 0) - qty)
            db.add(StockMovement(
                variant_id=variant.id, delta=0, reason=f"released:{order.order_number}"
            ))
            changes.append({"sku": variant.sku, "quantity": 0, "stock": variant.stock})

    order.stock_state = "released"
    return changes


async def apply_status_change(db: AsyncSession, order, items: Iterable,
                              new_status: str) -> list:
    """Moves inventory to match a new order status.

    Returns the list of changes so the caller can report them and write an
    audit entry. Statuses that do not settle an order leave stock untouched.
    """
    if new_status in COMMIT_STATUSES:
        return await commit_for_order(db, order, items)

    if new_status in RELEASE_STATUSES:
        return await release_for_order(db, order, items)

    # Moving back to an open status from a settled one re-reserves the units,
    # which happens when staff correct a mistaken cancellation.
    if order.stock_state in ("released", "committed") and new_status in (
        "pending", "confirmed", "dispatched"
    ):
        variants = await _variants_for(db, items)
        changes = []
        for item in items:
            variant = variants.get(item.variant_id)
            if not variant:
                continue
            if order.stock_state == "committed":
                # Undo the sale, then hold the units again
                variant.stock = (variant.stock or 0) + item.quantity
            variant.reserved = (variant.reserved or 0) + item.quantity
            db.add(StockMovement(
                variant_id=variant.id, delta=0, reason=f"re-reserved:{order.order_number}"
            ))
            changes.append({"sku": variant.sku, "quantity": 0, "stock": variant.stock})
        order.stock_state = "reserved"
        return changes

    return []
