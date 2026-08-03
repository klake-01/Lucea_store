"""Public order tracking.

The customer has no account, so the only proof of ownership available is the
pair (order number, phone number used at checkout). Both must match, the
response is deliberately narrower than the admin view, and lookups are rate
limited so the endpoint cannot be walked to enumerate orders.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.orders.models import Order
from app.orders.schemas import (
    OrderTrackResponse, OrderTrackItem, OrderTrackStep
)

# The happy path, in order. cancelled and returned are terminal side states.
TIMELINE = [
    ("pending", "Commande recue"),
    ("confirmed", "Confirmee par telephone"),
    ("dispatched", "Remise au livreur"),
    ("delivered", "Livree et payee"),
]

STATUS_LABELS = {
    "pending": "En attente de confirmation",
    "confirmed": "Confirmee",
    "dispatched": "En cours de livraison",
    "delivered": "Livree",
    "cancelled": "Annulee",
    "returned": "Retournee",
}

DELIVERY_ESTIMATE = {
    "casablanca": "24 heures apres la fin de fabrication",
    "bouskoura": "24 heures apres la fin de fabrication",
    "rabat": "24 a 48 heures apres la fin de fabrication",
    "sale": "24 a 48 heures apres la fin de fabrication",
    "marrakech": "24 a 48 heures apres la fin de fabrication",
}
DEFAULT_ESTIMATE = "48 a 72 heures apres la fin de fabrication"

MAX_LOOKUPS_PER_WINDOW = 10
LOOKUP_WINDOW_SECONDS = 600  # 10 minutes


def normalise_phone(value: str) -> str:
    """Compares digits only, and treats the Moroccan 0 and +212 forms as equal."""
    digits = "".join(filter(str.isdigit, value or ""))
    if digits.startswith("212"):
        digits = digits[3:]
    return digits.lstrip("0")


async def enforce_lookup_rate_limit(ip: str, redis_client) -> None:
    key = f"track_lookup:{ip}"
    attempts = await redis_client.incr(key)
    if attempts == 1:
        await redis_client.expire(key, LOOKUP_WINDOW_SECONDS)
    if attempts > MAX_LOOKUPS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de recherches. Reessayez dans quelques minutes ou ecrivez nous sur WhatsApp.",
        )


def build_timeline(order: Order) -> list[OrderTrackStep]:
    history = {h.status: h.created_at for h in (order.status_history or [])}

    if order.status in ("cancelled", "returned"):
        # A stopped order shows what actually happened, not a fake progression
        steps = [
            OrderTrackStep(
                status="pending", label="Commande recue", reached=True,
                created_at=history.get("pending") or order.created_at,
            ),
            OrderTrackStep(
                status=order.status,
                label=STATUS_LABELS.get(order.status, order.status),
                reached=True,
                created_at=history.get(order.status),
            ),
        ]
        return steps

    current_index = next(
        (i for i, (key, _) in enumerate(TIMELINE) if key == order.status), 0
    )
    return [
        OrderTrackStep(
            status=key,
            label=label,
            reached=index <= current_index,
            created_at=history.get(key),
        )
        for index, (key, label) in enumerate(TIMELINE)
    ]


async def track_order(
    db: AsyncSession,
    order_number: str,
    phone: str,
) -> OrderTrackResponse:
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.status_history))
        .where(Order.order_number == order_number.strip().upper())
    )
    order = (await db.execute(stmt)).scalars().first()

    supplied = normalise_phone(phone)
    stored = normalise_phone(order.phone) if order else ""

    # One identical message whether the number is unknown or the phone does not
    # match, so the endpoint cannot be used to confirm that an order exists.
    matches = bool(order) and bool(supplied) and secrets.compare_digest(supplied, stored)
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune commande ne correspond a ce numero et a ce telephone.",
        )

    items = [
        OrderTrackItem(
            product_name=item.snapshotted_product_name,
            quantity=item.quantity,
            config_text=item.config_text,
            line_total_cents=item.snapshotted_price_cents * item.quantity,
        )
        for item in order.items
    ]

    estimate: Optional[str] = None
    if order.status in ("pending", "confirmed", "dispatched"):
        estimate = DELIVERY_ESTIMATE.get(order.city.strip().lower(), DEFAULT_ESTIMATE)

    return OrderTrackResponse(
        order_number=order.order_number,
        status=order.status,
        status_label=STATUS_LABELS.get(order.status, order.status),
        placed_at=order.created_at,
        city=order.city,
        # First name only: enough for the customer to recognise their own order
        # without echoing a full identity back to whoever ran the lookup.
        recipient_first_name=(order.name or "").strip().split(" ")[0],
        payment_method=order.payment_method,
        items=items,
        subtotal_cents=order.subtotal_cents,
        delivery_charge_cents=order.delivery_charge_cents,
        discount_cents=order.discount_cents,
        total_cents=order.total_cents,
        timeline=build_timeline(order),
        estimated_delivery=estimate,
    )
