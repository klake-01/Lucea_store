from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.catalog.models import Product, Category
from app.search.service import search_products

router = APIRouter()

@router.get("", response_model=List[Dict[str, Any]])
async def search(
    q: str = Query(..., min_length=1),
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=60),
    db: AsyncSession = Depends(get_db)
):
    # Try Meilisearch first
    results = search_products(query=q, category=category, limit=limit)
    if results:
        return results

    # Fallback to DB ILIKE search if Meilisearch returned empty or offline
    stmt = select(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images)
    ).where(Product.status == "published")

    stmt = stmt.where(
        (Product.name.ilike(f"%{q}%")) | (Product.description.ilike(f"%{q}%"))
    )

    if category:
        stmt = stmt.join(Product.categories).where(Category.slug == category)

    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    products = res.scalars().all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "price_cents": p.variants[0].price_cents if p.variants else 0,
            "image_url": p.images[0].url if p.images else None
        }
        for p in products
    ]
