from datetime import date
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi import HTTPException, status

from app.content.models import Article, Redirect
from app.content.schemas import ArticleCreate, ArticleUpdate

# Fields carried straight from the payload onto the row. Kept as one tuple so
# create and update cannot drift apart and silently drop a field on one path.
CONTRACT_FIELDS = (
    "title", "content", "cluster_id", "status",
    "banner_url", "banner_alt", "keywords", "excerpt",
    "target_keyword", "seo_title", "seo_meta_description", "seo_keywords",
    "category", "tags", "author", "content_images", "faqs", "cta",
    "published_date",
)

# The JSON columns hold plain dicts, not pydantic models.
_MODEL_LIST_FIELDS = ("content_images", "faqs")


def _plain(field: str, value):
    if value is None:
        return None
    if field in _MODEL_LIST_FIELDS:
        return [v.model_dump() if hasattr(v, "model_dump") else v for v in value]
    if field == "cta" and hasattr(value, "model_dump"):
        return value.model_dump()
    return value

async def list_articles(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    cluster_id: Optional[str] = None
) -> Tuple[List[Article], int]:
    offset = (page - 1) * limit
    query = select(Article).where(Article.status == "published")
    if cluster_id:
        query = query.where(Article.cluster_id == cluster_id)

    count_q = select(func.count(Article.id)).where(Article.status == "published")
    if cluster_id:
        count_q = count_q.where(Article.cluster_id == cluster_id)

    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(Article.created_at.desc()).offset(offset).limit(limit)

    articles = (await db.execute(query)).scalars().all()
    return list(articles), total

async def list_all_articles(
    db: AsyncSession,
    page: int = 1,
    limit: int = 50
) -> Tuple[List[Article], int]:
    """Admin listing: returns drafts and published articles alike."""
    offset = (page - 1) * limit
    total = (await db.execute(select(func.count(Article.id)))).scalar() or 0
    query = select(Article).order_by(Article.created_at.desc()).offset(offset).limit(limit)
    articles = (await db.execute(query)).scalars().all()
    return list(articles), total

async def get_article_by_id(db: AsyncSession, article_id: str) -> Optional[Article]:
    res = await db.execute(select(Article).where(Article.id == article_id))
    return res.scalars().first()

async def update_article(db: AsyncSession, article_id: str, article_in: ArticleUpdate) -> Article:
    article = await get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    was_published = article.status == "published"
    old_slug = article.slug

    if article_in.slug is not None and article_in.slug != article.slug:
        clash = await get_article_by_slug(db, article_in.slug)
        if clash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Article slug already exists")
        article.slug = article_in.slug

        # Part E.3: a published URL that changes must not start returning 404.
        # The redirect is written in the same transaction as the rename, so the
        # two can never disagree.
        if was_published:
            source = f"/guides/{old_slug}"
            existing = (
                await db.execute(select(Redirect).where(Redirect.source_url == source))
            ).scalars().first()
            if existing:
                existing.target_url = f"/guides/{article.slug}"
                existing.status_code = "301"
            else:
                db.add(Redirect(
                    source_url=source,
                    target_url=f"/guides/{article.slug}",
                    status_code="301",
                ))

            # A redirect chain is a crawl-budget leak: anything that pointed at
            # the old slug is repointed at the new destination directly.
            chained = (
                await db.execute(select(Redirect).where(Redirect.target_url == source))
            ).scalars().all()
            for row in chained:
                row.target_url = f"/guides/{article.slug}"

    for field in CONTRACT_FIELDS:
        value = getattr(article_in, field, None)
        if value is not None:
            setattr(article, field, _plain(field, value))

    if article.status == "published" and not article.published_date:
        article.published_date = date.today()

    await db.commit()
    await db.refresh(article)
    return article

async def delete_article(db: AsyncSession, article_id: str) -> bool:
    article = await get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return True

async def get_article_by_slug(db: AsyncSession, slug: str) -> Optional[Article]:
    res = await db.execute(select(Article).where(Article.slug == slug))
    return res.scalars().first()

async def create_article(db: AsyncSession, article_in: ArticleCreate) -> Article:
    existing = await get_article_by_slug(db, article_in.slug)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Article slug already exists")

    article = Article(slug=article_in.slug)
    for field in CONTRACT_FIELDS:
        setattr(article, field, _plain(field, getattr(article_in, field, None)))

    # Publishing without a date would leave datePublished empty in the schema.
    if article.status == "published" and not article.published_date:
        article.published_date = date.today()

    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


async def list_published_for_sitemap(db: AsyncSession) -> List[Article]:
    """Published articles only, newest first.

    Part B.4 and E.2: a draft is never listed, and every listed URL is one that
    returns a self referencing canonical.
    """
    rows = await db.execute(
        select(Article)
        .where(Article.status == "published")
        .order_by(Article.published_date.desc().nullslast(), Article.created_at.desc())
    )
    return list(rows.scalars().all())


async def taken_slugs(db: AsyncSession, exclude_id: Optional[str] = None) -> set:
    """Slugs held by other articles, for the uniqueness rule in part F."""
    query = select(Article.slug)
    if exclude_id:
        query = query.where(Article.id != exclude_id)
    rows = await db.execute(query)
    return {row for row in rows.scalars().all()}


async def list_related(
    db: AsyncSession, article: Article, limit: int = 4
) -> List[Article]:
    """Siblings for the related block, part C.9 and E.1.

    Same cluster first, then anything else published, so a young blog still
    fills the block instead of rendering an empty section.
    """
    same = (await db.execute(
        select(Article)
        .where(
            Article.status == "published",
            Article.cluster_id == article.cluster_id,
            Article.id != article.id,
        )
        .order_by(Article.created_at.desc())
        .limit(limit)
    )).scalars().all()

    if len(same) >= limit:
        return list(same)

    seen = {a.id for a in same} | {article.id}
    filler = (await db.execute(
        select(Article)
        .where(Article.status == "published", Article.id.notin_(seen))
        .order_by(Article.created_at.desc())
        .limit(limit - len(same))
    )).scalars().all()

    return list(same) + list(filler)
