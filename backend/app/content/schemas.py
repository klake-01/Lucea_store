from datetime import datetime, date
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, field_validator


class ContentImage(BaseModel):
    url: str
    alt: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None


class ArticleFaq(BaseModel):
    question: str
    answer: str


class ArticleCta(BaseModel):
    category: Optional[str] = None
    link: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class ArticleBase(BaseModel):
    title: str
    slug: str
    content: str
    cluster_id: str
    status: str = "published" # draft, review, published
    banner_url: Optional[str] = None
    banner_alt: Optional[str] = None
    keywords: Optional[str] = None   # comma separated, legacy overlap check
    excerpt: Optional[str] = None

    # Blog data contract, 00-foundation/05 part A.1
    target_keyword: Optional[str] = None
    seo_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_keywords: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    author: Optional[str] = None
    content_images: List[ContentImage] = Field(default_factory=list)
    faqs: List[ArticleFaq] = Field(default_factory=list)
    cta: Optional[ArticleCta] = None
    published_date: Optional[date] = None


    # Rows written before these columns existed hold NULL, and NULL is not a
    # list. Coercing here means the backfill is a read time detail rather than
    # a migration that has to touch every historical row.
    @field_validator("seo_keywords", "tags", "content_images", "faqs", mode="before")
    @classmethod
    def _null_is_empty(cls, v):
        return [] if v is None else v


class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    cluster_id: Optional[str] = None
    status: Optional[str] = None
    banner_url: Optional[str] = None
    banner_alt: Optional[str] = None
    keywords: Optional[str] = None
    excerpt: Optional[str] = None
    target_keyword: Optional[str] = None
    seo_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_keywords: Optional[List[str]] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    content_images: Optional[List[ContentImage]] = None
    faqs: Optional[List[ArticleFaq]] = None
    cta: Optional[ArticleCta] = None
    published_date: Optional[date] = None

class ArticleResponse(ArticleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArticleRenderResponse(BaseModel):
    """The public article payload.

    `meta` and `json_ld` are computed on the server and injected verbatim by
    the frontend. Part B.3 is explicit that schema has exactly one source, so
    the client must never rebuild any of this.
    """
    article: ArticleResponse
    meta: Dict[str, Any]
    json_ld: List[Dict[str, Any]]
    related: List["ArticleCard"] = Field(default_factory=list)
    products: List[Dict[str, Any]] = Field(default_factory=list)


class ArticleCard(BaseModel):
    """The listing shape: everything a card needs, nothing more."""
    slug: str
    title: str
    excerpt: Optional[str] = None
    banner_url: Optional[str] = None
    banner_alt: Optional[str] = None
    category: Optional[str] = None
    cluster_id: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[date] = None
    read_minutes: int = 1

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    items: List[ArticleResponse]
    total: int


class ArticleCardListResponse(BaseModel):
    items: List[ArticleCard]
    total: int


class ValidationStats(BaseModel):
    words: int
    h2: int
    faqs: int
    images: int
    read_minutes: int


class ValidationResponse(BaseModel):
    ok: bool
    errors: List[str]
    warnings: List[str]
    stats: ValidationStats


class SitemapEntry(BaseModel):
    loc: str
    lastmod: str


ArticleRenderResponse.model_rebuild()


class KeywordConflict(BaseModel):
    """One keyword already claimed by another article."""
    keyword: str
    article_id: str
    article_title: str
    article_slug: str
    article_status: str
    # exact  -> the same keyword string
    # phrase -> one keyword contains the other, so the intent overlaps
    match: str


class KeywordCheckRequest(BaseModel):
    keywords: str                       # comma separated
    exclude_article_id: Optional[str] = None


class KeywordCheckResponse(BaseModel):
    conflicts: List[KeywordConflict] = []
    # Keywords already used elsewhere on the site, for a quick count
    total_checked: int = 0
    clean: List[str] = []
