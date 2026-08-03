from datetime import date
from typing import Optional
from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.auth.dependencies import require_role
from app.auth.models import StaffUser
from app.auth.audit import record_audit
from app.content.schemas import (
    ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse,
    ArticleCard, ArticleCardListResponse, ArticleRenderResponse,
    KeywordCheckRequest, KeywordCheckResponse, ValidationResponse, SitemapEntry
)
from app.content.repository import (
    list_articles, list_all_articles, get_article_by_slug, get_article_by_id,
    create_article, update_article, delete_article,
    list_published_for_sitemap, taken_slugs, list_related
)
from app.content.models import Redirect
from app.content.keywords import find_conflicts
from app.content.validation import validate_article, read_minutes
from app.content.schema import build_article_graph, build_article_meta
from app.catalog.repository import list_products
from app.storage.service import upload_product_image, delete_image_from_storage

router = APIRouter()

@router.get("/articles", response_model=ArticleListResponse)
async def api_list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    cluster_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    items, total = await list_articles(db, page=page, limit=limit, cluster_id=cluster_id)
    return ArticleListResponse(items=items, total=total)

@router.get("/articles/{slug}", response_model=ArticleResponse)
async def api_get_article(slug: str, db: AsyncSession = Depends(get_db)):
    article = await get_article_by_slug(db, slug)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article

@router.get("/admin/articles", response_model=ArticleListResponse)
async def api_admin_list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor"))
):
    items, total = await list_all_articles(db, page=page, limit=limit)
    return ArticleListResponse(items=items, total=total)

@router.post("/admin/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def api_admin_create_article(
    payload: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor"))
):
    await _enforce_contract(db, payload.model_dump(mode="json"))
    article = await create_article(db, payload)
    await record_audit(
        db, staff_id=staff.id, action="CREATE_ARTICLE", target_table="articles",
        record_id=article.id, after_value={"slug": article.slug, "status": article.status}
    )
    return article

@router.put("/admin/articles/{article_id}", response_model=ArticleResponse)
async def api_admin_update_article(
    article_id: str,
    payload: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor"))
):
    existing = await get_article_by_id(db, article_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    before = {"slug": existing.slug, "status": existing.status}

    # Validate the row as it will look after the patch, not the patch alone:
    # a partial update can still leave the article in an invalid state.
    merged = _merged_payload(existing, payload)
    await _enforce_contract(db, merged, exclude_id=article_id)

    article = await update_article(db, article_id, payload)
    await record_audit(
        db, staff_id=staff.id, action="UPDATE_ARTICLE", target_table="articles",
        record_id=article_id, before_value=before,
        after_value={"slug": article.slug, "status": article.status}
    )
    return article

@router.delete("/admin/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_admin_delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor"))
):
    existing = await get_article_by_id(db, article_id)
    before = {"slug": existing.slug, "title": existing.title} if existing else None
    await delete_article(db, article_id)
    await record_audit(
        db, staff_id=staff.id, action="DELETE_ARTICLE", target_table="articles",
        record_id=article_id, before_value=before
    )
    return None


@router.post("/admin/articles/keyword-check", response_model=KeywordCheckResponse)
async def api_check_keywords(
    payload: KeywordCheckRequest,
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    """Warns when proposed keywords are already claimed by another guide.

    Two articles targeting one query split the signal between two of our own
    URLs. This surfaces that at writing time instead of after a crawl. It is a
    warning, never a block: the editor decides.
    """
    conflicts, clean = await find_conflicts(
        db, payload.keywords, exclude_article_id=payload.exclude_article_id
    )
    return KeywordCheckResponse(
        conflicts=conflicts,
        clean=clean,
        total_checked=len(conflicts) + len(clean),
    )


@router.post("/admin/articles/{article_id}/banner", response_model=ArticleResponse)
async def api_upload_article_banner(
    article_id: str,
    file: UploadFile = File(...),
    alt: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    """Uploads the article banner. Replacing one deletes the previous file
    rather than leaving it orphaned in the bucket."""
    article = await get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide introuvable")

    previous_key = article.banner_storage_key
    url, storage_key = await upload_product_image(file)

    article.banner_url = url
    article.banner_storage_key = storage_key
    article.banner_alt = (alt or "").strip() or article.title
    await db.commit()
    await db.refresh(article)

    if previous_key and previous_key != storage_key:
        delete_image_from_storage(previous_key)

    await record_audit(
        db, staff_id=staff.id, action="UPLOAD_ARTICLE_BANNER", target_table="articles",
        record_id=article_id, after_value={"url": url},
    )
    return article


@router.delete("/admin/articles/{article_id}/banner", response_model=ArticleResponse)
async def api_delete_article_banner(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    article = await get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide introuvable")

    key = article.banner_storage_key
    article.banner_url = None
    article.banner_alt = None
    article.banner_storage_key = None
    await db.commit()
    await db.refresh(article)

    if key:
        delete_image_from_storage(key)

    await record_audit(
        db, staff_id=staff.id, action="DELETE_ARTICLE_BANNER", target_table="articles",
        record_id=article_id,
    )
    return article


# ---------------------------------------------------------------- helpers

def _merged_payload(article, payload: ArticleUpdate) -> dict:
    """The article as it will be once the patch is applied."""
    patch = payload.model_dump(mode="json", exclude_unset=True)
    base = {
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "cluster_id": article.cluster_id,
        "status": article.status,
        "cover_image_url": article.banner_url,
        "cover_image_alt": article.banner_alt,
        "excerpt": article.excerpt,
        "target_keyword": article.target_keyword,
        "seo_title": article.seo_title,
        "seo_meta_description": article.seo_meta_description,
        "seo_keywords": article.seo_keywords or [],
        "category": article.category,
        "tags": article.tags or [],
        "author": article.author,
        "content_images": article.content_images or [],
        "faqs": article.faqs or [],
    }
    # The API names the cover fields banner_*; the contract names them cover_*.
    if "banner_url" in patch:
        base["cover_image_url"] = patch["banner_url"]
    if "banner_alt" in patch:
        base["cover_image_alt"] = patch["banner_alt"]
    base.update({k: v for k, v in patch.items() if k not in ("banner_url", "banner_alt")})
    return base


def _contract_view(payload: dict) -> dict:
    """Maps this store's field names onto the contract's names for validation."""
    view = dict(payload)
    view.setdefault("cover_image_url", payload.get("banner_url"))
    view.setdefault("cover_image_alt", payload.get("banner_alt"))
    return view


async def _enforce_contract(db: AsyncSession, payload: dict, exclude_id: str | None = None):
    """Part F, server side. The admin runs the same rules, but a client can be
    bypassed, so this is the check that actually protects the data."""
    result = validate_article(
        _contract_view(payload),
        existing_slugs=await taken_slugs(db, exclude_id=exclude_id),
    )
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Article invalide", "errors": result["errors"],
                    "warnings": result["warnings"], "stats": result["stats"]},
        )
    return result


def _to_card(article) -> ArticleCard:
    return ArticleCard(
        slug=article.slug,
        title=article.title,
        excerpt=article.excerpt,
        banner_url=article.banner_url,
        banner_alt=article.banner_alt,
        category=article.category,
        cluster_id=article.cluster_id,
        author=article.author,
        published_date=article.published_date,
        read_minutes=read_minutes(article.content or ""),
    )


# ---------------------------------------------------------------- public

@router.get("/articles-cards", response_model=ArticleCardListResponse)
async def api_list_article_cards(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    cluster_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """The blog index. Cards only, so a listing does not ship every article
    body over the wire."""
    items, total = await list_articles(db, page=page, limit=limit, cluster_id=cluster_id)
    return ArticleCardListResponse(items=[_to_card(a) for a in items], total=total)


@router.get("/articles/{slug}/render", response_model=ArticleRenderResponse)
async def api_render_article(slug: str, db: AsyncSession = Depends(get_db)):
    """Everything the article page needs, in one request.

    Part B.2 and B.3 place meta and JSON-LD on the server. This store serves a
    static SPA rather than server rendered HTML, so the server computes them
    here and the frontend injects them verbatim, at runtime and again at
    prerender time. The rule the spec actually cares about is upheld: the
    schema has exactly one author, and it is not the client.
    """
    article = await get_article_by_slug(db, slug)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # The CRO grid and the schema `mentions` must describe the same products,
    # so both are built from this one query.
    products, _ = await list_products(db, page=1, limit=4, category_slug=article.cluster_id)
    if not products:
        products, _ = await list_products(db, page=1, limit=4)

    product_payload = []
    for p in products:
        variants = sorted(
            [v for v in (p.variants or []) if (v.price_cents or 0) > 0],
            key=lambda v: v.price_cents,
        )
        product_payload.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "images": [{"url": i.url, "alt": i.alt} for i in (p.images or [])][:1],
            "variants": [{
                "id": v.id,
                "price_cents": v.price_cents,
                "available": max(0, (v.stock or 0) - (v.reserved or 0)),
            } for v in variants[:1]],
        })

    related = await list_related(db, article, limit=4)

    return ArticleRenderResponse(
        article=article,
        meta=build_article_meta(article),
        json_ld=build_article_graph(article, products),
        related=[_to_card(a) for a in related],
        products=product_payload,
    )


@router.get("/articles-sitemap", response_model=list[SitemapEntry])
async def api_article_sitemap(db: AsyncSession = Depends(get_db)):
    """Part B.4. Published articles only, de-duplicated by slug, so a draft can
    never reach the sitemap."""
    rows = await list_published_for_sitemap(db)
    site = settings.SITE_URL.rstrip("/")
    seen: set[str] = set()
    entries: list[SitemapEntry] = []
    for a in rows:
        if a.slug in seen:
            continue
        if any(a.slug.startswith(prefix) for prefix in ("test-", "tmp-", "demo-", "draft-")):
            continue
        seen.add(a.slug)
        entries.append(SitemapEntry(
            loc=f"{site}/guides/{a.slug}",
            lastmod=(a.updated_at or a.created_at).date().isoformat(),
        ))
    return entries


# ---------------------------------------------------------------- admin

@router.post("/admin/articles/validate", response_model=ValidationResponse)
async def api_validate_article(
    payload: dict,
    exclude_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: StaffUser = Depends(require_role("editor")),
):
    """Part F, called by the admin's Validate button. Returns errors, warnings
    and stats without touching the database."""
    return validate_article(
        _contract_view(payload),
        existing_slugs=await taken_slugs(db, exclude_id=exclude_id),
    )


@router.post("/admin/articles/{article_id}/publish", response_model=ArticleResponse)
async def api_publish_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    staff: StaffUser = Depends(require_role("editor")),
):
    """Flips draft to published and back.

    Publishing re-runs the contract: an article can be saved as a draft while
    still incomplete, but it cannot go live that way.
    """
    article = await get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    going_live = article.status != "published"
    if going_live:
        await _enforce_contract(db, _merged_payload(article, ArticleUpdate()), exclude_id=article_id)

    article.status = "published" if going_live else "draft"
    if going_live and not article.published_date:
        article.published_date = date.today()

    await db.commit()
    await db.refresh(article)
    await record_audit(
        db, staff_id=staff.id, action="PUBLISH_ARTICLE", target_table="articles",
        record_id=article_id, after_value={"slug": article.slug, "status": article.status},
    )
    return article


@router.get("/redirects")
async def api_list_redirects(db: AsyncSession = Depends(get_db)):
    """Every permanent redirect, public because it carries no private data.

    Part E.3 requires an old URL to 301 rather than 404. Rows are written by
    the slug rename path; this endpoint is what lets them actually be served:
    the build step bakes them into the edge config, and the 404 page consults
    it at runtime so a redirect added since the last build still resolves.
    """
    from sqlalchemy.future import select as _select
    rows = (await db.execute(_select(Redirect))).scalars().all()
    return [
        {"source": r.source_url, "target": r.target_url, "status": int(r.status_code or 301)}
        for r in rows
    ]
