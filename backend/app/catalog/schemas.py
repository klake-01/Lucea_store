from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    slug: str
    parent_id: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str
    children: List["CategoryResponse"] = []

    class Config:
        from_attributes = True

# Product Image Schemas
class ProductImageBase(BaseModel):
    url: str
    alt: str
    position: int = 0

class ProductImageCreate(ProductImageBase):
    pass

class ProductImageResponse(ProductImageBase):
    id: str
    product_id: str

    class Config:
        from_attributes = True

class ProductImageReorder(BaseModel):
    """Full ordered list of image ids. Index 0 becomes the main image."""
    image_ids: List[str]

# Variant Schemas
class VariantBase(BaseModel):
    sku: str
    price_cents: int = Field(..., ge=0, description="Price in minor currency units (cents)")
    stock: int = Field(..., ge=0, description="Stock quantity")
    size_attribute: Optional[str] = None

class VariantCreate(VariantBase):
    pass

class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    price_cents: Optional[int] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)
    size_attribute: Optional[str] = None

class VariantResponse(VariantBase):
    # Units promised to open orders, and what is actually sellable right now
    reserved: int = 0
    available: int = 0
    id: str
    product_id: str

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    brand: str = "LUCEA"
    status: str = "published" # draft, published, archived
    # Optional SEO overrides. Null means the storefront derives them.
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None

class ProductCreate(ProductBase):
    category_ids: List[str] = []
    variants: List[VariantCreate] = []
    images: List[ProductImageCreate] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    status: Optional[str] = None
    category_ids: Optional[List[str]] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None

class ProductResponse(ProductBase):
    id: str
    created_at: datetime
    updated_at: datetime
    variants: List[VariantResponse] = []
    images: List[ProductImageResponse] = []
    categories: List[CategoryResponse] = []

    class Config:
        from_attributes = True

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int
