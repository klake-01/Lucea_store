from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

# Cart Schemas
class CartItemAdd(BaseModel):
    variant_id: str
    quantity: int = Field(1, ge=1)
    config_text: Optional[str] = None

    @field_validator("config_text")
    @classmethod
    def check_config_length(cls, v):
        if v and len(v) > 15:
            raise ValueError("Custom configuration text cannot exceed 15 characters (BR-3)")
        return v

class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)

class CartItemResponse(BaseModel):
    id: str
    variant_id: str
    quantity: int
    config_text: Optional[str] = None
    unit_price_cents: int = 0
    item_total_cents: int = 0
    # Resolved by compute_cart_details so the cart can show what was ordered
    # without a second round trip per line.
    variant_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_image: Optional[str] = None

    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    id: str
    session_id: Optional[str] = None
    items: List[CartItemResponse] = []
    subtotal_cents: int = 0
    delivery_charge_cents: int = 0
    discount_cents: int = 0
    total_cents: int = 0
    voucher_code: Optional[str] = None
    # Set when a code was recognised but does not apply, shown to the customer
    voucher_error: Optional[str] = None

# Voucher Schemas
class VoucherApplyRequest(BaseModel):
    code: str

class VoucherResponse(BaseModel):
    code: str
    discount_type: str
    value: int
    active_status: bool

# Order Schemas
class OrderCreateRequest(BaseModel):
    cart_id: str
    name: str
    phone: str = Field(..., description="Moroccan phone number in E.164 or 06/07 format")
    city: str
    address_line: str
    payment_method: str = "COD" # Default Cash on Delivery
    voucher_code: Optional[str] = None # Revalidated server side, never trusted from the client

class OrderItemResponse(BaseModel):
    id: str
    variant_id: str
    snapshotted_product_name: str
    snapshotted_sku: str
    snapshotted_price_cents: int
    quantity: int
    config_text: Optional[str] = None

    class Config:
        from_attributes = True

class OrderStatusHistoryResponse(BaseModel):
    id: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: str
    order_number: str
    phone: str
    name: str
    city: str
    address_line: str
    subtotal_cents: int
    delivery_charge_cents: int
    discount_cents: int
    total_cents: int
    status: str
    payment_method: str
    created_at: datetime
    items: List[OrderItemResponse] = []
    status_history: List[OrderStatusHistoryResponse] = []

    class Config:
        from_attributes = True

class OrderStatusUpdateRequest(BaseModel):
    status: str # pending, confirmed, dispatched, delivered, cancelled, returned
    notes: Optional[str] = None


# Public order tracking
class OrderTrackRequest(BaseModel):
    """Two factors on purpose.

    An order number alone is guessable (LUC-YYYYMMDD-NNNN), so the phone number
    used at checkout must match as well before anything is returned.
    """
    order_number: str = Field(..., min_length=4, max_length=32)
    phone: str = Field(..., min_length=6, max_length=20)


class OrderTrackItem(BaseModel):
    product_name: str
    quantity: int
    config_text: Optional[str] = None
    line_total_cents: int


class OrderTrackStep(BaseModel):
    status: str
    label: str
    reached: bool
    created_at: Optional[datetime] = None


class OrderTrackResponse(BaseModel):
    """Deliberately narrower than OrderResponse.

    The full delivery address is never echoed back: the caller proved they know
    the phone number, not that they are the person living at that address.
    """
    order_number: str
    status: str
    status_label: str
    placed_at: datetime
    city: str
    recipient_first_name: str
    payment_method: str
    items: List[OrderTrackItem] = []
    subtotal_cents: int
    delivery_charge_cents: int
    discount_cents: int
    total_cents: int
    timeline: List[OrderTrackStep] = []
    estimated_delivery: Optional[str] = None
