// Build-time bridge to the blog API.
//
// `00-foundation/05-BLOG-SYSTEM.md` parts B.2 and B.4 put the article meta,
// the JSON-LD graph and the sitemap entries on the server. This store serves a
// static SPA, so the build asks the API for exactly those values and bakes
// them into the shell — the server stays the single author of the schema, and
// a crawler with no JavaScript still gets the full head.
//
// Behaviour when the API cannot be reached depends on whether one was
// configured:
//
//   BLOG_API_URL set    -> the build FAILS. A hosted build (Vercel) that
//                          quietly ships articles with no schema and a sitemap
//                          with no article URLs is a silent SEO regression on
//                          every deploy.
//   BLOG_API_URL unset  -> warn and continue. Building locally with no backend
//                          running is normal.

const CONFIGURED = Boolean(process.env.BLOG_API_URL);
const API_BASE = process.env.BLOG_API_URL || 'http://localhost:8000/api/v1';

export interface PrerenderedArticle {
  slug: string;
  meta: Record<string, any>;
  jsonLd: Record<string, unknown>[];
  lastmod: string;
}

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Published articles with their server-built meta and schema. */
export async function fetchPublishedArticles(): Promise<PrerenderedArticle[]> {
  const entries = await getJson('/articles-sitemap');
  if (!Array.isArray(entries) || entries.length === 0) {
    if (entries === null) {
      const message =
        `Blog API unreachable at ${API_BASE}. Article pages would ship the ` +
        `generic shell with no article schema, and the sitemap would lose ` +
        `every article URL.`;

      // Two different situations, two different severities.
      //
      // BLOG_API_URL set  -> someone configured a backend and it is down or
      //                      wrong. Shipping a silently degraded site from a
      //                      hosted build (Vercel) is worse than failing, so
      //                      the build stops.
      // BLOG_API_URL unset -> a local build with no backend running. That is a
      //                      normal thing to do; warn and carry on.
      if (CONFIGURED) {
        throw new Error(
          `${message}
` +
          `  BLOG_API_URL is set, so this is a broken deploy rather than a ` +
          `local build. Fix the API or unset BLOG_API_URL to build without ` +
          `articles deliberately.`
        );
      }
      console.warn(`  ! ${message}`);
      console.warn(
        `  ! BLOG_API_URL is not set. Set it to the public API origin ` +
        `(for example https://api.luceamaroc.com/api/v1) in the build ` +
        `environment to prerender articles.`
      );
    }
    return [];
  }

  const out: PrerenderedArticle[] = [];
  for (const entry of entries) {
    const slug = String(entry.loc).split('/guides/')[1];
    if (!slug) continue;

    const payload = await getJson(`/articles/${slug}/render`);
    if (!payload?.meta) {
      console.warn(`  ! Could not render /guides/${slug}, skipping its meta.`);
      continue;
    }

    // A draft must never reach the shell as indexable, and it should never
    // have appeared in the sitemap either. Belt and braces.
    if (String(payload.meta.robots || '').startsWith('noindex')) continue;

    out.push({
      slug,
      meta: payload.meta,
      jsonLd: payload.json_ld || [],
      lastmod: entry.lastmod,
    });
  }

  console.log(`  Fetched ${out.length} published article(s) from the blog API.`);
  return out;
}

/** Permanent redirects, so an old article URL can be served at the edge. */
export async function fetchRedirects(): Promise<{ source: string; target: string; status: number }[]> {
  const rows = await getJson('/redirects');
  return Array.isArray(rows) ? rows : [];
}
