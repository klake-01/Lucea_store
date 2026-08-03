import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.orders.models import Cart, CartItem
from app.catalog.models import Variant, Product
from app.commerce.models import Voucher
from app.commerce.service import compute_discount, get_voucher_by_code
from app.orders.shipping import calculate_shipping_charge
from app.orders.inventory import available_units

async def create_cart(db: AsyncSession, session_id: Optional[str] = None) -> Cart:
    cart = Cart(session_id=session_id)
    db.add(cart)
    await db.commit()
    await db.refresh(cart)
    return cart

async def get_cart(db: AsyncSession, cart_id: str) -> Optional[Cart]:
    result = await db.execute(
        select(Cart).options(
            selectinload(Cart.items).selectinload(CartItem.cart)
        ).where(Cart.id == cart_id)
    )
    return result.scalars().first()

async def get_cart_id_for_item(db: AsyncSession, item_id: str) -> str:
    res = await db.execute(select(CartItem.cart_id).where(CartItem.id == item_id))
    cart_id = res.scalar()
    if not cart_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    return cart_id

async def add_item_to_cart(
    db: AsyncSession,
    cart_id: str,
    variant_id: str,
    quantity: int = 1,
    config_text: Optional[str] = None
) -> CartItem:
    cart = await get_cart(db, cart_id)
    if not cart:
        cart = await create_cart(db)
        cart_id = cart.id

    # Check stock (BR-4)
    var_res = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = var_res.scalars().first()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    # Availability, not raw stock: units already promised to open orders are
    # not sellable again.
    if available_units(variant) < quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantite demandee ({quantity}) superieure au stock disponible ({available_units(variant)})"
        )

    # Check if item already in cart
    existing_item_res = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart_id, CartItem.variant_id == variant_id)
    )
    existing_item = existing_item_res.scalars().first()

    if existing_item:
        new_qty = existing_item.quantity + quantity
        if available_units(variant) < new_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantite totale ({new_qty}) superieure au stock disponible ({available_units(variant)})"
            )
        existing_item.quantity = new_qty
        if config_text is not None:
            existing_item.config_text = config_text
        await db.commit()
        return existing_item

    item = CartItem(
        cart_id=cart_id,
        variant_id=variant_id,
        quantity=quantity,
        config_text=config_text
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

async def update_item_quantity(db: AsyncSession, item_id: str, quantity: int) -> Optional[CartItem]:
    """Sets an absolute quantity on a cart line. Quantity 0 removes the line."""
    res = await db.execute(select(CartItem).where(CartItem.id == item_id))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")

    if quantity <= 0:
        await db.delete(item)
        await db.commit()
        return None

    var_res = await db.execute(select(Variant).where(Variant.id == item.variant_id))
    variant = var_res.scalars().first()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if available_units(variant) < quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuffisant. Il reste {variant.stock} pieces disponibles."
        )

    item.quantity = quantity
    await db.commit()
    await db.refresh(item)
    return item

async def remove_item_from_cart(db: AsyncSession, item_id: str):
    res = await db.execute(select(CartItem).where(CartItem.id == item_id))
    item = res.scalars().first()
    if item:
        await db.delete(item)
        await db.commit()

async def compute_cart_details(
    db: AsyncSession,
    cart_id: str,
    city: str = "Casablanca",
    voucher_code: Optional[str] = None
) -> Dict[str, Any]:
    cart = await get_cart(db, cart_id)
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")

    items_data = []
    subtotal_cents = 0

    for item in cart.items:
        # Load variant & product info with images
        var_res = await db.execute(
            select(Variant).options(
                selectinload(Variant.product).selectinload(Product.images)
            ).where(Variant.id == item.variant_id)
        )
        variant = var_res.scalars().first()
        if not variant:
            continue

        unit_price = variant.price_cents
        item_total = unit_price * item.quantity
        subtotal_cents += item_total

        product_image = None
        if variant.product and variant.product.images:
            product_image = variant.product.images[0].url

        items_data.append({
            "id": item.id,
            "variant_id": item.variant_id,
            "quantity": item.quantity,
            "config_text": item.config_text,
            "unit_price_cents": unit_price,
            "item_total_cents": item_total,
            "variant_sku": variant.sku,
            "product_name": variant.product.name if variant.product else "Lamp",
            "product_image": product_image
        })

    # Shipping is computed first so a free_shipping voucher has something to zero
    post_discount_subtotal = subtotal_cents
    delivery_charge_cents, _ = await calculate_shipping_charge(db, city, post_discount_subtotal)

    # Voucher. All the arithmetic lives in commerce.service so the cart, the
    # order and the admin preview can never disagree.
    discount_cents = 0
    applied_voucher_code = None
    voucher_error = None

    if voucher_code:
        voucher = await get_voucher_by_code(db, voucher_code)
        if not voucher:
            voucher_error = "Ce code n existe pas."
        else:
            discount_cents, delivery_charge_cents, voucher_error = compute_discount(
                voucher,
                subtotal_cents=subtotal_cents,
                delivery_cents=delivery_charge_cents,
            )
            if voucher_error is None:
                applied_voucher_code = voucher.code

        # Recompute shipping against the discounted subtotal, since the free
        # delivery threshold applies after the discount (BR-2).
        if applied_voucher_code and discount_cents:
            post_discount_subtotal = max(0, subtotal_cents - discount_cents)
            recomputed, _ = await calculate_shipping_charge(db, city, post_discount_subtotal)
            delivery_charge_cents = recomputed

    total_cents = max(0, subtotal_cents - discount_cents) + delivery_charge_cents

    return {
        "id": cart.id,
        "session_id": cart.session_id,
        "items": items_data,
        "subtotal_cents": subtotal_cents,
        "delivery_charge_cents": delivery_charge_cents,
        "discount_cents": discount_cents,
        "total_cents": total_cents,
        "voucher_code": applied_voucher_code,
        "voucher_error": voucher_error,
    }
