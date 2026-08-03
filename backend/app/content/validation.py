"""Article JSON validation — `00-foundation/05-BLOG-SYSTEM.md` part F.

The same rules run in two places: the admin calls this over HTTP before it
lets an author save, and the create/update endpoints call it again before they
persist. The second call is the one that matters — the first is only a
courtesy, because a client can always be bypassed.

Errors block the save. Warnings are reported and allowed through, because they
are editorial judgement calls rather than broken data.
"""

from __future__ import annotations

import re
from typing import Any, Optional

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Fields the contract marks REQUIRED in part A.1.
REQUIRED_FIELDS = (
    "title",
    "slug",
    "target_keyword",
    "seo_title",
    "seo_meta_description",
    "seo_keywords",
    "category",
    "excerpt",
    "cover_image_url",
    "cover_image_alt",
    "content",
    "faqs",
)

MIN_KEYWORDS = 3
MIN_FAQS = 4

# Warning thresholds, part F.
SEO_TITLE_MAX = 60
META_MIN, META_MAX = 70, 160
MIN_H2 = 3
MIN_WORDS = 800

_TAG_RE = re.compile(r"<[^>]+>")
_H2_RE = re.compile(r"<h2[\s>]", re.I)
_H1_RE = re.compile(r"<h1[\s>]", re.I)
_SCRIPT_RE = re.compile(r"<script[\s>]", re.I)
_LDJSON_RE = re.compile(r"application/ld\+json", re.I)
_DOC_RE = re.compile(r"<(?:html|head|body)[\s>]", re.I)
_PERCENT_RE = re.compile(r"\b\d{1,3}\s?%")
_EXTERNAL_HREF_RE = re.compile(r'href=["\']https?://([^/"\']+)', re.I)
_IMG_RE = re.compile(r"<img[\s>]", re.I)
_TOKEN_RE = re.compile(r"\{image:(\d+)\}")


def strip_tags(html: str) -> str:
    return _TAG_RE.sub(" ", html or "")


def word_count(html: str) -> int:
    return len([w for w in strip_tags(html).split() if w.strip()])


def read_minutes(html: str) -> int:
    """Reading time at 200 words per minute, floored at one minute."""
    return max(1, round(word_count(html) / 200))


def _is_str_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(v, str) and v.strip() for v in value)


def validate_article(
    data: dict,
    *,
    existing_slugs: Optional[set[str]] = None,
    site_host: str = "luceamaroc.com",
) -> dict:
    """Returns `{ok, errors, warnings, stats}`.

    `existing_slugs` is the set of slugs already taken by *other* articles, so
    uniqueness can be checked without this module knowing about the database.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return {
            "ok": False,
            "errors": ["Le JSON doit être un objet."],
            "warnings": [],
            "stats": {"words": 0, "h2": 0, "faqs": 0, "images": 0, "read_minutes": 0},
        }

    # ---- hard error 1: required fields --------------------------------
    for field in REQUIRED_FIELDS:
        value = data.get(field)
        missing = value is None or (isinstance(value, str) and not value.strip())
        if missing or (isinstance(value, list) and len(value) == 0):
            errors.append(f"Champ obligatoire manquant ou vide : {field}")

    # ---- hard error 2: slug shape and uniqueness ----------------------
    slug = (data.get("slug") or "").strip()
    if slug and not SLUG_RE.match(slug):
        errors.append(
            "slug invalide : minuscules, chiffres et tirets uniquement "
            "(ex. choisir-lampe-bureau-guide)."
        )
    if slug and existing_slugs and slug in existing_slugs:
        errors.append(f"slug déjà utilisé par un autre article : {slug}")

    # ---- hard error 3: keywords ---------------------------------------
    kw = data.get("seo_keywords")
    if kw is not None:
        if not _is_str_list(kw):
            errors.append("seo_keywords doit être une liste de chaînes non vides.")
        elif len(kw) < MIN_KEYWORDS:
            errors.append(f"seo_keywords doit contenir au moins {MIN_KEYWORDS} entrées.")

    # ---- hard error 4: FAQs -------------------------------------------
    faqs = data.get("faqs")
    if faqs is not None:
        if not isinstance(faqs, list):
            errors.append("faqs doit être une liste.")
        else:
            if len(faqs) < MIN_FAQS:
                errors.append(f"faqs doit contenir au moins {MIN_FAQS} entrées.")
            for i, entry in enumerate(faqs, start=1):
                if not isinstance(entry, dict):
                    errors.append(f"faqs[{i}] doit être un objet {{question, answer}}.")
                    continue
                if not (entry.get("question") or "").strip():
                    errors.append(f"faqs[{i}] : question manquante.")
                if not (entry.get("answer") or "").strip():
                    errors.append(f"faqs[{i}] : réponse manquante.")

    # ---- hard error 5: forbidden markup in the body -------------------
    content = data.get("content") or ""
    if _H1_RE.search(content):
        errors.append("content ne doit pas contenir de <h1> : le titre de la page est le champ title.")
    if _SCRIPT_RE.search(content):
        errors.append("content ne doit pas contenir de <script>.")
    if _LDJSON_RE.search(content):
        errors.append(
            "content ne doit pas contenir de JSON-LD : le balisage est généré par le serveur."
        )
    if _DOC_RE.search(content):
        errors.append("content ne doit pas contenir <html>, <head> ou <body>.")

    # ---- image tokens must resolve ------------------------------------
    images = data.get("content_images") or []
    if not isinstance(images, list):
        errors.append("content_images doit être une liste.")
        images = []
    tokens = [int(n) for n in _TOKEN_RE.findall(content)]
    for n in sorted(set(tokens)):
        if n < 1 or n > len(images):
            errors.append(
                f"Le jeton {{image:{n}}} ne correspond à aucune entrée de content_images "
                f"({len(images)} disponible(s))."
            )
    for i, img in enumerate(images, start=1):
        if not isinstance(img, dict) or not (img.get("url") or "").strip():
            errors.append(f"content_images[{i}] : url manquante.")
        elif not (img.get("alt") or "").strip():
            warnings.append(f"content_images[{i}] : alt manquant, mauvais pour l'accessibilité et le SEO.")

    # ---- warnings ------------------------------------------------------
    seo_title = data.get("seo_title") or ""
    if len(seo_title) > SEO_TITLE_MAX:
        warnings.append(
            f"seo_title fait {len(seo_title)} caractères, viser {SEO_TITLE_MAX} maximum "
            "pour éviter la troncature dans Google."
        )

    meta = data.get("seo_meta_description") or ""
    if meta and not (META_MIN <= len(meta) <= META_MAX):
        warnings.append(
            f"seo_meta_description fait {len(meta)} caractères, viser {META_MIN} à {META_MAX}."
        )

    h2_count = len(_H2_RE.findall(content))
    if h2_count < MIN_H2:
        warnings.append(f"Seulement {h2_count} section(s) <h2>, viser au moins {MIN_H2}.")

    words = word_count(content)
    if words < MIN_WORDS:
        warnings.append(f"{words} mots, viser au moins {MIN_WORDS} pour un guide de fond.")

    if _IMG_RE.search(content):
        warnings.append(
            "content contient une balise <img> brute. Utilisez les jetons {image:N} "
            "pour que les images soient dimensionnées et optimisées par le rendu."
        )

    for host in set(_EXTERNAL_HREF_RE.findall(content)):
        if site_host not in host:
            warnings.append(f"Lien externe vers {host} : vérifiez que la source est fiable.")

    percentages = _PERCENT_RE.findall(content)
    if percentages:
        warnings.append(
            f"Pourcentages précis détectés ({', '.join(sorted(set(percentages))[:5])}). "
            "Sourcez-les ou reformulez qualitativement : pas de statistique inventée."
        )

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "words": words,
            "h2": h2_count,
            "faqs": len(faqs) if isinstance(faqs, list) else 0,
            "images": len(images),
            "read_minutes": read_minutes(content),
        },
    }
