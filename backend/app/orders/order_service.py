import uuid
import random
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, case
from fastapi import HTTPException, status

from app.orders.models import Order, OrderItem, OrderStatusHistory, Cart, CartItem
from app.catalog.models import Variant, Product, StockMovement
from app.orders.inventory import apply_status_change, available_units, release_for_order
from app.customers.models import Customer, Address
from app.commerce.models import Voucher
from app.orders.cart_service import compute_cart_details, get_cart

COD_MAX_CENTS = 500000 # 5,000 DHS limit for COD (BR-1)
MAX_PENDING_ORDERS_PER_PHONE = 3 # Anti-spam defense (Threat Model §5)

def generate_order_number() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    rnd = random.randint(1000, 9999)
    return f"LUC-{timestamp}-{rnd}"

async def place_order(
    db: AsyncSession,
    cart_id: str,
    name: str,
    phone: str,
    city: str,
    address_line: str,
    payment_method: str = "COD",
    voucher_code: Optional[str] = None
) -> Order:
    # 1. Anti-abuse check: Max pending orders per phone
    pending_count_res = await db.execute(
        select(func.count(Order.id)).where(
            Order.phone == phone.strip(), Order.status == "pending"
        )
    )
    pending_count = pending_count_res.scalar() or 0
    if pending_count >= MAX_PENDING_ORDERS_PER_PHONE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order limit reached. You have {pending_count} pending orders awaiting confirmation."
        )

    # 2. Fetch cart details with server-side totals. The voucher is revalidated
    #    here against the database, so a tampered client total cannot stick.
    cart_details = await compute_cart_details(
        db, cart_id=cart_id, city=city, voucher_code=voucher_code
    )
    if not cart_details["items"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    total_cents = cart_details["total_cents"]

    # 3. Check COD max amount limit (BR-1)
    if payment_method.upper() == "COD" and total_cents > COD_MAX_CENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cash on Delivery is only available for orders up to 5,000 MAD (BR-1)"
        )

    # 4. Transactionally check & decrement variant stock with SELECT FOR UPDATE
    order_items_to_create = []
    for item in cart_details["items"]:
        var_id = item["variant_id"]
        qty = item["quantity"]

        # Lock variant row for update (if DB supports row-level locking)
        stmt = select(Variant).options(selectinload(Variant.product)).where(Variant.id == var_id)
        if db.bind and db.bind.dialect.name != "sqlite":
            stmt = stmt.with_for_update()
        var_res = await db.execute(stmt)
        variant = var_res.scalars().first()

        if not variant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant {var_id} not found")

        if available_units(variant) < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{variant.product.name}'. Only {variant.stock} left."
            )

        # Reserve rather than decrement. Physical stock only moves when the
        # goods actually leave, which under cash on delivery is at delivery.
        # See app/orders/inventory.py for the full model.
        variant.reserved = (variant.reserved or 0) + qty
        db.add(StockMovement(variant_id=variant.id, delta=0, reason="reserved"))

        order_items_to_create.append({
            "variant_id": variant.id,
            "snapshotted_product_name": variant.product.name if variant.product else "Lamp",
            "snapshotted_sku": variant.sku,
            "snapshotted_price_cents": item["unit_price_cents"],
            "quantity": qty,
            "config_text": item["config_text"]
        })

    # 5. Create Order ledger
    order_number = generate_order_number()
    order = Order(
        order_number=order_number,
        phone=phone.strip(),
        name=name.strip(),
        city=city.strip(),
        address_line=address_line.strip(),
        subtotal_cents=cart_details["subtotal_cents"],
        delivery_charge_cents=cart_details["delivery_charge_cents"],
        discount_cents=cart_details["discount_cents"],
        total_cents=total_cents,
        status="pending",
        payment_method=payment_method.upper()
    )
    db.add(order)
    await db.flush() # Populate order.id

    # 6. Create OrderItems
    for oi_data in order_items_to_create:
        oi = OrderItem(order_id=order.id, **oi_data)
        db.add(oi)

    # 6b. Burn one voucher use, but only if the discount actually applied
    if cart_details.get("voucher_code") and cart_details["discount_cents"] > 0:
        v_res = await db.execute(
            select(Voucher).where(Voucher.code == cart_details["voucher_code"])
        )
        voucher = v_res.scalars().first()
        if voucher:
            voucher.usage_count += 1

    # 7. Create initial append-only status history
    history = OrderStatusHistory(
        order_id=order.id,
        status="pending",
        notes="Order placed via checkout"
    )
    db.add(history)

    # 8. Clear Cart items
    cart_res = await db.execute(
        select(Cart).options(selectinload(Cart.items)).where(Cart.id == cart_id)
    )
    cart = cart_res.scalars().first()
    if cart:
        await db.execute(select(CartItem).where(CartItem.cart_id == cart_id))
        for ci in cart.items:
            await db.delete(ci)

    await db.commit()
    return await get_order_by_id(db, order.id)

async def get_order_by_id(db: AsyncSession, order_id: str) -> Optional[Order]:
    stmt = select(Order).options(
        selectinload(Order.items),
        selectinload(Order.status_history)
    ).where(Order.id == order_id)
    res = await db.execute(stmt)
    return res.scalars().first()

async def get_order_with_phone_check(db: AsyncSession, order_id: str, phone: str) -> Order:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Handle unencoded '+' converted to space in query params
    clean_req_phone = phone.strip().replace(" ", "+") if not phone.startswith("+") else phone.strip()
    clean_target_phone = order.phone.strip()

    # Compare stripped digits
    req_digits = "".join(filter(str.isdigit, clean_req_phone))
    target_digits = "".join(filter(str.isdigit, clean_target_phone))

    if req_digits != target_digits:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: phone number mismatch")
    return order

async def list_orders_admin(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    search: Optional[str] = None
) -> Tuple[List[Order], int]:
    """Admin listing. `search` matches an order number, a customer name or a
    phone number, so staff can find an order from whatever the caller says."""
    limit = min(max(1, limit), 60)
    offset = (page - 1) * limit

    filters = []
    if status_filter:
        filters.append(Order.status == status_filter)

    if search and search.strip():
        term = search.strip()
        pattern = f"%{term}%"
        # Phone numbers get typed with spaces and dashes, so the digits are
        # compared on their own as well as the raw string.
        digits = "".join(filter(str.isdigit, term))
        conditions = [
            Order.order_number.ilike(pattern),
            Order.name.ilike(pattern),
            Order.phone.ilike(pattern),
        ]
        if digits:
            conditions.append(Order.phone.ilike(f"%{digits}%"))
        filters.append(or_(*conditions))

    query = select(Order).options(selectinload(Order.items), selectinload(Order.status_history))
    count_q = select(func.count(Order.id))
    for condition in filters:
        query = query.where(condition)
        count_q = count_q.where(condition)

    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    orders = (await db.execute(query)).scalars().all()

    return list(orders), total


async def delete_order_admin(db: AsyncSession, order_id: str) -> dict:
    """Removes an order and returns the stock that was put back.

    Cancelling by deletion would otherwise leak inventory: the units were
    decremented when the order was placed, so they are restored here unless the
    order was already delivered, where the goods really did leave the workshop.
    """
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande introuvable")

    # One release path for cancel, return and delete, so stock cannot drift
    # between them.
    restored = await release_for_order(db, order, order.items)

    # Order items reference the order with ondelete RESTRICT, so they go first
    for item in list(order.items):
        await db.delete(item)
    await db.flush()
    await db.delete(order)
    await db.commit()

    return {"order_number": order.order_number, "stock_restored": restored}


async def list_customers_admin(
    db: AsyncSession,
    page: int = 1,
    limit: int = 25,
    search: Optional[str] = None,
) -> Tuple[List[dict], int]:
    """Customers are derived from the orders table.

    Checkout is guest only, so the phone number is the identity. Each row
    carries the counters staff need to tell a real buyer from a spammer:
    how many orders were placed, how many were actually delivered, and how
    many were cancelled or left pending.
    """
    grouped = (
        select(
            Order.phone.label("phone"),
            func.max(Order.name).label("name"),
            func.max(Order.city).label("city"),
            func.count(Order.id).label("orders_count"),
            func.sum(Order.total_cents).label("total_spent_cents"),
            func.sum(case((Order.status == "delivered", 1), else_=0)).label("delivered_count"),
            func.sum(case((Order.status == "cancelled", 1), else_=0)).label("cancelled_count"),
            func.sum(case((Order.status == "returned", 1), else_=0)).label("returned_count"),
            func.sum(case((Order.status == "pending", 1), else_=0)).label("pending_count"),
            func.max(Order.created_at).label("last_order_at"),
            func.min(Order.created_at).label("first_order_at"),
        )
        .group_by(Order.phone)
    )

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        grouped = grouped.having(
            or_(func.max(Order.name).ilike(pattern), Order.phone.ilike(pattern))
        )

    subquery = grouped.subquery()
    total = (await db.execute(select(func.count()).select_from(subquery))).scalar() or 0

    rows = (
        await db.execute(
            select(subquery)
            .order_by(subquery.c.last_order_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()

    customers = []
    for r in rows:
        orders_count = r.orders_count or 0
        delivered = r.delivered_count or 0
        cancelled = (r.cancelled_count or 0) + (r.returned_count or 0)
        pending = r.pending_count or 0

        customers.append({
            "phone": r.phone,
            "name": r.name,
            "city": r.city,
            "orders_count": orders_count,
            "delivered_count": delivered,
            "cancelled_count": cancelled,
            "pending_count": pending,
            "total_spent_cents": int(r.total_spent_cents or 0),
            "delivered_value_cents": 0,  # filled below per customer if needed
            "first_order_at": r.first_order_at,
            "last_order_at": r.last_order_at,
            "risk": _risk_assessment(orders_count, delivered, cancelled, pending),
        })

    return customers, total


def _risk_assessment(orders_count: int, delivered: int, cancelled: int, pending: int) -> dict:
    """A blunt but explainable signal, never an automatic block.

    Cash on delivery means a refused parcel costs the workshop a real round
    trip, so repeat refusers matter. Staff still make the call.
    """
    reasons = []
    level = "ok"

    settled = delivered + cancelled
    refusal_rate = (cancelled / settled) if settled else 0.0

    if orders_count >= 3 and refusal_rate >= 0.5:
        level = "high"
        reasons.append(f"{cancelled} commandes refusees sur {settled} livrees ou refusees")
    elif orders_count >= 2 and refusal_rate >= 0.34:
        level = "watch"
        reasons.append(f"taux de refus de {refusal_rate:.0%}")

    if pending >= 3:
        level = "high" if level != "high" else level
        reasons.append(f"{pending} commandes en attente jamais confirmees")

    if orders_count >= 2 and delivered == 0 and cancelled == 0 and pending == orders_count:
        level = "high"
        reasons = [f"{orders_count} commandes toutes en attente, aucune confirmee"]

    if level == "ok" and delivered >= 2:
        reasons.append(f"{delivered} livraisons reussies")

    return {"level": level, "reasons": reasons}


async def get_customer_orders(db: AsyncSession, phone: str) -> List[Order]:
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.status_history))
        .where(Order.phone == phone)
        .order_by(Order.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())

async def update_order_status_admin(
    db: AsyncSession,
    order_id: str,
    new_status: str,
    notes: Optional[str] = None
) -> Order:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    previous = order.status
    order.status = new_status

    # Inventory follows the status. Delivered commits the sale, cancelled and
    # returned put the units back. Doing this here rather than in the router
    # means every caller gets the same behaviour.
    stock_changes = await apply_status_change(db, order, order.items, new_status)

    note = notes or f"Statut passe de {previous} a {new_status}"
    if stock_changes:
        summary = ", ".join(
            f"{c['sku']} {'+' if c['quantity'] > 0 else ''}{c['quantity']}"
            for c in stock_changes if c['quantity']
        )
        if summary:
            note = f"{note}. Stock: {summary}"

    db.add(OrderStatusHistory(order_id=order.id, status=new_status, notes=note))
    await db.commit()
    return await get_order_by_id(db, order.id)
