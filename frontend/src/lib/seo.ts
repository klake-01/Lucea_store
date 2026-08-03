// Head management for LUCEA.
//
// Every route renders exactly one <Seo /> element. This module owns the head
// tags it produces so a route change replaces them rather than stacking them:
// one canonical, one title, one description, one keywords tag per page.

export const SITE_URL = 'https://luceamaroc.com';
export const SITE_NAME = 'LUCEA Maroc';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

/** Tags written by this module carry this attribute so they can be cleaned up. */
const OWNED = 'data-lucea-seo';

export interface SeoInput {
  title: string;
  description: string;
  /** Path only, for example /lampes. Query strings are stripped. */
  path: string;
  keywords?: string[];
  imageUrl?: string;
  /** Set on pages that must not be indexed, such as checkout and admin. */
  noindex?: boolean;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Trims to a length search engines will not truncate, without cutting a word. */
export function clamp(text: string, maxLength: number): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Canonical URLs are absolute, lowercase, without query string or trailing slash. */
export function canonicalFor(path: string): string {
  const clean = (path || '/').split('?')[0].split('#')[0];
  if (clean === '/' || clean === '') return `${SITE_URL}/`;
  const trimmed = clean.replace(/\/+$/, '');
  return `${SITE_URL}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute(OWNED, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export function applySeo(input: SeoInput): void {
  const title = clamp(input.title, 60);
  const description = clamp(input.description, 158);
  const canonical = canonicalFor(input.path);
  const image = input.imageUrl || DEFAULT_OG_IMAGE;

  document.title = title;

  setMeta('name', 'description', description);
  setMeta('name', 'robots', input.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

  if (input.keywords?.length) {
    setMeta('name', 'keywords', input.keywords.join(', '));
  } else {
    removeMeta('name', 'keywords');
  }

  // Canonical: exactly one per page
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    link.setAttribute(OWNED, 'true');
    document.head.appendChild(link);
  }
  link.href = canonical;

  // Open Graph
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:type', input.type === 'article' ? 'article' : 'website');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', 'fr_MA');

  // Twitter card
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  // Structured data: replace, never append, so stale schema cannot linger
  document.head.querySelectorAll(`script[${OWNED}]`).forEach((n) => n.remove());
  if (input.jsonLd) {
    const blocks = Array.isArray(input.jsonLd) ? input.jsonLd : [input.jsonLd];
    blocks.forEach((block) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(OWNED, 'true');
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    });
  }
}
