from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.redis import get_redis
from app.auth.audit import record_audit
from app.auth.dependencies import require_role, require_admin, client_ip
from app.auth.models import StaffUser
from app.reviews.schemas import (
    ReviewCreate, ReviewPublic, ReviewListPublic, ReviewListAdmin, ReviewModerate,
    ReviewAdmin, SubscribeRequest, SubscriberListResponse,
)
from app.reviews.service import (
    create_review, list_public_reviews, list_admin_reviews, moderate_review,
    delete_review, subscribe, list_subscribers,
)

router = APIRouter()

SUBMIT_WINDOW_SECONDS = 3600
MAX_SUBMISSIONS_PER_IP = 5


# ------------------------------------------------------------------ public

@router.get("/reviews", response_model=ReviewListPublic)
async def api_list_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    product_id: Optional[str] = None,
    min_rating: Optional[int] = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    """Published reviews only. The summary is computed over the same set, so
    the average always matches the reviews a visitor can actually read."""
    items, total, summary = await list_public_reviews(
        db, page=page, limit=limit, product_id=product_id, min_rating=min_rating
    )
    return ReviewListPublic(items=items, total=total, summary=summary)


@router.post("/reviews", response_model=ReviewPublic, status_code=status.HTTP_201_CREATED)
async def api_create_review(
    payload: ReviewCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Submits a review.

    A rating of 4 or 5 publishes immediately. Anything at 3 or below is held
    for a human, because a low rating is usually a service problem worth a
    phone call before it becomes public.

    The response is the public shape either way, so the submitter is not told
    whether their review went live. That keeps the form from becoming a probe
    for the moderation threshold.
    """
    ip = client_ip(request)
    key = f"review_submit:{ip}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, SUBMIT_WINDOW_SECONDS)
    if count > MAX_SUBMISSIONS_PER_IP:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop d avis envoyes depuis cette adresse. Reessayez plus tard.",
        )

    return await create_review(db, payload, ip=ip)


@router.post("/newsletter/subscribe", status_code=status.HTTP_201_CREATED)
async def api_subscribe(
    payload: SubscribeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Captures an address for the welcome offer.

    Idempotent, and it always reports success. Telling a caller that an address
    is already registered would turn the form into an address checker.
    """
    ip = client_ip(request)
    key = f"subscribe:{ip}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, SUBMIT_WINDOW_SECONDS)
    if count > 10:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de demandes depuis cette adresse.",
        )

    await subscribe(db, payload.email, payload.source)
    return {
        "message": "Merci, votre code de reduction arrive par email.",
        "discount_percent": 10,
    }


# ------------------------------------------------------------------ admin

@router.get("/admin/reviews", response_model=ReviewListAdmin)
async def api_admin_list_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    items, total = await list_admin_reviews(
        db, page=page, limit=limit, status_filter=status_filter, search=search
    )
    return ReviewListAdmin(items=items, total=total, page=page, limit=limit)


@router.put("/admin/reviews/{review_id}", response_model=ReviewAdmin)
async def api_moderate_review(
    review_id: str,
    payload: ReviewModerate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    """Publishes, holds or rejects a review. The text is never altered."""
    review = await moderate_review(
        db, review_id, payload.status, staff_id=staff.id, note=payload.staff_note
    )
    await record_audit(
        db, staff_id=staff.id, action="MODERATE_REVIEW", target_table="reviews",
        record_id=review_id,
        after_value={"status": payload.status, "rating": review.rating},
    )
    return review


@router.delete("/admin/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_review(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin),
):
    """Permanent removal, admin only. Rejecting is usually the better choice:
    it keeps the record for the audit trail."""
    await delete_review(db, review_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_REVIEW", target_table="reviews",
        record_id=review_id,
    )
    return None


@router.get("/admin/subscribers", response_model=SubscriberListResponse)
async def api_admin_subscribers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    items, total = await list_subscribers(db, page=page, limit=limit, search=search)
    return SubscriberListResponse(items=items, total=total, page=page, limit=limit)
