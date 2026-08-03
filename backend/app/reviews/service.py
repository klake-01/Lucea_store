"""Review submission, routing and moderation.

The routing rule lives here so the storefront, the admin and any future import
all agree on where a review lands.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.catalog.models import Product
from app.orders.models import Order
from app.reviews.models import NewsletterSubscriber, Review
from app.reviews.schemas import ReviewCreate

# 4 and 5 publish on their own. 3 and below wait for a human.
AUTO_PUBLISH_FROM = 4

MAX_REVIEWS_PER_PHONE_PER_DAY = 3
MIN_BODY_LENGTH = 20


def normalise_phone(value: Optional[str]) -> str:
    digits = "".join(filter(str.isdigit, value or ""))
    if digits.startswith("212"):
        digits = digits[3:]
    return digits.lstrip("0")


async def _verify_purchase(
    db: AsyncSession, order_number: Optional[str], phone: Optional[str]
) -> bool:
    """True when the order number exists and belongs to that phone.

    A verified badge has to mean something, so both must match. A mismatch is
    not an error: the review is simply published without the badge.
    """
    if not order_number or not phone:
        return False

    res = await db.execute(
        select(Order).where(Order.order_number == order_number.strip().upper())
    )
    order = res.scalars().first()
    if not order:
        return False
    return normalise_phone(order.phone) == normalise_phone(phone)


async def create_review(
    db: AsyncSession, payload: ReviewCreate, ip: Optional[str] = None
) -> Review:
    if not 1 <= payload.rating <= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La note doit etre comprise entre 1 et 5.",
        )

    body = (payload.body or "").strip()
    if len(body) < MIN_BODY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Merci de detailler votre avis en {MIN_BODY_LENGTH} caracteres au minimum.",
        )

    # Flood guard. Someone with a genuine complaint does not need to file the
    # same review ten times, and someone doing so is not writing reviews.
    if payload.author_phone:
        since = datetime.utcnow() - timedelta(days=1)
        recent = await db.execute(
            select(func.count(Review.id)).where(
                Review.author_phone == payload.author_phone.strip(),
                Review.created_at >= since,
            )
        )
        if (recent.scalar() or 0) >= MAX_REVIEWS_PER_PHONE_PER_DAY:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Vous avez deja envoye plusieurs avis aujourd hui. Reessayez demain.",
            )

    verified = await _verify_purchase(db, payload.order_number, payload.author_phone)

    product_name = None
    if payload.product_id:
        res = await db.execute(select(Product).where(Product.id == payload.product_id))
        product = res.scalars().first()
        product_name = product.name if product else None

    if payload.rating >= AUTO_PUBLISH_FROM:
        review_status = "published"
        reason = f"Publie automatiquement, note de {payload.rating} sur 5"
    else:
        review_status = "pending"
        reason = (
            f"Note de {payload.rating} sur 5, en attente de lecture. "
            "Contactez le client avant de decider."
        )

    review = Review(
        rating=payload.rating,
        title=(payload.title or "").strip() or None,
        body=body,
        author_name=payload.author_name.strip(),
        author_city=(payload.author_city or "").strip() or None,
        author_email=(payload.author_email or "").strip() or None,
        author_phone=(payload.author_phone or "").strip() or None,
        product_id=payload.product_id,
        product_name=product_name,
        order_number=(payload.order_number or "").strip().upper() or None,
        verified_purchase=verified,
        status=review_status,
        routing_reason=reason,
        submitted_ip=ip,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


async def list_public_reviews(
    db: AsyncSession, page: int = 1, limit: int = 12,
    product_id: Optional[str] = None, min_rating: Optional[int] = None,
) -> Tuple[List[Review], int, dict]:
    """Published reviews only, newest first, plus the rating summary."""
    conditions = [Review.status == "published"]
    if product_id:
        conditions.append(Review.product_id == product_id)
    if min_rating:
        conditions.append(Review.rating >= min_rating)

    count_q = select(func.count(Review.id))
    query = select(Review)
    for c in conditions:
        count_q = count_q.where(c)
        query = query.where(c)

    total = (await db.execute(count_q)).scalar() or 0

    rows = (await db.execute(
        query.order_by(Review.created_at.desc())
             .offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    # Summary is computed over published reviews only, so the public average
    # matches the reviews a visitor can actually read.
    summary_rows = (await db.execute(
        select(Review.rating, func.count(Review.id))
        .where(Review.status == "published")
        .group_by(Review.rating)
    )).all()

    distribution = {str(i): 0 for i in range(1, 6)}
    total_published = 0
    weighted = 0
    for rating, count in summary_rows:
        distribution[str(rating)] = count
        total_published += count
        weighted += rating * count

    summary = {
        "average": round(weighted / total_published, 2) if total_published else 0,
        "count": total_published,
        "distribution": distribution,
    }
    return list(rows), total, summary


async def list_admin_reviews(
    db: AsyncSession, page: int = 1, limit: int = 30,
    status_filter: Optional[str] = None, search: Optional[str] = None,
) -> Tuple[List[Review], int]:
    query = select(Review)
    count_q = select(func.count(Review.id))

    if status_filter:
        query = query.where(Review.status == status_filter)
        count_q = count_q.where(Review.status == status_filter)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        condition = or_(
            Review.author_name.ilike(pattern),
            Review.body.ilike(pattern),
            Review.order_number.ilike(pattern),
            Review.author_phone.ilike(pattern),
        )
        query = query.where(condition)
        count_q = count_q.where(condition)

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(
        query.order_by(Review.created_at.desc())
             .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return list(rows), total


async def moderate_review(
    db: AsyncSession, review_id: str, new_status: str,
    staff_id: str, note: Optional[str] = None,
) -> Review:
    if new_status not in ("published", "pending", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Statut inconnu."
        )

    res = await db.execute(select(Review).where(Review.id == review_id))
    review = res.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis introuvable")

    review.status = new_status
    review.moderated_by = staff_id
    review.moderated_at = datetime.utcnow()
    if note is not None:
        review.staff_note = note.strip() or None

    await db.commit()
    await db.refresh(review)
    return review


async def delete_review(db: AsyncSession, review_id: str) -> None:
    res = await db.execute(select(Review).where(Review.id == review_id))
    review = res.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avis introuvable")
    await db.delete(review)
    await db.commit()


# ------------------------------------------------------------------ newsletter

async def subscribe(db: AsyncSession, email: str, source: str = "home_welcome_offer") -> Tuple[NewsletterSubscriber, bool]:
    """Idempotent. Returns (subscriber, created)."""
    clean = email.strip().lower()
    existing = (await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == clean)
    )).scalars().first()

    if existing:
        # Re subscribing after opting out is a deliberate act, so honour it
        if existing.unsubscribed:
            existing.unsubscribed = False
            await db.commit()
            await db.refresh(existing)
        return existing, False

    subscriber = NewsletterSubscriber(email=clean, source=source)
    db.add(subscriber)
    await db.commit()
    await db.refresh(subscriber)
    return subscriber, True


async def list_subscribers(
    db: AsyncSession, page: int = 1, limit: int = 50, search: Optional[str] = None
) -> Tuple[List[NewsletterSubscriber], int]:
    query = select(NewsletterSubscriber)
    count_q = select(func.count(NewsletterSubscriber.id))

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.where(NewsletterSubscriber.email.ilike(pattern))
        count_q = count_q.where(NewsletterSubscriber.email.ilike(pattern))

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(
        query.order_by(NewsletterSubscriber.created_at.desc())
             .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return list(rows), total
