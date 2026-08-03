import re
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

# Deliberately permissive. A newsletter address is proven by the message that
# reaches it, not by a regex, and an over strict pattern rejects real addresses.
# This only rules out input that cannot be an address at all.
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$")


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=120)
    body: str = Field(..., min_length=20, max_length=2000)
    author_name: str = Field(..., min_length=2, max_length=80)
    author_city: Optional[str] = Field(None, max_length=80)
    # Contact details let the workshop follow up on a poor experience. They are
    # never returned by the public endpoints.
    author_email: Optional[str] = Field(None, max_length=160)
    author_phone: Optional[str] = Field(None, max_length=30)
    product_id: Optional[str] = None
    order_number: Optional[str] = Field(None, max_length=32)


class ReviewPublic(BaseModel):
    """What a visitor may see. Deliberately narrower than the admin view: no
    email, no phone, no IP, no staff note."""
    id: str
    rating: int
    title: Optional[str] = None
    body: str
    author_name: str
    author_city: Optional[str] = None
    product_name: Optional[str] = None
    verified_purchase: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewAdmin(ReviewPublic):
    author_email: Optional[str] = None
    author_phone: Optional[str] = None
    order_number: Optional[str] = None
    product_id: Optional[str] = None
    status: str
    routing_reason: Optional[str] = None
    staff_note: Optional[str] = None
    moderated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewSummary(BaseModel):
    average: float = 0
    count: int = 0
    distribution: Dict[str, int] = {}


class ReviewListPublic(BaseModel):
    items: List[ReviewPublic] = []
    total: int = 0
    summary: ReviewSummary = ReviewSummary()


class ReviewListAdmin(BaseModel):
    items: List[ReviewAdmin] = []
    total: int = 0
    page: int = 1
    limit: int = 30


class ReviewModerate(BaseModel):
    status: str  # published | pending | rejected
    staff_note: Optional[str] = None


class SubscribeRequest(BaseModel):
    email: str = Field(..., max_length=160)
    source: str = "home_welcome_offer"

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_PATTERN.match(clean):
            raise ValueError("Adresse email invalide.")
        return clean


class SubscriberResponse(BaseModel):
    id: str
    email: str
    source: str
    converted: bool
    unsubscribed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriberListResponse(BaseModel):
    items: List[SubscriberResponse] = []
    total: int = 0
    page: int = 1
    limit: int = 50
