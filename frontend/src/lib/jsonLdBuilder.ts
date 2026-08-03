// Schema.org builders. Every block is emitted as JSON-LD by <Seo />.

const SITE_URL = "https://luceamaroc.com";
const BRAND = "LUCEA Maroc";
const PHONE = "+212600000000";

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": BRAND,
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "description":
      "Atelier marocain de lampes et veilleuses imprimees en 3D, gravees au prenom sur demande.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Casablanca",
      "addressCountry": "MA"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": PHONE,
      "contactType": "customer service",
      "areaServed": "MA",
      "availableLanguage": ["fr", "ar"]
    }
  };
}

/** Site level block with the search action, emitted on the home page. */
export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "url": SITE_URL,
    "name": BRAND,
    "inLanguage": "fr-MA",
    "publisher": { "@id": `${SITE_URL}/#organization` },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/lampes?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildProductSchema(product: {
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  images?: any[];
  variants?: any[];
}) {
  const variants = product.variants?.length ? product.variants : [{ price_cents: 29900, stock: 10, sku: "LUC-PROD" }];
  const prices = variants.map((v: any) => v.price_cents / 100);
  const inStock = variants.some((v: any) => (v.stock ?? 0) > 0);
  const image = product.images?.[0]?.url || `${SITE_URL}/og-default.jpg`;

  const offers =
    variants.length > 1
      ? {
          "@type": "AggregateOffer",
          "priceCurrency": "MAD",
          "lowPrice": Math.min(...prices).toFixed(2),
          "highPrice": Math.max(...prices).toFixed(2),
          "offerCount": variants.length,
          "availability": inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          "url": `${SITE_URL}/products/${product.slug}`
        }
      : {
          "@type": "Offer",
          "url": `${SITE_URL}/products/${product.slug}`,
          "priceCurrency": "MAD",
          "price": prices[0].toFixed(2),
          "itemCondition": "https://schema.org/NewCondition",
          "availability": inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          "seller": { "@id": `${SITE_URL}/#organization` }
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": [image],
    "description": product.description || "Lampe imprimee en 3D au Maroc",
    "sku": variants[0].sku || "LUC-PROD",
    "brand": { "@type": "Brand", "name": product.brand || "LUCEA" },
    "offers": offers
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${SITE_URL}${item.url}`
    }))
  };
}

export function buildFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
    }))
  };
}

export function buildCollectionSchema(name: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": name,
    "description": description,
    "url": `${SITE_URL}${url}`,
    "isPartOf": { "@id": `${SITE_URL}/#website` }
  };
}

/** Product grid as an ItemList so listing pages can surface rich results. */
export function buildItemListSchema(
  products: { name: string; slug: string }[],
  listName: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "numberOfItems": products.length,
    "itemListElement": products.map((p, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": p.name,
      "url": `${SITE_URL}/products/${p.slug}`
    }))
  };
}

export function buildArticleSchema(article: {
  title: string;
  slug: string;
  content?: string;
  created_at?: string;
  updated_at?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "url": `${SITE_URL}/guides/${article.slug}`,
    "mainEntityOfPage": `${SITE_URL}/guides/${article.slug}`,
    "datePublished": article.created_at,
    "dateModified": article.updated_at || article.created_at,
    "inLanguage": "fr-MA",
    "author": { "@id": `${SITE_URL}/#organization` },
    "publisher": { "@id": `${SITE_URL}/#organization` }
  };
}
