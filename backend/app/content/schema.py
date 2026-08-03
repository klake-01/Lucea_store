"""Server-side JSON-LD for articles — `00-foundation/05-BLOG-SYSTEM.md` part B.3.

The spec's rule is blunt and worth repeating: **the article body never emits
schema and neither does the frontend component. One place only: the server.**
Two sources of truth for structured data is how a page ends up claiming two
different publication dates, or shipping an invisible FAQ that does not match
the visible one.

The frontend receives this graph as data on the article payload and injects it
verbatim. It does not build any of it.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Iterable, Optional

from app.config import settings
from app.content.validation import strip_tags, word_count

_SLUG_SAFE = re.compile(r"[^a-z0-9]+")


def _site() -> str:
    return settings.SITE_URL.rstrip("/")


def absolute_url(path: Optional[str]) -> Optional[str]:
    """Turns a stored `/images/x.webp` into an absolute URL.

    Schema consumers reject relative image URLs, and `og:image` is ignored
    when it is not absolute.
    """
    if not path:
        return None
    if path.startswith(("http://", "https://")):
        return path
    return f"{_site()}/{path.lstrip('/')}"


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(microsecond=0).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _author_slug(name: str) -> str:
    return _SLUG_SAFE.sub("-", (name or "").lower()).strip("-") or "atelier"


def build_organization_schema() -> dict:
    site = _site()
    return {
        "@type": "Organization",
        "@id": f"{site}/#organization",
        "name": settings.BRAND_NAME,
        "url": site,
        "logo": {"@type": "ImageObject", "url": f"{site}/brand/lucea-lockup.png"},
        "areaServed": {"@type": "Country", "name": "Maroc"},
    }


def build_website_schema() -> dict:
    site = _site()
    return {
        "@type": "WebSite",
        "@id": f"{site}/#website",
        "url": site,
        "name": settings.BRAND_NAME,
        "inLanguage": "fr-MA",
        "publisher": {"@id": f"{site}/#organization"},
    }


def build_blog_schema() -> dict:
    site = _site()
    return {
        "@type": "Blog",
        "@id": f"{site}/guides#blog",
        "url": f"{site}/guides",
        "name": f"Guides et conseils {settings.BRAND_NAME}",
        "inLanguage": "fr-MA",
        "publisher": {"@id": f"{site}/#organization"},
    }


def build_product_mention(product: Any) -> Optional[dict]:
    """A `Product` node for the article's `mentions`.

    The spec's hard-won rule (B.3): a Product node without a name, or without
    `offers`, is a Google structured-data error. A product with no priced
    variant therefore yields **no node at all** rather than a broken one, and
    the price is read from the live row — never hardcoded.
    """
    name = getattr(product, "name", None)
    slug = getattr(product, "slug", None)
    if not name or not slug:
        return None

    variants = list(getattr(product, "variants", None) or [])
    priced = [v for v in variants if (getattr(v, "price_cents", 0) or 0) > 0]
    if not priced:
        return None

    cheapest = min(priced, key=lambda v: v.price_cents)
    available = any(
        max(0, (getattr(v, "stock", 0) or 0) - (getattr(v, "reserved", 0) or 0)) > 0
        for v in priced
    )
    url = f"{_site()}/products/{slug}"

    node: dict[str, Any] = {
        "@type": "Product",
        "@id": f"{url}#product",
        "name": name,
        "url": url,
        "offers": {
            "@type": "Offer",
            "price": f"{cheapest.price_cents / 100:.2f}",
            "priceCurrency": "MAD",
            "availability": "https://schema.org/InStock"
            if available
            else "https://schema.org/OutOfStock",
            "url": url,
        },
    }

    images = list(getattr(product, "images", None) or [])
    if images:
        img = absolute_url(getattr(images[0], "url", None))
        if img:
            node["image"] = img

    return node


def build_article_graph(article: Any, mentioned_products: Iterable[Any] = ()) -> list[dict]:
    """The full set of JSON-LD nodes for one article page.

    Returned as a list because the frontend writes one `<script>` per node,
    which keeps a single malformed node from invalidating the rest.
    """
    site = _site()
    url = f"{site}/guides/{article.slug}"

    author_name = (getattr(article, "author", None) or "").strip()
    if author_name:
        author = {
            "@type": "Person",
            "@id": f"{site}/#author-{_author_slug(author_name)}",
            "name": author_name,
            "url": f"{site}/a-propos",
        }
    else:
        author = {"@id": f"{site}/#organization"}

    published = _iso(getattr(article, "published_date", None)) or _iso(article.created_at)
    modified = _iso(article.updated_at) or published

    keywords = getattr(article, "seo_keywords", None) or []
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]

    blog_posting: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": f"{url}#article",
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "isPartOf": {"@id": f"{site}/guides#blog"},
        "headline": article.title,
        "description": _description_for(article),
        "author": author,
        "publisher": {"@id": f"{site}/#organization"},
        "datePublished": published,
        "dateModified": modified,
        "inLanguage": "fr-MA",
        "wordCount": word_count(article.content or ""),
        "articleSection": getattr(article, "category", None) or "",
        "speakable": {
            "@type": "SpeakableSpecification",
            "cssSelector": ["h1", "article h2"],
        },
    }

    cover = absolute_url(getattr(article, "banner_url", None))
    if cover:
        blog_posting["image"] = {
            "@type": "ImageObject",
            "url": cover,
            "caption": getattr(article, "banner_alt", None) or article.title,
        }

    if keywords:
        blog_posting["keywords"] = ", ".join(keywords)

    mentions = [n for n in (build_product_mention(p) for p in mentioned_products) if n]
    if mentions:
        blog_posting["mentions"] = mentions

    graph: list[dict] = [
        {"@context": "https://schema.org", "@graph": [
            build_organization_schema(),
            build_website_schema(),
            build_blog_schema(),
        ]},
        blog_posting,
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Accueil", "item": site},
                {"@type": "ListItem", "position": 2, "name": "Guides", "item": f"{site}/guides"},
                {"@type": "ListItem", "position": 3, "name": article.title, "item": url},
            ],
        },
    ]

    faqs = getattr(article, "faqs", None) or []
    if faqs:
        # Character identical to the visible accordion: the frontend renders
        # these very strings, so the parity contract in B.3 holds by
        # construction rather than by discipline.
        graph.append({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": f.get("question", ""),
                    "acceptedAnswer": {"@type": "Answer", "text": f.get("answer", "")},
                }
                for f in faqs
                if isinstance(f, dict)
            ],
        })

    return graph


def _description_for(article: Any) -> str:
    """Never returns an empty string.

    New articles must supply `seo_meta_description` (part F blocks a save
    without one), but rows written before that rule existed have neither it nor
    an excerpt. An empty meta description is worse than a derived one, so the
    opening prose is used as a last resort.
    """
    for candidate in (
        getattr(article, "seo_meta_description", None),
        getattr(article, "excerpt", None),
    ):
        if candidate and candidate.strip():
            return candidate.strip()

    flat = " ".join(strip_tags(article.content or "").split())
    if not flat:
        return f"{article.title} — guide {settings.BRAND_NAME}."
    return (flat[:157].rsplit(" ", 1)[0] + "…") if len(flat) > 160 else flat


def build_article_meta(article: Any) -> dict:
    """The `<head>` values, part B.2, computed once on the server."""
    site = _site()
    url = f"{site}/guides/{article.slug}"
    seo_title = getattr(article, "seo_title", None) or article.title
    description = _description_for(article)
    keywords = getattr(article, "seo_keywords", None) or []
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]

    return {
        "title": f"{seo_title} | {settings.BRAND_NAME}",
        "description": description,
        "keywords": ", ".join(keywords),
        "canonical": url,
        "robots": "index,follow" if article.status == "published" else "noindex,nofollow",
        "og_type": "article",
        "og_title": seo_title,
        "og_description": description,
        "og_image": absolute_url(getattr(article, "banner_url", None)),
        "og_url": url,
        "article_published_time": _iso(getattr(article, "published_date", None))
        or _iso(article.created_at),
        "article_modified_time": _iso(article.updated_at),
        "twitter_card": "summary_large_image",
        "read_minutes": max(1, round(word_count(article.content or "") / 200)),
    }
