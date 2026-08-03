from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.redis import get_redis
from app.auth.dependencies import require_role, require_admin, client_ip
from app.auth.audit import record_audit
from app.auth.models import StaffUser
from app.orders.schemas import (
    CartItemAdd, CartItemUpdate, CartResponse, VoucherApplyRequest, OrderCreateRequest,
    OrderResponse, OrderStatusUpdateRequest, OrderTrackRequest, OrderTrackResponse
)
from app.orders.tracking import track_order, enforce_lookup_rate_limit
from app.orders.cart_service import (
    create_cart, add_item_to_cart, remove_item_from_cart, compute_cart_details,
    update_item_quantity, get_cart_id_for_item
)
from app.orders.order_service import (
    place_order, get_order_with_phone_check, list_orders_admin, update_order_status_admin,
    delete_order_admin, list_customers_admin, get_customer_orders
)

router = APIRouter()

# Cart Routes
@router.post("/cart", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
async def api_create_cart(db: AsyncSession = Depends(get_db)):
    cart = await create_cart(db)
    return await compute_cart_details(db, cart.id)

@router.post("/cart/items", response_model=CartResponse)
async def api_add_to_cart(
    cart_id: str,
    payload: CartItemAdd,
    city: str = "Casablanca",
    voucher_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    await add_item_to_cart(
        db,
        cart_id=cart_id,
        variant_id=payload.variant_id,
        quantity=payload.quantity,
        config_text=payload.config_text
    )
    return await compute_cart_details(db, cart_id=cart_id, city=city, voucher_code=voucher_code)

@router.get("/cart/{cart_id}", response_model=CartResponse)
async def api_get_cart(
    cart_id: str,
    city: str = "Casablanca",
    voucher_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    return await compute_cart_details(db, cart_id=cart_id, city=city, voucher_code=voucher_code)

@router.patch("/cart/items/{item_id}", response_model=CartResponse)
async def api_update_cart_item(
    item_id: str,
    payload: CartItemUpdate,
    city: str = "Casablanca",
    voucher_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    cart_id = await get_cart_id_for_item(db, item_id)
    await update_item_quantity(db, item_id=item_id, quantity=payload.quantity)
    return await compute_cart_details(db, cart_id=cart_id, city=city, voucher_code=voucher_code)

@router.delete("/cart/items/{item_id}", response_model=CartResponse)
async def api_remove_cart_item(
    item_id: str,
    city: str = "Casablanca",
    voucher_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    cart_id = await get_cart_id_for_item(db, item_id)
    await remove_item_from_cart(db, item_id)
    return await compute_cart_details(db, cart_id=cart_id, city=city, voucher_code=voucher_code)

# Order Routes
@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def api_place_order(
    payload: OrderCreateRequest,
    idempotency_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    # Idempotency check (Architecture Law A-C5)
    if idempotency_key:
        cache_key = f"idempotency:{idempotency_key}"
        cached_order_id = await redis_client.get(cache_key)
        if cached_order_id:
            from app.orders.order_service import get_order_by_id
            existing = await get_order_by_id(db, cached_order_id)
            if existing:
                return existing

    order = await place_order(
        db,
        cart_id=payload.cart_id,
        name=payload.name,
        phone=payload.phone,
        city=payload.city,
        address_line=payload.address_line,
        payment_method=payload.payment_method,
        voucher_code=payload.voucher_code
    )

    if idempotency_key:
        cache_key = f"idempotency:{idempotency_key}"
        await redis_client.set(cache_key, order.id, ex=86400) # 24h TTL

    return order

@router.get("/orders/{order_id}", response_model=OrderResponse)
async def api_get_order(
    order_id: str,
    phone: str = Query(..., description="Phone number for verification ownership check"),
    db: AsyncSession = Depends(get_db)
):
    return await get_order_with_phone_check(db, order_id=order_id, phone=phone)

# Public order tracking
@router.post("/orders/track", response_model=OrderTrackResponse)
async def api_track_order(
    payload: OrderTrackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    """Customer facing tracking. Requires the order number AND the phone
    number used at checkout, and is rate limited per address."""
    await enforce_lookup_rate_limit(client_ip(request), redis_client)
    return await track_order(db, order_number=payload.order_number, phone=payload.phone)


# Admin Order Management Routes
@router.get("/admin/orders")
async def api_admin_list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    status: Optional[str] = None,
    search: Optional[str] = Query(None, description="Order number, customer name or phone"),
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor"))
):
    items, total = await list_orders_admin(
        db, page=page, limit=limit, status_filter=status, search=search
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/admin/customers")
async def api_admin_list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor"))
):
    """Customers aggregated from the orders table, with the counters staff
    need to tell a genuine buyer from a serial refuser."""
    items, total = await list_customers_admin(db, page=page, limit=limit, search=search)
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/admin/customers/{phone}/orders")
async def api_admin_customer_orders(
    phone: str,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor"))
):
    orders = await get_customer_orders(db, phone)
    return {"items": orders, "total": len(orders)}


@router.delete("/admin/orders/{order_id}", status_code=status.HTTP_200_OK)
async def api_admin_delete_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    """Deleting an order returns its units to stock, unless it was already
    delivered. Restricted to admins because it is not reversible."""
    from app.orders.order_service import get_order_by_id
    existing = await get_order_by_id(db, order_id)
    before = {
        "order_number": existing.order_number,
        "status": existing.status,
        "total_cents": existing.total_cents,
    } if existing else None

    result = await delete_order_admin(db, order_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_ORDER", target_table="orders",
        record_id=order_id, before_value=before, after_value=result
    )
    return result

@router.get("/admin/orders/{order_id}", response_model=OrderResponse)
async def api_admin_get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor"))
):
    from app.orders.order_service import get_order_by_id
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order

@router.put("/admin/orders/{order_id}/status", response_model=OrderResponse)
async def api_admin_update_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor"))
):
    allowed = {"pending", "confirmed", "dispatched", "delivered", "cancelled", "returned"}
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown status '{payload.status}'"
        )

    from app.orders.order_service import get_order_by_id
    existing = await get_order_by_id(db, order_id)
    before = {"status": existing.status} if existing else None

    order = await update_order_status_admin(
        db, order_id=order_id, new_status=payload.status, notes=payload.notes
    )
    await record_audit(
        db, staff_id=staff.id, action="UPDATE_ORDER_STATUS", target_table="orders",
        record_id=order_id, before_value=before, after_value={"status": order.status}
    )
    return order


@router.get("/admin/orders/{order_id}/pdf")
async def api_admin_order_pdf(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    """Branded one page confirmation, ready to send to the customer.

    Generated server side so the output is identical whoever produces it, and
    so it can later be attached to an email without a headless browser.
    """
    from app.orders.order_service import get_order_by_id
    from app.orders.order_pdf import build_order_pdf

    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande introuvable")

    pdf = build_order_pdf(order, list(order.items))
    filename = f"LUCEA-{order.order_number}.pdf"

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
