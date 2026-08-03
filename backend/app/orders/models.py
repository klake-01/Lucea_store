import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Cart(Base):
    __tablename__ = "carts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cart_id = Column(String, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(String, ForeignKey("variants.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    config_text = Column(String(15), nullable=True) # Custom prénom text <= 15 chars (BR-3)

    __table_args__ = (
        CheckConstraint("length(config_text) <= 15", name="check_custom_text_length"),
        CheckConstraint("quantity > 0", name="check_cart_quantity_positive")
    )

    cart = relationship("Cart", back_populates="items")

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True)
    phone = Column(String(20), nullable=False)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    address_line = Column(String, nullable=False)
    subtotal_cents = Column(Integer, nullable=False)
    delivery_charge_cents = Column(Integer, default=0, nullable=False)
    discount_cents = Column(Integer, default=0, nullable=False)
    total_cents = Column(Integer, nullable=False)
    status = Column(String, default="pending", nullable=False)
    # Where this order's units currently sit, so a status set twice cannot
    # double commit or double release:
    #   reserved  -> held against the variant, not yet sold
    #   committed -> delivered and paid, stock permanently reduced
    #   released  -> cancelled or returned, units back on the shelf
    stock_state = Column(String, default="reserved", nullable=False) # pending, confirmed, dispatched, delivered, cancelled, returned
    payment_method = Column(String, default="COD", nullable=False) # COD, card
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    items = relationship("OrderItem", back_populates="order")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(String, ForeignKey("variants.id", ondelete="RESTRICT"), nullable=False)
    snapshotted_product_name = Column(String, nullable=False)
    snapshotted_sku = Column(String, nullable=False)
    snapshotted_price_cents = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    config_text = Column(String(15), nullable=True)

    order = relationship("Order", back_populates="items")

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="status_history")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    payment_method = Column(String, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    status = Column(String, default="pending", nullable=False)
    # Where this order's units currently sit, so a status set twice cannot
    # double commit or double release:
    #   reserved  -> held against the variant, not yet sold
    #   committed -> delivered and paid, stock permanently reduced
    #   released  -> cancelled or returned, units back on the shelf
    stock_state = Column(String, default="reserved", nullable=False) # pending, completed, failed, refunded
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="preparing", nullable=False) # preparing, dispatched, delivered
    tracking_url = Column(String, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
