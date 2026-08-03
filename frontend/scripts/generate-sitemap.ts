import fs from 'fs';
import path from 'path';
import { getAllRoutes } from '../src/lib/seoStrategy';

const SITE_URL = "https://luceamaroc.com";

export interface ExtraEntry { loc: string; lastmod: string; }

export function generateSitemapXml(extra: ExtraEntry[] = []): string {
  const routes = getAllRoutes();
  const today = new Date().toISOString().split("T")[0];

  const urlElements = routes.map((route) => {
    let priority = "0.8";
    let changefreq = "weekly";

    if (route === "/") {
      priority = "1.0";
      changefreq = "daily";
    } else if (route === "/lampes") {
      priority = "0.9";
      changefreq = "daily";
    } else if (route.startsWith("/lampe-") || route.startsWith("/pro-")) {
      priority = "0.9";
      changefreq = "weekly";
    }

    return `  <url>
    <loc>${SITE_URL}${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  // Published articles, straight from the API. Drafts never reach this list
  // because the endpoint filters them out (00-foundation/05 part B.4), and a
  // slug is de-duplicated here in case a static route already claimed it.
  const seen = new Set(routes.map((r) => `${SITE_URL}${r}`));
  const articleElements = extra
    .filter((e) => !seen.has(e.loc))
    .map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);

  // The namespace must be the sitemaps.org one. Search Console rejects the
  // sitemapindex URI that was declared here previously.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urlElements, ...articleElements].join("\n")}
</urlset>`;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Transactional and private areas carry no search value
Disallow: /admin
Disallow: /admin/
Disallow: /checkout
Disallow: /order-success/
Disallow: /*?q=

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function writeSitemapToPublic(extra: ExtraEntry[] = []) {
  const xml = generateSitemapXml(extra);
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt(), 'utf8');
  console.log(
    `Generated sitemap.xml with ${getAllRoutes().length + extra.length} URLs ` +
    `(${extra.length} article(s)) and robots.txt.`
  );
}

if (process.argv[1] && process.argv[1].includes('generate-sitemap')) {
  writeSitemapToPublic();
}
