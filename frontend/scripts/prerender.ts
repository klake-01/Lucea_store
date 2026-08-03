// Build step: writes a static HTML shell per route with its own title,
// description, keywords, canonical and JSON-LD, so crawlers get the metadata
// without executing the app. The runtime <Seo /> component keeps the same tags
// in sync during client side navigation.

import fs from 'fs';
import path from 'path';
import { getAllRoutes, CLUSTERS } from '../src/lib/seoStrategy';
import {
  HOME_SEO, HUB_SEO, GUIDES_SEO, TRACKING_SEO, STATIC_SEO, clusterSeo, PageSeo
} from '../src/lib/pageSeo';
import {
  buildOrganizationSchema, buildWebSiteSchema, buildCollectionSchema, buildFAQSchema
} from '../src/lib/jsonLdBuilder';
import { writeSitemapToPublic } from './generate-sitemap';
import { fetchPublishedArticles, fetchRedirects, PrerenderedArticle } from './blogRoutes';

const SITE_URL = 'https://luceamaroc.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface RouteMeta {
  seo: PageSeo;
  jsonLd: Record<string, unknown>[];
}

function metaForRoute(route: string): RouteMeta {
  if (route === '/') {
    return {
      seo: HOME_SEO,
      jsonLd: [buildOrganizationSchema(), buildWebSiteSchema()],
    };
  }

  if (route === '/lampes') {
    return {
      seo: HUB_SEO,
      jsonLd: [buildCollectionSchema('Catalogue LUCEA', HUB_SEO.description, route)],
    };
  }

  if (route === '/guides') {
    return {
      seo: GUIDES_SEO,
      jsonLd: [buildCollectionSchema('Guides LUCEA', GUIDES_SEO.description, route)],
    };
  }

  const cluster = CLUSTERS.find((c) => c.moneyPageUrl === route);
  if (cluster) {
    const seo = clusterSeo(cluster);
    return {
      seo,
      jsonLd: [
        buildCollectionSchema(cluster.name, seo.description, route),
        buildFAQSchema(cluster.faqs),
      ],
    };
  }

  if (route === '/suivi-commande') {
    return { seo: TRACKING_SEO, jsonLd: [buildOrganizationSchema()] };
  }

  if (STATIC_SEO[route]) {
    return { seo: STATIC_SEO[route], jsonLd: [buildOrganizationSchema()] };
  }

  // Guide detail pages: the body is fetched at runtime, the shell carries the
  // route specific canonical so the URL is indexable on its own.
  if (route.startsWith('/guides/')) {
    const slug = route.replace('/guides/', '');
    const title = slug.replace(/-/g, ' ');
    return {
      seo: {
        title: `${title.charAt(0).toUpperCase()}${title.slice(1)} | LUCEA Maroc`.slice(0, 60),
        description: GUIDES_SEO.description,
        keywords: GUIDES_SEO.keywords,
      },
      jsonLd: [buildOrganizationSchema()],
    };
  }

  return { seo: HOME_SEO, jsonLd: [buildOrganizationSchema()] };
}

async function prerender() {
  console.log('Prerendering LUCEA routes');

  // Published articles come first: the sitemap needs their URLs and the
  // shells need the meta the server computed for them.
  const articles = await fetchPublishedArticles();

  writeSitemapToPublic(articles.map((a) => ({ loc: `${SITE_URL}/guides/${a.slug}`, lastmod: a.lastmod })));

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    console.warn('dist/index.html not found, run vite build first.');
    return;
  }

  const templateHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const routes = getAllRoutes();
  let renderedCount = 0;

  routes.forEach((route) => {
    const { seo, jsonLd } = metaForRoute(route);
    const canonical = route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}`;

    let html = templateHtml;

    // Replace the defaults instead of appending, so no page ends up with two
    // canonicals or two descriptions.
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(seo.title)}</title>`);
    html = html.replace(
      /<meta\s+name="description"[\s\S]*?\/>/i,
      `<meta name="description" content="${escapeAttr(seo.description)}" />`
    );
    html = html.replace(
      /<meta\s+name="keywords"[\s\S]*?\/>/i,
      `<meta name="keywords" content="${escapeAttr(seo.keywords.join(', '))}" />`
    );
    html = html.replace(
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${canonical}" />`
    );

    const injected = `
    <meta property="og:title" content="${escapeAttr(seo.title)}" />
    <meta property="og:description" content="${escapeAttr(seo.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta name="twitter:title" content="${escapeAttr(seo.title)}" />
    <meta name="twitter:description" content="${escapeAttr(seo.description)}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
${jsonLd.map((block) => `    <script type="application/ld+json">${JSON.stringify(block)}</script>`).join('\n')}
`;

    html = html.replace('</head>', `${injected}</head>`);

    const targetDir = route === '/' ? distDir : path.join(distDir, route);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
    renderedCount++;
  });


  // ---- article shells -------------------------------------------------
  // Meta and JSON-LD are used exactly as the API returned them. Part B.3
  // allows one author for the schema and it is the server, so nothing is
  // rebuilt here.
  articles.forEach((article: PrerenderedArticle) => {
    const meta = article.meta;
    const canonical = meta.canonical || `${SITE_URL}/guides/${article.slug}`;
    let html = templateHtml;

    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(meta.title || '')}</title>`);
    html = html.replace(
      /<meta\s+name="description"[\s\S]*?\/>/i,
      `<meta name="description" content="${escapeAttr(meta.description || '')}" />`
    );
    html = html.replace(
      /<meta\s+name="keywords"[\s\S]*?\/>/i,
      `<meta name="keywords" content="${escapeAttr(meta.keywords || '')}" />`
    );
    html = html.replace(
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${canonical}" />`
    );

    // The shell ships a default robots tag, so this replaces it. Appending
    // would leave two, and a crawler is entitled to obey either one.
    html = html.replace(
      /<meta\s+name="robots"[^>]*>/i,
      `<meta name="robots" content="${escapeAttr(meta.robots || 'index,follow')}" />`
    );

    const image = meta.og_image || DEFAULT_IMAGE;
    const injected = `
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeAttr(meta.og_title || meta.title || '')}" />
    <meta property="og:description" content="${escapeAttr(meta.og_description || meta.description || '')}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="article:published_time" content="${escapeAttr(meta.article_published_time || '')}" />
    <meta property="article:modified_time" content="${escapeAttr(meta.article_modified_time || '')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(meta.og_title || meta.title || '')}" />
    <meta name="twitter:description" content="${escapeAttr(meta.og_description || meta.description || '')}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
${article.jsonLd.map((block) => `    <script type="application/ld+json">${JSON.stringify(block)}</script>`).join('\n')}
`;

    html = html.replace('</head>', `${injected}</head>`);

    const targetDir = path.join(distDir, 'guides', article.slug);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
    renderedCount += 1;
  });

  const redirects = await fetchRedirects();
  let redirectsConf = '';
  for (const r of redirects) {
    const status = r.status || 301;
    const modifier = status === 301 ? 'permanent' : 'redirect';
    redirectsConf += `rewrite ^${r.source}/?$ ${r.target} ${modifier};\n`;
  }
  if (redirectsConf) {
    fs.writeFileSync(path.join(distDir, 'redirects.conf'), redirectsConf, 'utf8');
    console.log(`Wrote redirects.conf with ${redirects.length} rules.`);
  }

  console.log(`Prerendered ${renderedCount} routes into dist.`);
}

prerender().catch((err) => {
  console.error(err);
  process.exit(1);
});
