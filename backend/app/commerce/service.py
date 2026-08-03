"""Voucher rules.

All discount arithmetic lives here so the cart preview, the order placement
path and the admin preview can never disagree about what a code is worth.
"""

import random
import string
from datetime import datetime
from typing import Optional, Tuple, List

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.commerce.models import Voucher
from app.commerce.schemas import VoucherCreate, VoucherUpdate

DISCOUNT_TYPES = {"fixed_cents", "percentage", "free_shipping"}
MAX_PERCENTAGE = 90

# Ambiguous glyphs are excluded: a customer reading a code off a screen should
# never have to decide between O and 0 or I and 1.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_code(prefix: str = "", length: int = 8) -> str:
    """Builds a human readable code such as SOLDES-7K4PQ2XM."""
    body = "".join(random.choices(CODE_ALPHABET, k=length))
    clean_prefix = "".join(c for c in prefix.upper() if c.isalnum())
    return f"{clean_prefix}-{body}" if clean_prefix else body


def validate_voucher_payload(discount_type: str, value: int, max_discount_cents: Optional[int]) -> None:
    if discount_type not in DISCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de remise inconnu. Valeurs acceptees: {', '.join(sorted(DISCOUNT_TYPES))}.",
        )

    if discount_type == "percentage":
        if not 1 <= value <= MAX_PERCENTAGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Un pourcentage doit etre compris entre 1 et {MAX_PERCENTAGE}.",
            )
    elif discount_type == "fixed_cents":
        if value <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le montant de la remise doit etre superieur a zero.",
            )

    if max_discount_cents is not None and max_discount_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le plafond de remise doit etre superieur a zero.",
        )


def compute_discount(
    voucher: Voucher,
    subtotal_cents: int,
    delivery_cents: int,
    now: Optional[datetime] = None,
) -> Tuple[int, int, Optional[str]]:
    """Returns (discount_cents, delivery_cents, rejection_reason).

    A rejection reason means the code was recognised but does not apply, which
    the storefront shows to the customer verbatim.
    """
    now = now or datetime.utcnow()

    if not voucher.active_status:
        return 0, delivery_cents, "Ce code n est plus actif."
    if voucher.valid_from and now < voucher.valid_from:
        return 0, delivery_cents, "Ce code n est pas encore valable."
    if voucher.valid_until and now > voucher.valid_until:
        return 0, delivery_cents, "Ce code a expire."
    if voucher.usage_count >= voucher.usage_limit:
        return 0, delivery_cents, "Ce code a atteint sa limite d utilisation."
    if subtotal_cents < (voucher.min_order_cents or 0):
        missing = (voucher.min_order_cents - subtotal_cents) / 100
        return 0, delivery_cents, f"Ce code demande un minimum de commande. Il manque {missing:.0f} MAD."

    if voucher.discount_type == "free_shipping":
        return 0, 0, None

    if voucher.discount_type == "percentage":
        discount = (subtotal_cents * voucher.value) // 100
    else:  # fixed_cents
        discount = voucher.value

    if voucher.max_discount_cents:
        discount = min(discount, voucher.max_discount_cents)

    # Never let a discount exceed the goods, otherwise the order total goes
    # negative and the courier is asked to hand money back.
    discount = max(0, min(discount, subtotal_cents))

    if discount == 0:
        return 0, delivery_cents, "Ce code ne s applique pas a ce panier."

    return discount, delivery_cents, None


async def get_voucher_by_code(db: AsyncSession, code: str) -> Optional[Voucher]:
    res = await db.execute(select(Voucher).where(Voucher.code == code.strip().upper()))
    return res.scalars().first()


async def get_voucher_by_id(db: AsyncSession, voucher_id: str) -> Optional[Voucher]:
    res = await db.execute(select(Voucher).where(Voucher.id == voucher_id))
    return res.scalars().first()


async def list_vouchers(
    db: AsyncSession,
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
) -> Tuple[List[Voucher], int]:
    query = select(Voucher)
    count_q = select(func.count(Voucher.id))

    if search:
        pattern = f"%{search.strip()}%"
        condition = or_(Voucher.code.ilike(pattern), Voucher.description.ilike(pattern))
        query = query.where(condition)
        count_q = count_q.where(condition)

    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(Voucher.created_at.desc()).offset((page - 1) * limit).limit(limit)
    vouchers = (await db.execute(query)).scalars().all()
    return list(vouchers), total


async def create_voucher(db: AsyncSession, payload: VoucherCreate, staff_id: Optional[str]) -> Voucher:
    validate_voucher_payload(payload.discount_type, payload.value, payload.max_discount_cents)

    if payload.valid_until and payload.valid_from and payload.valid_until <= payload.valid_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La date de fin doit etre posterieure a la date de debut.",
        )

    # An explicit code wins, otherwise one is generated and retried on collision
    code = (payload.code or "").strip().upper()
    if code:
        if await get_voucher_by_code(db, code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le code {code} existe deja.",
            )
    else:
        for _ in range(10):
            candidate = generate_code(payload.code_prefix or "")
            if not await get_voucher_by_code(db, candidate):
                code = candidate
                break
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Generation du code impossible, reessayez.",
            )

    voucher = Voucher(
        code=code,
        description=payload.description,
        discount_type=payload.discount_type,
        value=payload.value,
        min_order_cents=payload.min_order_cents or 0,
        max_discount_cents=payload.max_discount_cents,
        valid_from=payload.valid_from or datetime.utcnow(),
        valid_until=payload.valid_until,
        usage_limit=payload.usage_limit,
        active_status=payload.active_status,
        created_by=staff_id,
    )
    db.add(voucher)
    await db.commit()
    await db.refresh(voucher)
    return voucher


async def update_voucher(db: AsyncSession, voucher_id: str, payload: VoucherUpdate) -> Voucher:
    voucher = await get_voucher_by_id(db, voucher_id)
    if not voucher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code introuvable")

    discount_type = payload.discount_type or voucher.discount_type
    value = payload.value if payload.value is not None else voucher.value
    cap = payload.max_discount_cents if payload.max_discount_cents is not None else voucher.max_discount_cents
    validate_voucher_payload(discount_type, value, cap)

    for field in (
        "description", "discount_type", "value", "min_order_cents",
        "max_discount_cents", "valid_from", "valid_until", "usage_limit", "active_status",
    ):
        new_value = getattr(payload, field)
        if new_value is not None:
            setattr(voucher, field, new_value)

    if voucher.valid_until and voucher.valid_from and voucher.valid_until <= voucher.valid_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La date de fin doit etre posterieure a la date de debut.",
        )

    if voucher.usage_limit < voucher.usage_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La limite ne peut pas etre inferieure aux {voucher.usage_count} utilisations deja enregistrees.",
        )

    await db.commit()
    await db.refresh(voucher)
    return voucher


async def delete_voucher(db: AsyncSession, voucher_id: str) -> bool:
    voucher = await get_voucher_by_id(db, voucher_id)
    if not voucher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code introuvable")
    await db.delete(voucher)
    await db.commit()
    return True
