import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, SlidersHorizontal, X, Check, Factory, Leaf, ShieldCheck, Truck,
  Gift, MessageCircle, Sparkles, Heart, Bed, Sofa, Lamp, Building2, Search
} from 'lucide-react';
import { CollectionCard, CollectionCardSkeleton } from '../components/CollectionCard';
import { Seo } from '../components/Seo';
import { Section, SectionBody, Container } from '../components/Layout';
import { Reveal } from '../components/Reveal';
import { CLUSTERS } from '../lib/seoStrategy';
import { HUB_SEO } from '../lib/pageSeo';
import { fetchApi } from '../lib/api';
import { formatMad } from '../lib/format';
import { BRAND } from '../lib/brand';
import {
  buildCollectionSchema, buildItemListSchema, buildBreadcrumbSchema
} from '../lib/jsonLdBuilder';

/* ------------------------------------------------------------------ */

const CHIPS = [
  { slug: '', label: 'Tous les produits', icon: Sparkles },
  { slug: 'veilleuses-personnalisees', label: 'Veilleuses prénom', icon: Heart },
  { slug: 'lampes-chevet', label: 'Chevet', icon: Bed },
  { slug: 'lampes-salon', label: 'Salon', icon: Sofa },
  { slug: 'lampes-bureau', label: 'Bureau', icon: Lamp },
  { slug: 'luminaires-professionnels', label: 'Professionnels', icon: Building2 },
];

const HERO_BADGES = [
  { icon: Factory, label: 'Fabrication locale au Maroc' },
  { icon: Leaf, label: 'Matériaux éco-responsables' },
  { icon: ShieldCheck, label: 'Paiement à la livraison' },
];

const TRUST = [
  { icon: Truck, title: 'Livraison rapide partout au Maroc', body: '48h à Casablanca et Rabat, 2 à 5 jours dans les autres villes.' },
  { icon: ShieldCheck, title: 'Paiement à la livraison', body: 'Vous payez à la réception, après avoir ouvert le colis.' },
  { icon: Gift, title: 'Emballage cadeau offert', body: 'Chaque lampe est soigneusement emballée avec soin.' },
  { icon: MessageCircle, title: 'Besoin d aide ?', body: 'Écrivez nous sur WhatsApp, réponse le jour même.' },
];

const SORTS = [
  { value: 'popular', label: 'Popularité' },
  { value: 'recent', label: 'Nouveautés' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
];

const PRICE_BANDS = [
  { value: '', label: 'Tous les prix' },
  { value: '0-30000', label: 'Moins de 300 MAD' },
  { value: '30000-45000', label: '300 à 450 MAD' },
  { value: '45000-60000', label: '450 à 600 MAD' },
  { value: '60000-', label: 'Plus de 600 MAD' },
];

const priceOf = (p: any) => p.variants?.[0]?.price_cents ?? 0;
const availableOf = (p: any) => p.variants?.[0]?.available ?? p.variants?.[0]?.stock ?? 0;

/**
 * Personalisation is not a column on the product, so it is inferred from the
 * copy the workshop already writes. Worth replacing with a real boolean if
 * merchandising ever needs to control it independently of the description.
 */
const isPersonalisable = (p: any) =>
  /personnalis|prénom|prenom|grav/i.test(`${p.name} ${p.description ?? ''}`);

/**
 * Badges, derived from real signals and deliberately scarce.
 *
 * An earlier version marked anything created in the last 30 days as new, which
 * labelled the entire catalogue "Nouveaute" because the whole seed was created
 * on one day. A badge every product carries is not a badge, it is decoration.
 * So newness is relative: only the newest few products in the catalogue can
 * hold it, and each product gets at most one badge by precedence.
 */
const buildBadgeMap = (list: any[]): Record<string, string> => {
  const map: Record<string, string> = {};
  if (list.length === 0) return map;

  // Newest, but only when the catalogue is actually varied in age. If every
  // product was created within an hour of the others, nothing is "new".
  const times = list.map((p) => new Date(p.created_at).getTime());
  const spread = Math.max(...times) - Math.min(...times);
  const HOUR = 1000 * 60 * 60;

  if (spread > 24 * HOUR) {
    [...list]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, Math.max(1, Math.round(list.length * 0.15)))
      .forEach((p) => { map[p.id] = 'Nouveaute'; });
  }

  // Scarcity beats newness: a customer needs to know before they decide.
  list.forEach((p) => {
    const left = availableOf(p);
    if (left > 0 && left <= 5) map[p.id] = 'Serie limitee';
  });

  // Best sellers take the top of the default order, which is the API's own
  // ranking, and only where nothing more urgent already applies.
  list.slice(0, 2).forEach((p) => { if (!map[p.id]) map[p.id] = 'Best seller'; });

  return map;
};

/* ------------------------------------------------------------------ */

export const HubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q');
  const category = searchParams.get('categorie') ?? '';

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('popular');
  const [priceBand, setPriceBand] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [personalisableOnly, setPersonalisableOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const endpoint = query
      ? `/search?q=${encodeURIComponent(query)}`
      : '/catalog/products?limit=60';

    fetchApi(endpoint, { auth: false, signal: controller.signal })
      .then((res) => setProducts(Array.isArray(res) ? res : res?.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query]);

  // Filtering runs in the browser. The catalogue is small enough that a round
  // trip per filter change would make the interaction feel slower, not faster.
  const visible = useMemo(() => {
    let list = [...products];

    if (category) {
      list = list.filter((p) =>
        (p.categories ?? []).some((c: any) => c.slug === category)
      );
    }
    if (priceBand) {
      const [min, max] = priceBand.split('-');
      list = list.filter((p) => {
        const price = priceOf(p);
        if (min && price < Number(min)) return false;
        if (max && price > Number(max)) return false;
        return true;
      });
    }
    if (inStockOnly) list = list.filter((p) => availableOf(p) > 0);
    if (personalisableOnly) list = list.filter(isPersonalisable);

    switch (sort) {
      case 'price-asc': list.sort((a, b) => priceOf(a) - priceOf(b)); break;
      case 'price-desc': list.sort((a, b) => priceOf(b) - priceOf(a)); break;
      case 'recent':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default: break; // popularity is the API's own order
    }
    return list;
  }, [products, category, priceBand, inStockOnly, personalisableOnly, sort]);

  const activeFilters =
    (priceBand ? 1 : 0) + (inStockOnly ? 1 : 0) + (personalisableOnly ? 1 : 0);

  const clearFilters = () => {
    setPriceBand('');
    setInStockOnly(false);
    setPersonalisableOnly(false);
  };

  const activeCluster = CLUSTERS.find((c) => c.categorySlug === category);
  const heading = query
    ? `Résultats pour "${query}"`
    : activeCluster
      ? activeCluster.name
      : 'Toutes nos lampes et veilleuses 3D';

  // Computed over the full catalogue, not the filtered view, so a badge does
  // not appear and disappear as filters change.
  const badges = useMemo(() => buildBadgeMap(products), [products]);

  const priceRange = products.length
    ? [Math.min(...products.map(priceOf)), Math.max(...products.map(priceOf))]
    : [0, 0];

  /* ---------------- filter controls, shared by bar and sheet ---------------- */
  const FilterControls = () => (
    <>
      <div>
        <p className="text-[11px] font-semibold text-ink">Prix</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {PRICE_BANDS.map((band) => (
            <button
              key={band.value}
              onClick={() => setPriceBand(band.value)}
              aria-pressed={priceBand === band.value}
              className={`h-10 px-3.5 rounded-xl text-xs border transition-colors ${
                priceBand === band.value
                  ? 'bg-ink text-ecru border-ink font-semibold'
                  : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-ink">Affiner</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            onClick={() => setInStockOnly((v) => !v)}
            aria-pressed={inStockOnly}
            className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-xs border transition-colors ${
              inStockOnly
                ? 'bg-ink text-ecru border-ink font-semibold'
                : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
            }`}
          >
            {inStockOnly && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            Disponible maintenant
          </button>
          <button
            onClick={() => setPersonalisableOnly((v) => !v)}
            aria-pressed={personalisableOnly}
            className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-xs border transition-colors ${
              personalisableOnly
                ? 'bg-ink text-ecru border-ink font-semibold'
                : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
            }`}
          >
            {personalisableOnly
              ? <Check className="w-3.5 h-3.5" aria-hidden="true" />
              : <Sparkles className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />}
            Personnalisable
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Seo
        title={HUB_SEO.title}
        description={HUB_SEO.description}
        path="/lampes"
        keywords={HUB_SEO.keywords}
        noindex={Boolean(query)}
        jsonLd={[
          buildCollectionSchema('Catalogue LUCÉA', HUB_SEO.description, '/lampes'),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Toutes nos lampes', url: '/lampes' },
          ]),
          buildItemListSchema(visible, 'Catalogue LUCÉA'),
        ]}
      />

      {/* ================= EDITORIAL HERO ================= */}
      <section className="relative isolate bg-sable border-b border-pierre-line overflow-hidden">
        {/* Phones: a block that caps the band above the copy.
            Desktop: absolute, so the Container below spans the full page width
            and the hero copy lands on the same grid as every h2 beneath it. */}
        <div className="relative h-52 sm:h-72 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%]">
          <img
            src="/images/collections/chevet.webp"
            srcSet="/images/collections/chevet-500.webp 500w, /images/collections/chevet.webp 900w"
            sizes="(max-width: 1024px) 100vw, 46vw"
            alt="Lampe LUCÉA posée sur une table de chevet dans une chambre lumineuse"
            width={900}
            height={672}
            loading="eager"
            decoding="sync"
            {...{ fetchpriority: 'high' }}
            className="absolute inset-0 w-full h-full object-cover object-[58%_center]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-sable/80 via-sable/10 to-transparent lg:bg-gradient-to-r lg:from-sable lg:from-0% lg:via-sable/20 lg:via-26% lg:to-transparent lg:to-52%"
          />
        </div>

        <Container className="relative">
          <div className="py-12 sm:py-16 lg:py-24 lg:max-w-[34rem]">
<nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
              <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="text-ink font-medium">Toutes nos lampes</span>
            </nav>

            <h1 className="mt-5 text-[2rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.1] font-serif font-bold text-ink">
              {heading}
            </h1>

            <p className="mt-5 text-[0.9375rem] sm:text-base text-ink-soft leading-relaxed max-w-lg">
              Toutes nos lampes sont imprimées en 3D au Maroc avec des matériaux
              éco-responsables. Lumière douce, design unique et fabrication locale.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2.5">
              {HERO_BADGES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 bg-white border border-pierre-line rounded-full px-3.5 py-2 text-[11px] font-medium text-ink-soft"
                >
                  <Icon className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            <dl className="mt-8 flex flex-wrap gap-x-9 gap-y-4">
              {[
                ['48h', 'de fabrication'],
                ['2 ans', 'de garantie'],
                [products.length ? `${products.length}` : '—', 'modèles au catalogue'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block text-xl font-serif font-bold text-terracotta-deep tabular-nums">
                      {value}
                    </span>
                    <span className="block text-[11px] text-pierre-deep mt-0.5">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* ================= CATEGORY CHIPS ================= */}
      <div className="bg-ecru border-b border-pierre-line">
        <Container>
          {/* Horizontal scroll on phones rather than a wrapped block that
              pushes the first product row off the screen. */}
          <div className="flex gap-2 overflow-x-auto py-5 -mx-5 px-5 sm:mx-0 sm:px-0 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHIPS.map(({ slug, label, icon: Icon }) => {
              const active = category === slug;
              return (
                <button
                  key={slug || 'all'}
                  onClick={() => setSearchParams(slug ? { categorie: slug } : {})}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full text-xs whitespace-nowrap border shrink-0 transition-all duration-200 ${
                    active
                      ? 'bg-ink text-ecru border-ink font-semibold shadow-[0_4px_14px_rgba(28,27,25,0.18)]'
                      : 'bg-white text-ink-soft border-pierre-line hover:border-ambre hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(28,27,25,0.06)]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-ambre' : 'text-terracotta'}`} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </Container>
      </div>

      {/* ================= FILTER BAR + GRID =================
          These two share a wrapper on purpose. A sticky element travels for
          the height of its nearest scrolling ancestor, so when the bar sat
          directly inside <main> it stayed pinned over every section below the
          grid. Bounding it to the results it controls makes it release at the
          end of the grid, which is the only place it means anything.

          The offset is --nav-h, the navbar's real height. The previous value
          added 2.25rem for the announcement bar, but that bar is not sticky:
          it scrolled away and left the filter bar floating in a gap, then
          snapped upward. Reading the variable keeps the two in step at every
          viewport width. */}
      <div className="relative">
      <div className="sticky top-[var(--nav-h)] z-100 bg-ecru border-b border-pierre-line shadow-[0_1px_0_rgba(28,27,25,0.04)]">
        <Container>
          <div className="flex items-center justify-between gap-3 py-3.5">
            <p className="text-xs text-pierre-deep" aria-live="polite">
              {loading ? 'Chargement du catalogue' : (
                <>
                  <span className="font-semibold text-ink tabular-nums">{visible.length}</span>
                  {' '}lampe{visible.length > 1 ? 's' : ''} disponible{visible.length > 1 ? 's' : ''}
                  {products.length > 0 && (
                    <span className="hidden sm:inline">
                      {' · de '}{formatMad(priceRange[0])}{' à '}{formatMad(priceRange[1])}
                    </span>
                  )}
                </>
              )}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop filters live inline; phones get a bottom sheet */}
              <button
                onClick={() => setFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 h-10 px-3.5 bg-white border border-pierre-line rounded-xl text-xs font-semibold text-ink"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Filtrer
                {activeFilters > 0 && (
                  <span className="bg-ambre text-ink text-[10px] font-bold w-4 h-4 rounded-full grid place-items-center tabular-nums">
                    {activeFilters}
                  </span>
                )}
              </button>

              <div className="hidden lg:flex items-center gap-2">
                <label htmlFor="price-band" className="sr-only">Filtrer par prix</label>
                <select
                  id="price-band"
                  value={priceBand}
                  onChange={(e) => setPriceBand(e.target.value)}
                  className="h-10 bg-white border border-pierre-line rounded-xl px-3 text-xs text-ink focus:outline-none focus:border-terracotta"
                >
                  {PRICE_BANDS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => setInStockOnly((v) => !v)}
                  aria-pressed={inStockOnly}
                  className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs border transition-colors ${
                    inStockOnly
                      ? 'bg-ink text-ecru border-ink font-semibold'
                      : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
                  }`}
                >
                  {inStockOnly && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                  Disponible
                </button>

                <button
                  onClick={() => setPersonalisableOnly((v) => !v)}
                  aria-pressed={personalisableOnly}
                  className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs border transition-colors ${
                    personalisableOnly
                      ? 'bg-ink text-ecru border-ink font-semibold'
                      : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${personalisableOnly ? 'text-ambre' : 'text-terracotta'}`} aria-hidden="true" />
                  Personnalisable
                </button>

                {activeFilters > 0 && (
                  <button
                    onClick={clearFilters}
                    className="h-10 px-3 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
                  >
                    Effacer
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="sort" className="hidden sm:inline text-[11px] text-pierre-deep">
                  Trier par
                </label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-10 bg-white border border-pierre-line rounded-xl px-3 text-xs text-ink focus:outline-none focus:border-terracotta"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* ================= GRID ================= */}
      {/* Top padding is reduced because the sticky filter bar above already
          provides the separation the default rhythm would add. */}
      <Section tone="ecru" rhythm="default" className="!pt-6 sm:!pt-8">
        <SectionBody className="mt-0">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <CollectionCardSkeleton key={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-pierre-line rounded-2xl py-16 px-6 text-center">
              <Search className="w-7 h-7 text-pierre-line mx-auto" aria-hidden="true" />
              <p className="mt-4 text-sm text-ink-soft">
                {query
                  ? `Aucune lampe ne correspond à "${query}".`
                  : activeFilters > 0
                    ? 'Aucune lampe ne correspond à ces filtres.'
                    : 'Aucune lampe dans cette collection pour le moment.'}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                {activeFilters > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-6 h-11 rounded-xl text-xs transition-colors"
                  >
                    Effacer les filtres
                  </button>
                )}
                <Link
                  to="/lampes"
                  className="inline-flex items-center justify-center bg-white hover:bg-sable-soft text-ink font-semibold px-6 h-11 rounded-xl text-xs border border-pierre-line transition-colors"
                >
                  Voir tout le catalogue
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="sr-only">Lampes disponibles</h2>
              <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {visible.map((p, index) => (
                  <CollectionCard
                    key={p.id}
                    product={{
                      ...p,
                      badge: badges[p.id] ?? null,
                      personalisable: isPersonalisable(p),
                    }}
                    priority={index < 4}
                  />
                ))}
              </Reveal>
            </>
          )}
        </SectionBody>
      </Section>
      </div>

      {/* ================= TRUST ROW ================= */}
      <Section tone="white" rhythm="default" bordered>
        <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 lg:gap-8">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-ambre-soft grid place-items-center shrink-0">
                <Icon className="w-4 h-4 text-terracotta" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold text-ink text-sm leading-snug">{title}</h3>
                <p className="mt-1.5 text-xs text-pierre-deep leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </Section>

      {/* ================= CHOOSE BY USE ================= */}
      <Section tone="ecru" rhythm="default" aria-labelledby="usage-title">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
            Par usage
          </p>
          <h2 id="usage-title" className="mt-3 text-2xl sm:text-[2rem] font-serif font-bold text-ink">
            Choisir par usage
          </h2>
        </div>

        <SectionBody>
          <Reveal stagger className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLUSTERS.map((c) => (
              <Link
                key={c.id}
                to={c.moneyPageUrl}
                className="group flex items-center gap-4 bg-white border border-pierre-line rounded-2xl p-4 sm:p-5 hover:border-ambre hover:shadow-[0_8px_24px_rgba(28,27,25,0.06)] transition-all"
              >
                <img
                  src={c.image?.replace('.webp', '-500.webp') ?? '/images/collections/veilleuses-500.webp'}
                  alt=""
                  width={112}
                  height={112}
                  loading="lazy"
                  decoding="async"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 bg-sable-soft"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif font-bold text-ink text-sm sm:text-base group-hover:text-terracotta-deep transition-colors">
                    {c.name}
                  </span>
                  <span className="mt-1.5 block text-xs text-pierre-deep leading-relaxed">
                    {c.cardBlurb ?? c.promise}
                  </span>
                </span>
                <ArrowRight
                  className="w-4 h-4 text-terracotta-deep shrink-0 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================= CLOSING ================= */}
      <Section tone="sable" rhythm="loose" bordered>
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-[2rem] font-serif font-bold text-ink">
            Une question avant de choisir ?
          </h2>
          <p className="mt-5 text-sm sm:text-base text-ink-soft leading-relaxed">
            Dites nous la pièce et l ambiance recherchée, notre atelier vous
            oriente vers le bon modèle. Réponse le jour même du lundi au samedi.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={BRAND.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-13 rounded-xl transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Demander conseil sur WhatsApp
            </a>
            <Link
              to="/avis"
              className="inline-flex items-center justify-center bg-white hover:bg-ecru text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
            >
              Lire les avis clients
            </Link>
          </div>
        </div>
      </Section>

      {/* ================= MOBILE FILTER SHEET ================= */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-300">
          <button
            className="absolute inset-0 bg-ink/50 w-full"
            onClick={() => setFiltersOpen(false)}
            aria-label="Fermer les filtres"
            tabIndex={-1}
          />
          {/* A bottom sheet rather than a full screen panel: the thumb is at the
              bottom of the phone, and so are the controls. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtres"
            className="absolute inset-x-0 bottom-0 bg-ecru rounded-t-3xl border-t border-pierre-line max-h-[85dvh] flex flex-col"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-pierre-line bg-white rounded-t-3xl">
              <h2 className="font-serif font-bold text-ink">Filtrer</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                className="w-10 h-10 -mr-2 grid place-items-center rounded-xl text-pierre-deep hover:text-ink"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
              <FilterControls />
            </div>

            <div className="shrink-0 border-t border-pierre-line bg-white px-5 py-4 flex gap-3">
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="h-12 px-5 bg-ecru text-ink font-semibold rounded-xl text-sm border border-pierre-line"
                >
                  Effacer
                </button>
              )}
              <button
                onClick={() => setFiltersOpen(false)}
                className="flex-1 h-12 bg-ambre active:bg-ambre-deep text-ink font-bold rounded-xl text-sm"
              >
                Voir {visible.length} lampe{visible.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
