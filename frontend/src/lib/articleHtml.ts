/**
 * Article body preparation — `00-foundation/05-BLOG-SYSTEM.md` part C.6.
 *
 * Three jobs, in order:
 *   1. sanitise, because the body is author-supplied HTML
 *   2. resolve `{image:N}` tokens against `content_images`
 *   3. split at the first `</p>` so the CRO product grid lands right after the
 *      hook rather than at the end where nobody reaches it
 *
 * The backend already refuses `<script>`, `<h1>` and embedded JSON-LD at write
 * time (part F). This is the second line: a row written before those rules
 * existed, or by a future code path that forgets to validate, still cannot
 * inject anything into the page.
 */

export interface ContentImage {
  url: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
}

/** Tags allowed in an article body. Anything else is unwrapped, not escaped,
 *  so removing a stray `<div>` does not also delete the text inside it. */
const ALLOWED = new Set([
  'P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'A', 'BR',
  'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FIGURE',
  'FIGCAPTION', 'IMG', 'CODE', 'PRE', 'HR', 'SPAN', 'SMALL', 'SUP', 'SUB',
]);

/** Tags whose entire subtree is removed rather than unwrapped. */
const DROP_SUBTREE = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'H1']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'title', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan', 'scope']),
};

export function sanitizeArticleHtml(html: string): string {
  if (typeof document === 'undefined') return html;

  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;

  // Whole subtrees first, so their contents never get a chance to be unwrapped
  // back into the document.
  doc.body.querySelectorAll([...DROP_SUBTREE].join(',')).forEach((el) => el.remove());

  const walk = (node: Element) => {
    [...node.children].forEach(walk);

    if (!ALLOWED.has(node.tagName)) {
      // Unwrap: keep the text, drop the element.
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
      return;
    }

    const permitted = ALLOWED_ATTRS[node.tagName];
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const badProtocol = /^(javascript|data|vbscript):/i.test(value.replace(/\s/g, ''));
      if (name.startsWith('on') || badProtocol || !permitted?.has(name)) {
        node.removeAttribute(attr.name);
      }
    });

    // Anything pointing off-site opens safely.
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href) && !href.includes('luceamaroc.com')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  };

  [...doc.body.children].forEach(walk);
  return doc.body.innerHTML;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Replaces `{image:N}` with a real figure. The first resolved image is eager
 * because it is usually near the top; the rest are lazy.
 */
export function resolveImageTokens(html: string, images: ContentImage[]): string {
  let used = 0;
  return html.replace(/\{image:(\d+)\}/g, (_match, raw) => {
    const index = Number(raw) - 1;
    const image = images[index];
    if (!image?.url) return '';          // validation blocks this, but never render the token
    used += 1;
    const eager = used === 1;
    const alt = escapeHtml(image.alt || '');
    const title = image.title ? ` title="${escapeHtml(image.title)}"` : '';
    const caption = image.caption
      ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
      : '';
    return (
      `<figure><img src="${escapeHtml(image.url)}" alt="${alt}"${title} width="1200" height="800" ` +
      `loading="${eager ? 'eager' : 'lazy'}" decoding="${eager ? 'sync' : 'async'}">${caption}</figure>`
    );
  });
}

/** Adds stable ids to every `<h2>` so the table of contents can link to them. */
export function addHeadingIds(html: string): { html: string; toc: { id: string; text: string }[] } {
  if (typeof document === 'undefined') return { html, toc: [] };

  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;

  const toc: { id: string; text: string }[] = [];
  const seen = new Map<string, number>();

  doc.body.querySelectorAll('h2').forEach((h) => {
    const text = (h.textContent || '').trim();
    if (!text) return;
    let id = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';

    // Two identical headings would otherwise share an anchor and the second
    // would be unreachable.
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;

    h.setAttribute('id', id);
    toc.push({ id, text });
  });

  return { html: doc.body.innerHTML, toc };
}

/**
 * Splits the body after the first paragraph. Returns `[intro, rest]`; when
 * there is no closing `</p>` the whole body is the rest, so the grid still
 * renders rather than the article losing it.
 */
export function splitAfterIntro(html: string): [string, string] {
  const marker = html.indexOf('</p>');
  if (marker === -1) return ['', html];
  const cut = marker + '</p>'.length;
  return [html.slice(0, cut), html.slice(cut)];
}

export interface PreparedArticle {
  intro: string;
  rest: string;
  toc: { id: string; text: string }[];
}

export function prepareArticleBody(
  content: string,
  images: ContentImage[]
): PreparedArticle {
  const withImages = resolveImageTokens(content || '', images || []);
  const clean = sanitizeArticleHtml(withImages);
  const { html, toc } = addHeadingIds(clean);
  const [intro, rest] = splitAfterIntro(html);
  return { intro, rest, toc };
}
