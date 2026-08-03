import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, CheckConstraint, Table
from sqlalchemy.orm import relationship
from app.database import Base

# Junction table for Product <-> Category N:M
product_categories = Table(
    "product_categories",
    Base.metadata,
    Column("product_id", String, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", String, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True)
)

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    parent_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    parent = relationship("Category", remote_side=[id], backref="children")

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    brand = Column(String, default="LUCÉA", nullable=False)
    status = Column(String, default="published", nullable=False) # draft, published, archived

    # SEO overrides. Left null, the storefront derives them from the product
    # name and description via lib/productSeo.ts, so a product is never
    # published without metadata.
    seo_title = Column(String, nullable=True)
    seo_description = Column(String, nullable=True)
    seo_keywords = Column(String, nullable=True)  # comma separated

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Deterministic ordering matters on the storefront: variants[0] drives the
    # default size selected on the product page and the "from" price shown on
    # the card, so it must not vary between requests.
    variants = relationship(
        "Variant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="Variant.price_cents"
    )
    images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.position"
    )
    categories = relationship("Category", secondary=product_categories, backref="products")

class Variant(Base):
    __tablename__ = "variants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sku = Column(String, unique=True, index=True, nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    price_cents = Column(Integer, nullable=False) # Minor currency units e.g. 35000 = 350.00 MAD
    # Physical units on hand. Only ever reduced when goods actually leave.
    stock = Column(Integer, default=0, nullable=False)
    # Units promised to open orders. available = stock - reserved, and that is
    # what the storefront shows and what add to cart checks against.
    reserved = Column(Integer, default=0, nullable=False)
    size_attribute = Column(String, nullable=True) # e.g., '20cm', '30cm'

    __table_args__ = (
        CheckConstraint("stock >= 0", name="check_stock_non_negative"),
    )

    product = relationship("Product", back_populates="variants")

    @property
    def available(self) -> int:
        """What may still be sold: on hand minus what open orders hold."""
        return max(0, (self.stock or 0) - (self.reserved or 0))


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    alt = Column(String, nullable=False)
    position = Column(Integer, default=0, nullable=False)
    # Object name inside the bucket, kept so deleting the row can also remove
    # the file from storage rather than orphaning it.
    storage_key = Column(String, nullable=True)

    product = relationship("Product", back_populates="images")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    variant_id = Column(String, ForeignKey("variants.id", ondelete="CASCADE"), nullable=False)
    delta = Column(Integer, nullable=False) # +10 or -1
    reason = Column(String, nullable=False) # 'initial_seed', 'order_placed', 'restock'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
