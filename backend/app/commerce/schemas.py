from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


def to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normalises an incoming datetime to naive UTC.

    The admin sends `new Date(...).toISOString()`, which carries a Z suffix, so
    pydantic hands us a timezone aware datetime. Every timestamp column in this
    schema is a plain TIMESTAMP and the rest of the codebase compares against
    `datetime.utcnow()`, which is naive. Mixing the two makes asyncpg reject the
    insert outright and makes any later comparison raise. Converting here keeps
    one representation across the whole application.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


class VoucherBase(BaseModel):
    description: Optional[str] = None
    discount_type: str = "percentage"  # fixed_cents | percentage | free_shipping
    value: int = Field(0, ge=0)
    min_order_cents: int = Field(0, ge=0)
    max_discount_cents: Optional[int] = Field(None, ge=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    usage_limit: int = Field(100, ge=1)
    active_status: bool = True

    @field_validator("valid_from", "valid_until", mode="after")
    @classmethod
    def _normalise_datetimes(cls, v: Optional[datetime]) -> Optional[datetime]:
        return to_naive_utc(v)


class VoucherCreate(VoucherBase):
    # Leave blank to have one generated. code_prefix only applies then.
    code: Optional[str] = None
    code_prefix: Optional[str] = None


class VoucherUpdate(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[int] = Field(None, ge=0)
    min_order_cents: Optional[int] = Field(None, ge=0)
    max_discount_cents: Optional[int] = Field(None, ge=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    usage_limit: Optional[int] = Field(None, ge=1)
    active_status: Optional[bool] = None

    @field_validator("valid_from", "valid_until", mode="after")
    @classmethod
    def _normalise_datetimes(cls, v: Optional[datetime]) -> Optional[datetime]:
        return to_naive_utc(v)


class VoucherResponse(VoucherBase):
    id: str
    code: str
    usage_count: int
    created_at: datetime
    # Computed server side so every client renders the same badge
    status: str = "active"

    class Config:
        from_attributes = True


class VoucherListResponse(BaseModel):
    items: List[VoucherResponse]
    total: int
    page: int
    limit: int
