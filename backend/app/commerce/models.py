import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Boolean, CheckConstraint, JSON, DateTime
)

from app.database import Base


class Voucher(Base):
    """A discount code.

    Money is always held in minor units. `value` means different things per
    `discount_type`:
      fixed_cents   -> the amount taken off, in cents
      percentage    -> a whole percentage between 1 and 90
      free_shipping -> ignored, the delivery charge is zeroed instead
    """

    __tablename__ = "vouchers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)

    discount_type = Column(String, nullable=False)  # fixed_cents | percentage | free_shipping
    value = Column(Integer, nullable=False, default=0)

    # Guard rails so a percentage code cannot wipe out an expensive basket
    min_order_cents = Column(Integer, default=0, nullable=False)
    max_discount_cents = Column(Integer, nullable=True)

    # Validity window. A null valid_until means the code never expires.
    valid_from = Column(DateTime, default=datetime.utcnow, nullable=False)
    valid_until = Column(DateTime, nullable=True)

    usage_count = Column(Integer, default=0, nullable=False)
    usage_limit = Column(Integer, default=100, nullable=False)
    active_status = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)  # staff user id

    __table_args__ = (
        CheckConstraint("usage_count <= usage_limit", name="check_voucher_usage_limit"),
        CheckConstraint("value >= 0", name="check_voucher_value_non_negative"),
        CheckConstraint("min_order_cents >= 0", name="check_voucher_min_order_non_negative"),
    )

    def status_label(self, now: Optional[datetime] = None) -> str:
        """Single source of truth for the badge shown in the admin."""
        now = now or datetime.utcnow()
        if not self.active_status:
            return "disabled"
        if self.valid_from and now < self.valid_from:
            return "scheduled"
        if self.valid_until and now > self.valid_until:
            return "expired"
        if self.usage_count >= self.usage_limit:
            return "exhausted"
        return "active"


class ShippingZone(Base):
    __tablename__ = "shipping_zones"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    zone_name = Column(String, unique=True, nullable=False)   # e.g. 'Zone 1'
    cities_covered = Column(JSON, nullable=False)             # e.g. ['Casablanca']
    delivery_time = Column(String, nullable=False)            # e.g. '24 heures'
    shipping_cost_cents = Column(Integer, nullable=False)     # e.g. 2000
    free_threshold_cents = Column(Integer, nullable=False)    # e.g. 35000
    default_carrier = Column(String, nullable=False)
