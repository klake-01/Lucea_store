"""Additive schema reconciliation.

`Base.metadata.create_all` creates missing tables but never alters an existing
one, so a column added to a model after the first deployment would be missing
in the database and every query touching it would fail.

This runs the additive DDL that is safe to repeat: new nullable columns with a
default. Anything destructive (dropping or retyping a column, backfilling data)
belongs in a real Alembic migration, not here.
"""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

# table -> column -> DDL type and default
ADDITIVE_COLUMNS: dict[str, dict[str, str]] = {
    "vouchers": {
        "description": "VARCHAR",
        "min_order_cents": "INTEGER NOT NULL DEFAULT 0",
        "max_discount_cents": "INTEGER",
        "valid_from": "TIMESTAMP NOT NULL DEFAULT NOW()",
        "valid_until": "TIMESTAMP",
        "created_at": "TIMESTAMP NOT NULL DEFAULT NOW()",
        "created_by": "VARCHAR",
    },
    "product_images": {
        # Stored so the image can be removed from object storage on delete
        "storage_key": "VARCHAR",
    },
    "variants": {
        "reserved": "INTEGER NOT NULL DEFAULT 0",
    },
    "orders": {
        "stock_state": "VARCHAR NOT NULL DEFAULT 'reserved'",
    },
    "articles": {
        "banner_url": "VARCHAR",
        "banner_alt": "VARCHAR",
        "banner_storage_key": "VARCHAR",
        "keywords": "VARCHAR",
        "excerpt": "VARCHAR",
        # Blog data contract, 00-foundation/05 part A.1
        "target_keyword": "VARCHAR",
        "seo_title": "VARCHAR",
        "seo_meta_description": "VARCHAR",
        "seo_keywords": "JSON",
        "category": "VARCHAR",
        "tags": "JSON",
        "author": "VARCHAR",
        "content_images": "JSON",
        "faqs": "JSON",
        "cta": "JSON",
        "published_date": "DATE",
    },
    "products": {
        "seo_title": "VARCHAR",
        "seo_description": "VARCHAR",
        "seo_keywords": "VARCHAR",
    },
}


async def sync_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        dialect = conn.dialect.name

        # SQLite is only used by the test suite, where the tables are created
        # fresh from the models on every run and already carry every column.
        if dialect != "postgresql":
            return

        for table, columns in ADDITIVE_COLUMNS.items():
            exists = await conn.execute(
                text("SELECT to_regclass(:name)"), {"name": f"public.{table}"}
            )
            if exists.scalar() is None:
                continue

            for column, ddl in columns.items():
                await conn.execute(
                    text(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {ddl}')
                )

        logger.info("schema sync complete")
