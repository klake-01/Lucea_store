import math
from typing import Optional, List
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_admin, get_current_user
from app.auth.models import StaffUser
from app.auth.audit import record_audit
from app.catalog.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse, CategoryResponse,
    VariantCreate, VariantUpdate, VariantResponse, ProductImageCreate, ProductImageResponse,
    ProductImageReorder
)
from app.catalog.repository import (
    list_products, get_product_by_slug, get_product_by_id,
    list_categories, create_product, update_product, delete_product,
    create_variant, update_variant, delete_variant, get_variant_by_id,
    add_product_image, delete_product_image, reorder_product_images
)
from app.storage.service import upload_product_image, delete_image_from_storage

router = APIRouter()

@router.get("/products", response_model=ProductListResponse)
async def get_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    category_slug: Optional[str] = None,
    status: Optional[str] = "published",
    db: AsyncSession = Depends(get_db)
):
    items, total = await list_products(
        db, page=page, limit=limit, category_slug=category_slug, status_filter=status
    )
    pages = math.ceil(total / limit) if total > 0 else 0
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.get("/products/{slug}", response_model=ProductResponse)
async def get_product(slug: str, db: AsyncSession = Depends(get_db)):
    product = await get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    return await list_categories(db)

@router.get("/admin/products", response_model=ProductListResponse)
async def admin_list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(60, ge=1, le=60),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(get_current_user)
):
    """Admin catalog listing. Unlike the storefront route it also returns drafts."""
    items, total = await list_products(db, page=page, limit=limit, status_filter=status_filter)
    pages = math.ceil(total / limit) if total > 0 else 0
    return ProductListResponse(items=items, total=total, page=page, limit=limit, pages=pages)

@router.post("/admin/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    product = await create_product(db, payload)
    await record_audit(
        db, staff_id=staff.id, action="CREATE_PRODUCT", target_table="products",
        record_id=product.id, after_value={"name": product.name, "slug": product.slug}
    )
    return product

@router.put("/admin/products/{product_id}", response_model=ProductResponse)
async def admin_update_product(
    product_id: str,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    existing = await get_product_by_id(db, product_id)
    before = {"name": existing.name, "slug": existing.slug, "status": existing.status} if existing else None
    product = await update_product(db, product_id, payload)
    await record_audit(
        db, staff_id=staff.id, action="UPDATE_PRODUCT", target_table="products",
        record_id=product_id, before_value=before,
        after_value={"name": product.name, "slug": product.slug, "status": product.status}
    )
    return product

@router.delete("/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    existing = await get_product_by_id(db, product_id)
    before = {"name": existing.name, "slug": existing.slug} if existing else None
    await delete_product(db, product_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_PRODUCT", target_table="products",
        record_id=product_id, before_value=before
    )
    return None

# Variant management
@router.post(
    "/admin/products/{product_id}/variants",
    response_model=VariantResponse,
    status_code=status.HTTP_201_CREATED
)
async def admin_create_variant(
    product_id: str,
    payload: VariantCreate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    variant = await create_variant(db, product_id, payload)
    await record_audit(
        db, staff_id=staff.id, action="CREATE_VARIANT", target_table="variants",
        record_id=variant.id, after_value={"sku": variant.sku, "price_cents": variant.price_cents,
                                          "stock": variant.stock}
    )
    return variant

@router.put("/admin/variants/{variant_id}", response_model=VariantResponse)
async def admin_update_variant(
    variant_id: str,
    payload: VariantUpdate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    existing = await get_variant_by_id(db, variant_id)
    before = {"sku": existing.sku, "price_cents": existing.price_cents, "stock": existing.stock} if existing else None
    variant = await update_variant(db, variant_id, payload)
    await record_audit(
        db, staff_id=staff.id, action="UPDATE_VARIANT", target_table="variants",
        record_id=variant_id, before_value=before,
        after_value={"sku": variant.sku, "price_cents": variant.price_cents, "stock": variant.stock}
    )
    return variant

@router.delete("/admin/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_variant(
    variant_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    existing = await get_variant_by_id(db, variant_id)
    before = {"sku": existing.sku} if existing else None
    await delete_variant(db, variant_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_VARIANT", target_table="variants",
        record_id=variant_id, before_value=before
    )
    return None

# Product image management
@router.post(
    "/admin/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED
)
async def admin_add_product_image(
    product_id: str,
    payload: ProductImageCreate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    """Registers an image already hosted elsewhere. For a file upload use
    /admin/products/{id}/images/upload instead."""
    image = await add_product_image(db, product_id, payload.url, payload.alt, payload.position)
    await record_audit(
        db, staff_id=staff.id, action="ADD_PRODUCT_IMAGE", target_table="product_images",
        record_id=image.id, after_value={"url": image.url, "alt": image.alt}
    )
    return image


@router.post(
    "/admin/products/{product_id}/images/upload",
    response_model=List[ProductImageResponse],
    status_code=status.HTTP_201_CREATED
)
async def admin_upload_product_images(
    product_id: str,
    files: List[UploadFile] = File(..., description="One or more images, in gallery order"),
    alt: Optional[str] = Form(None, description="Alt text applied to every file"),
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    """Uploads several files at once and appends them to the gallery.

    Files are stored in MinIO under random names and validated for type and
    size by the storage service. The order of the `files` list becomes the
    gallery order, so the first file uploaded to an empty product becomes its
    main image.
    """
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable")

    created: List = []
    for index, file in enumerate(files):
        url, storage_key = await upload_product_image(file)
        alt_text = (alt or "").strip() or f"{product.name}, vue {len(product.images) + index + 1}"
        image = await add_product_image(
            db, product_id, url=url, alt=alt_text, storage_key=storage_key
        )
        created.append(image)

    await record_audit(
        db, staff_id=staff.id, action="UPLOAD_PRODUCT_IMAGES", target_table="product_images",
        record_id=product_id, after_value={"count": len(created)}
    )
    return created


@router.put("/admin/products/{product_id}/images/order", response_model=List[ProductImageResponse])
async def admin_reorder_product_images(
    product_id: str,
    payload: ProductImageReorder,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    """Position 0 becomes the main image used by cards, Open Graph and schema."""
    images = await reorder_product_images(db, product_id, payload.image_ids)
    await record_audit(
        db, staff_id=staff.id, action="REORDER_PRODUCT_IMAGES", target_table="product_images",
        record_id=product_id, after_value={"order": payload.image_ids}
    )
    return images


@router.delete("/admin/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_product_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_admin)
):
    storage_key = await delete_product_image(db, image_id)
    if storage_key:
        # Best effort: the row is already gone, an orphaned object is
        # recoverable but a dangling row is not.
        delete_image_from_storage(storage_key)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_PRODUCT_IMAGE", target_table="product_images",
        record_id=image_id
    )
    return None
