import math
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, delete
from fastapi import HTTPException, status

from app.catalog.models import Product, Variant, Category, ProductImage, StockMovement
from app.catalog.schemas import (
    ProductCreate, ProductUpdate, CategoryCreate, VariantCreate, VariantUpdate
)

async def list_products(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    category_slug: Optional[str] = None,
    status_filter: Optional[str] = "published"
) -> Tuple[List[Product], int]:
    # Enforce maximum page size limit of 60 (per Architecture Law A-C4)
    limit = min(max(1, limit), 60)
    page = max(1, page)
    offset = (page - 1) * limit

    query = select(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images),
        # CategoryResponse serialises `children`, so it has to be eager loaded
        # too or pydantic triggers lazy IO outside the async context.
        selectinload(Product.categories).selectinload(Category.children)
    )

    if status_filter:
        query = query.where(Product.status == status_filter)

    if category_slug:
        query = query.join(Product.categories).where(Category.slug == category_slug)

    # Count total
    count_query = select(func.count(Product.id))
    if status_filter:
        count_query = count_query.where(Product.status == status_filter)
    if category_slug:
        count_query = count_query.join(Product.categories).where(Category.slug == category_slug)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(Product.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    return list(products), total

async def get_product_by_slug(db: AsyncSession, slug: str) -> Optional[Product]:
    query = select(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images),
        # CategoryResponse serialises `children`, so it has to be eager loaded
        # too or pydantic triggers lazy IO outside the async context.
        selectinload(Product.categories).selectinload(Category.children)
    ).where(Product.slug == slug)

    result = await db.execute(query)
    return result.scalars().first()

async def get_product_by_id(db: AsyncSession, product_id: str) -> Optional[Product]:
    query = select(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images),
        # CategoryResponse serialises `children`, so it has to be eager loaded
        # too or pydantic triggers lazy IO outside the async context.
        selectinload(Product.categories).selectinload(Category.children)
    ).where(Product.id == product_id)

    result = await db.execute(query)
    return result.scalars().first()

async def get_variant_stock(db: AsyncSession, variant_id: str) -> Optional[int]:
    result = await db.execute(select(Variant.stock).where(Variant.id == variant_id))
    return result.scalar()

async def list_categories(db: AsyncSession) -> List[Category]:
    result = await db.execute(select(Category).options(selectinload(Category.children)).where(Category.parent_id == None))
    return list(result.scalars().all())

async def create_product(db: AsyncSession, product_in: ProductCreate) -> Product:
    # Check unique slug
    existing = await get_product_by_slug(db, product_in.slug)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product slug already exists")

    product = Product(
        name=product_in.name,
        slug=product_in.slug,
        description=product_in.description,
        brand=product_in.brand,
        status=product_in.status,
        seo_title=product_in.seo_title,
        seo_description=product_in.seo_description,
        seo_keywords=product_in.seo_keywords,
    )

    # Associate categories
    if product_in.category_ids:
        cats_res = await db.execute(select(Category).where(Category.id.in_(product_in.category_ids)))
        product.categories = list(cats_res.scalars().all())

    # Add variants
    for var_in in product_in.variants:
        variant = Variant(
            sku=var_in.sku,
            price_cents=var_in.price_cents,
            stock=var_in.stock,
            size_attribute=var_in.size_attribute
        )
        product.variants.append(variant)

    # Add images
    for img_in in product_in.images:
        product.images.append(
            ProductImage(url=img_in.url, alt=img_in.alt, position=img_in.position)
        )

    db.add(product)
    await db.commit()

    # Opening stock is a ledger event too, so every variant starts with a movement
    for variant in product.variants:
        if variant.stock:
            db.add(StockMovement(variant_id=variant.id, delta=variant.stock, reason="initial_seed"))
    await db.commit()

    return await get_product_by_id(db, product.id)

async def update_product(db: AsyncSession, product_id: str, product_in: ProductUpdate) -> Product:
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if product_in.name is not None:
        product.name = product_in.name
    if product_in.slug is not None:
        if product_in.slug != product.slug:
            existing = await get_product_by_slug(db, product_in.slug)
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product slug already exists")
        product.slug = product_in.slug
    if product_in.description is not None:
        product.description = product_in.description
    if product_in.brand is not None:
        product.brand = product_in.brand
    if product_in.status is not None:
        product.status = product_in.status
    for seo_field in ("seo_title", "seo_description", "seo_keywords"):
        value = getattr(product_in, seo_field)
        if value is not None:
            setattr(product, seo_field, value or None)

    if product_in.category_ids is not None:
        cats_res = await db.execute(select(Category).where(Category.id.in_(product_in.category_ids)))
        product.categories = list(cats_res.scalars().all())

    await db.commit()
    return await get_product_by_id(db, product.id)

async def get_variant_by_id(db: AsyncSession, variant_id: str) -> Optional[Variant]:
    res = await db.execute(select(Variant).where(Variant.id == variant_id))
    return res.scalars().first()

async def create_variant(db: AsyncSession, product_id: str, variant_in: VariantCreate) -> Variant:
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = await db.execute(select(Variant).where(Variant.sku == variant_in.sku))
    if existing.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU already exists")

    variant = Variant(
        product_id=product_id,
        sku=variant_in.sku,
        price_cents=variant_in.price_cents,
        stock=variant_in.stock,
        size_attribute=variant_in.size_attribute
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)

    if variant.stock:
        db.add(StockMovement(variant_id=variant.id, delta=variant.stock, reason="initial_seed"))
        await db.commit()

    return variant

async def update_variant(db: AsyncSession, variant_id: str, variant_in: VariantUpdate) -> Variant:
    """Updates price, SKU, size or stock. Stock changes are journaled as movements."""
    variant = await get_variant_by_id(db, variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if variant_in.sku is not None and variant_in.sku != variant.sku:
        clash = await db.execute(select(Variant).where(Variant.sku == variant_in.sku))
        if clash.scalars().first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU already exists")
        variant.sku = variant_in.sku

    if variant_in.price_cents is not None:
        variant.price_cents = variant_in.price_cents

    if variant_in.size_attribute is not None:
        variant.size_attribute = variant_in.size_attribute

    if variant_in.stock is not None and variant_in.stock != variant.stock:
        delta = variant_in.stock - variant.stock
        variant.stock = variant_in.stock
        db.add(StockMovement(variant_id=variant.id, delta=delta, reason="manual_adjustment"))

    await db.commit()
    await db.refresh(variant)
    return variant

async def delete_variant(db: AsyncSession, variant_id: str) -> bool:
    variant = await get_variant_by_id(db, variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    remaining = await db.execute(
        select(func.count(Variant.id)).where(Variant.product_id == variant.product_id)
    )
    if (remaining.scalar() or 0) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A product must keep at least one variant"
        )

    await db.delete(variant)
    await db.commit()
    return True

MAX_IMAGES_PER_PRODUCT = 8

async def add_product_image(
    db: AsyncSession,
    product_id: str,
    url: str,
    alt: str,
    position: Optional[int] = None,
    storage_key: Optional[str] = None,
) -> ProductImage:
    """Appends an image. Position defaults to the end of the gallery, so the
    first image uploaded stays the main one unless staff reorder."""
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable")

    existing = await db.execute(
        select(func.count(ProductImage.id)).where(ProductImage.product_id == product_id)
    )
    count = existing.scalar() or 0
    if count >= MAX_IMAGES_PER_PRODUCT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un produit ne peut pas depasser {MAX_IMAGES_PER_PRODUCT} images.",
        )

    image = ProductImage(
        product_id=product_id,
        url=url,
        alt=alt,
        position=count if position is None else position,
        storage_key=storage_key,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return image

async def reorder_product_images(
    db: AsyncSession, product_id: str, image_ids: List[str]
) -> List[ProductImage]:
    """Rewrites gallery order from an explicit list of ids.

    Position 0 is the main image: it drives the card thumbnail, the Open Graph
    preview and the Product schema, so the order is a merchandising decision
    rather than a cosmetic one.
    """
    res = await db.execute(
        select(ProductImage).where(ProductImage.product_id == product_id)
    )
    images = {img.id: img for img in res.scalars().all()}

    unknown = [i for i in image_ids if i not in images]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La liste contient une image qui n appartient pas a ce produit.",
        )
    if len(image_ids) != len(images):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La liste doit contenir toutes les images du produit.",
        )

    for position, image_id in enumerate(image_ids):
        images[image_id].position = position

    await db.commit()

    ordered = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.position)
    )
    return list(ordered.scalars().all())

async def delete_product_image(db: AsyncSession, image_id: str) -> Optional[str]:
    """Deletes the row, closes the gap in the ordering, and returns the storage
    key so the caller can remove the file from the bucket."""
    res = await db.execute(select(ProductImage).where(ProductImage.id == image_id))
    image = res.scalars().first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image introuvable")

    product_id = image.product_id
    storage_key = image.storage_key
    await db.delete(image)
    await db.commit()

    # Re-pack positions so they stay a contiguous 0..n-1 sequence
    remaining = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.position)
    )
    for position, img in enumerate(remaining.scalars().all()):
        img.position = position
    await db.commit()

    return storage_key

async def delete_product(db: AsyncSession, product_id: str) -> bool:
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await db.delete(product)
    await db.commit()
    return True
