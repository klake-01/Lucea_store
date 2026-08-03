// Product page SEO.
//
// Every product must ship a title, a description and a keyword set even when
// nobody filled the optional fields in the admin. This module derives them
// from what the product already has: its name, description, category and
// variant sizes. Admin overrides always win.
//
// Keyword ownership rule (02-architecture/03): a product page targets a long
// tail built from its own name, never the head query owned by the money page
// of its cluster. That is why the cluster's primaryKeywords are not copied
// here, only its category vocabulary.

import { CLUSTERS } from './seoStrategy';
import { clamp } from './seo';

export interface ProductSeo {
  title: string;
  description: string;
  keywords: string[];
  /** True when a human wrote it, false when this module derived it. */
  isOverridden: { title: boolean; description: boolean; keywords: boolean };
}

const BRAND = 'LUCEA Maroc';

/** Strips accents and punctuation so keywords match how people actually type. */
export function normaliseTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drops the collection prefix so "NURA Veilleuse prenom" reads "veilleuse prenom". */
function productNoun(name: string): string {
  const normalised = normaliseTerm(name);
  const words = normalised.split(' ');
  // Collection names are a single all caps token in the raw name
  const firstRaw = name.trim().split(' ')[0] ?? '';
  if (firstRaw.length > 2 && firstRaw === firstRaw.toUpperCase()) {
    return words.slice(1).join(' ');
  }
  return normalised;
}

function categorySlugsOf(product: any): string[] {
  return (product.categories ?? []).map((c: any) => c.slug);
}

export function buildProductSeo(product: any): ProductSeo {
  const noun = productNoun(product.name || '');
  const cluster = CLUSTERS.find((c) => categorySlugsOf(product).includes(c.categorySlug));

  // ---- Title ----
  // Name plus one qualifier plus brand, clamped so Google does not truncate.
  const derivedTitle = clamp(`${product.name} | ${BRAND}`, 60);

  // ---- Description ----
  // The first sentences of the real description beat any generated sentence,
  // so they are used whenever they exist and only padded when too short.
  const firstSentences = (product.description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=\.)\s/)
    .slice(0, 2)
    .join(' ');

  const priceFrom = product.variants?.length
    ? Math.min(...product.variants.map((v: any) => v.price_cents)) / 100
    : null;

  const fallbackDescription = [
    `${product.name}, imprimee en 3D dans notre atelier de Casablanca.`,
    priceFrom ? `A partir de ${priceFrom.toFixed(0)} MAD.` : '',
    'Gravure du prenom offerte, livraison en 24h a Casablanca et Rabat, paiement a la reception.',
  ].filter(Boolean).join(' ');

  const derivedDescription = clamp(
    firstSentences.length >= 80 ? firstSentences : fallbackDescription,
    158
  );

  // ---- Keywords ----
  const sizes: string[] = (product.variants ?? [])
    .map((v: any) => v.size_attribute)
    .filter(Boolean)
    .map((s: string) => normaliseTerm(s));

  const derivedKeywords = dedupe([
    normaliseTerm(product.name),
    noun,
    `${noun} maroc`,
    `acheter ${noun} maroc`,
    ...(cluster ? cluster.secondaryKeywords.slice(0, 2) : []),
    ...sizes.slice(0, 2).map((size) => `${noun} ${size}`),
    'lampe imprimee 3d maroc',
    'paiement a la livraison maroc',
  ]).filter((k) => k.length > 3).slice(0, 10);

  // ---- Admin overrides ----
  const overrideKeywords = (product.seo_keywords || '')
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);

  return {
    title: product.seo_title?.trim() || derivedTitle,
    description: product.seo_description?.trim() || derivedDescription,
    keywords: overrideKeywords.length ? overrideKeywords : derivedKeywords,
    isOverridden: {
      title: Boolean(product.seo_title?.trim()),
      description: Boolean(product.seo_description?.trim()),
      keywords: overrideKeywords.length > 0,
    },
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/**
 * Quality checks surfaced in the admin so staff can see what a product page
 * is missing before it is published.
 */
export interface SeoAudit {
  score: number;
  checks: { label: string; passed: boolean; hint: string }[];
}

export function auditProductSeo(product: any): SeoAudit {
  const seo = buildProductSeo(product);
  const description = (product.description || '').trim();
  const images = product.images ?? [];

  const checks = [
    {
      label: 'Titre entre 30 et 60 caracteres',
      passed: seo.title.length >= 30 && seo.title.length <= 60,
      hint: `Actuellement ${seo.title.length} caracteres.`,
    },
    {
      label: 'Meta description entre 120 et 158 caracteres',
      passed: seo.description.length >= 120 && seo.description.length <= 158,
      hint: `Actuellement ${seo.description.length} caracteres.`,
    },
    {
      label: 'Description produit d au moins 300 caracteres',
      passed: description.length >= 300,
      hint: `Actuellement ${description.length} caracteres. Google et les acheteurs ont besoin de details concrets.`,
    },
    {
      label: 'Au moins deux images',
      passed: images.length >= 2,
      hint: 'Une seule vue laisse trop de doutes avant un paiement a la livraison.',
    },
    {
      label: 'Texte alternatif rempli sur chaque image',
      passed: images.length > 0 && images.every((i: any) => (i.alt || '').trim().length >= 10),
      hint: 'Le texte alternatif alimente Google Images et les lecteurs d ecran.',
    },
    {
      label: 'Adresse de page lisible',
      passed: /^[a-z0-9-]+$/.test(product.slug || '') && (product.slug || '').length <= 60,
      hint: 'Minuscules, chiffres et tirets uniquement.',
    },
    {
      label: 'Rattache a une collection',
      passed: (product.categories ?? []).length > 0,
      hint: 'Sans categorie, le produit n apparait sur aucune page de collection.',
    },
    {
      label: 'Au moins 5 mots cles cibles',
      passed: seo.keywords.length >= 5,
      hint: 'Ajoutez des mots cles ou enrichissez le nom du produit.',
    },
  ];

  const passed = checks.filter((c) => c.passed).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}
