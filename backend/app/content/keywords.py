"""Keyword ownership across guides.

Two guides targeting the same query split the signal between two of our own
URLs, so Google picks one and the other wastes its authority. This module
detects that before publication rather than after a crawl.

It is intentionally a warning, not a block: sometimes two articles legitimately
mention the same term, and the editor is better placed to judge than a string
comparison.
"""

import re
import unicodedata
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.content.models import Article

# Words that carry no targeting value, so "lampe de chevet" and "lampe chevet"
# are recognised as the same intent.
STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "d", "et", "ou", "a",
    "au", "aux", "en", "pour", "par", "sur", "avec", "sans", "dans", "que",
    "qui", "ce", "cette", "mon", "ma", "mes", "votre", "vos", "the", "of",
}


def normalise(term: str) -> str:
    """Accent and case insensitive, stopwords removed, words sorted.

    Sorting means "veilleuse bebe prenom" and "prenom veilleuse bebe" collapse
    to the same key, because they are the same search intent typed in a
    different order.
    """
    stripped = unicodedata.normalize("NFD", term)
    stripped = "".join(c for c in stripped if unicodedata.category(c) != "Mn")
    words = re.findall(r"[a-z0-9]+", stripped.lower())
    meaningful = [w for w in words if w not in STOPWORDS]
    return " ".join(sorted(meaningful or words))


def split_keywords(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [k.strip() for k in raw.split(",") if k.strip()]


def compare(a: str, b: str) -> Optional[str]:
    """Returns the match type between two keywords, or None."""
    na, nb = normalise(a), normalise(b)
    if not na or not nb:
        return None
    if na == nb:
        return "exact"

    # Containment means one query is a broader version of the other, which is
    # still a competition problem: "lampe chevet" swallows "lampe chevet bois".
    words_a, words_b = set(na.split()), set(nb.split())
    if words_a and words_b and (words_a <= words_b or words_b <= words_a):
        return "phrase"
    return None


async def find_conflicts(
    db: AsyncSession,
    keywords: str,
    exclude_article_id: Optional[str] = None,
) -> Tuple[List[dict], List[str]]:
    """Checks proposed keywords against every other article.

    Returns (conflicts, clean) where clean lists the keywords nobody else
    claims.
    """
    proposed = split_keywords(keywords)
    if not proposed:
        return [], []

    stmt = select(Article)
    if exclude_article_id:
        stmt = stmt.where(Article.id != exclude_article_id)
    articles = list((await db.execute(stmt)).scalars().all())

    conflicts: List[dict] = []
    conflicted_terms = set()

    for term in proposed:
        for article in articles:
            for existing in split_keywords(article.keywords):
                match = compare(term, existing)
                if not match:
                    continue
                conflicts.append({
                    "keyword": term,
                    "article_id": article.id,
                    "article_title": article.title,
                    "article_slug": article.slug,
                    "article_status": article.status,
                    "match": match,
                })
                conflicted_terms.add(term)
                break
            else:
                continue
            break

    clean = [t for t in proposed if t not in conflicted_terms]
    return conflicts, clean
