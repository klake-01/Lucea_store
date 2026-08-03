import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingBag, Star, ShieldCheck, Truck, Check, Minus, Plus, Loader2, Leaf, RotateCcw
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Seo } from '../components/Seo';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { Section, SectionBody, Container } from '../components/Layout';
import { fetchApi, ApiError } from '../lib/api';
import { formatMad } from '../lib/format';
import { buildProductSchema, buildBreadcrumbSchema } from '../lib/jsonLdBuilder';
import { buildProductSeo } from '../lib/productSeo';

const MAX_CONFIG_LENGTH = 15;
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80';

const REASSURANCE = [
  { icon: Truck, label: 'Livraison en 24h a Casablanca et Rabat' },
  { icon: ShieldCheck, label: 'Paiement en especes a la reception' },
  { icon: Leaf, label: 'PLA vegetal, sans ABS ni solvant' },
  { icon: RotateCcw, label: 'Garantie 12 mois sur le montage' },
];

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [configText, setConfigText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const { addToCart, busy, openCart } = useCart();

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();

    setLoading(true);
    setLoadError(null);
    setQuantity(1);
    setConfigText('');
    setActiveImage(0);

    fetchApi(`/catalog/products/${slug}`, { auth: false, signal: controller.signal })
      .then((data) => {
        setProduct(data);
        setSelectedVariantId(data?.variants?.[0]?.id ?? null);
        
        // Fetch reviews for this product
        if (data?.id) {
          fetchApi(`/reviews?limit=3&product_id=${data.id}`, { auth: false, signal: controller.signal })
            .then((revData) => {
              setReviews(revData?.items ?? []);
              setReviewSummary(revData?.summary ?? null);
            })
            .catch(() => undefined);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? 'Cette lampe n existe plus ou a change d adresse.'
            : 'Le chargement de la fiche a echoue. Merci de reessayer.'
        );
      })
      .finally(() => setLoading(false));

    // Related products fill the page instead of leaving a dead column
    fetchApi('/catalog/products?limit=4', { auth: false, signal: controller.signal })
      .then((res) => setRelated((res?.items ?? []).filter((p: any) => p.slug !== slug).slice(0, 3)))
      .catch(() => undefined);

    return () => controller.abort();
  }, [slug]);

  if (loading) {
    return (
      <Container>
        <div className="py-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-sable-soft rounded-2xl animate-pulse" />
          <div className="space-y-5">
            <div className="h-9 bg-sable-soft rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-sable-soft rounded animate-pulse" />
            <div className="h-28 bg-sable-soft rounded animate-pulse" />
            <div className="h-13 bg-sable-soft rounded animate-pulse" />
          </div>
        </div>
      </Container>
    );
  }

  if (loadError || !product) {
    return (
      <Container width="narrow">
        <div className="py-24 text-center">
          <h1 className="text-2xl font-serif font-bold text-ink">Lampe introuvable</h1>
          <p className="mt-4 text-sm text-ink-soft">{loadError}</p>
          <Link
            to="/lampes"
            className="mt-8 inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-12 rounded-xl text-sm transition-colors"
          >
            Voir tout le catalogue
          </Link>
        </div>
      </Container>
    );
  }

  const variants: any[] = product.variants ?? [];
  const images: any[] = product.images?.length ? product.images : [{ url: FALLBACK_IMAGE, alt: product.name }];
  const productSeo = buildProductSeo(product);
  const activeVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const stock = activeVariant?.stock ?? 0;
  const outOfStock = stock <= 0;

  const handleAddToCart = async () => {
    if (!activeVariant?.id || outOfStock) return;
    await addToCart(activeVariant.id, quantity, configText.trim() || undefined);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <>
      {/* Title, description and keywords are derived from the product itself
          by lib/productSeo, and overridden by the admin fields when set. */}
      <Seo
        title={productSeo.title}
        description={productSeo.description}
        path={`/products/${product.slug}`}
        keywords={productSeo.keywords}
        imageUrl={images[0]?.url}
        type="product"
        jsonLd={[
          buildProductSchema(product),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Toutes nos lampes', url: '/lampes' },
            { name: product.name, url: `/products/${product.slug}` },
          ]),
        ]}
      />

      <Container>
        <nav aria-label="Fil d ariane" className="pt-8 text-[11px] text-pierre-deep">
          <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <Link to="/lampes" className="hover:text-terracotta-deep">Lampes</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-ink font-medium">{product.name}</span>
        </nav>

        {/*
          Two balanced columns. The buy panel is sticky on desktop so it stays
          beside a tall image instead of leaving the old dead white gap.
        */}
        <div className="py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">

          <div className="lg:sticky lg:top-28">
            <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden aspect-square">
              <img
                src={images[activeImage]?.url || FALLBACK_IMAGE}
                alt={images[activeImage]?.alt || product.name}
                width={900}
                height={900}
                {...{ fetchpriority: 'high' }}
                decoding="sync"
                className="w-full h-full object-cover"
              />
            </div>

            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <button
                    key={img.id ?? i}
                    onClick={() => setActiveImage(i)}
                    aria-label={`Voir l image ${i + 1} sur ${images.length}`}
                    aria-pressed={activeImage === i}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                      activeImage === i ? 'border-ambre' : 'border-pierre-line hover:border-ambre/50'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      width={120}
                      height={120}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep bg-ambre-soft px-2.5 py-1.5 rounded leading-none">
              {product.brand}
            </p>

            <h1 className="mt-4 text-[1.75rem] sm:text-[2.25rem] leading-[1.15] font-serif font-bold text-ink">
              {product.name}
            </h1>

            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${(reviewSummary?.average ?? 5) > i ? 'fill-ambre text-ambre' : 'text-pierre-line'}`}
                  />
                ))}
              </span>
              <span className="text-xs text-pierre-deep">
                {reviewSummary?.average ? reviewSummary.average.toFixed(1).replace('.', ',') : '5,0'} sur 5, {reviewSummary?.count ?? 0} avis au Maroc
              </span>
            </div>

            <div className="mt-7 bg-white border border-pierre-line p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-pierre-deep">Prix a regler a la reception</p>
                <p className="mt-1.5 text-[2rem] leading-none font-serif font-bold text-ink tabular-nums">
                  {formatMad(activeVariant?.price_cents)}
                </p>
              </div>
              {outOfStock ? (
                <p className="text-xs text-alerte bg-alerte-soft px-3 py-2 rounded-lg font-semibold">
                  Rupture temporaire
                </p>
              ) : (
                <p className="text-xs text-succes bg-succes-soft px-3 py-2 rounded-lg inline-flex items-center gap-1.5 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {stock <= 5 ? `Plus que ${stock} en stock` : 'En stock, expedie sous 48h'}
                </p>
              )}
            </div>

            {variants.length > 1 && (
              <fieldset className="mt-7">
                <legend className="text-xs font-semibold text-ink">Taille</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      aria-pressed={activeVariant?.id === v.id}
                      className={`px-5 py-3 text-xs rounded-xl border font-medium transition-colors text-left ${
                        activeVariant?.id === v.id
                          ? 'border-ambre bg-ambre-soft text-ink'
                          : 'border-pierre-line bg-white text-ink-soft hover:border-ambre'
                      }`}
                    >
                      {v.size_attribute || v.sku}
                      <span className="block text-[11px] text-pierre-deep mt-1 tabular-nums">
                        {formatMad(v.price_cents)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mt-7">
              <label htmlFor="config-text" className="text-xs font-semibold text-ink block">
                Prenom a graver, optionnel
              </label>
              <input
                id="config-text"
                type="text"
                maxLength={MAX_CONFIG_LENGTH}
                placeholder="Par exemple Lina, Anas, Mohamed"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="mt-2.5 w-full h-13 bg-white border border-pierre-line rounded-xl px-4 text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12"
                aria-describedby="config-help"
              />
              <div id="config-help" className="mt-2 flex justify-between gap-4 text-[11px] text-pierre-deep">
                <span>La gravure est offerte et ajoute 48h de fabrication.</span>
                <span className="tabular-nums shrink-0">
                  {configText.length} sur {MAX_CONFIG_LENGTH}
                </span>
              </div>
            </div>

            <div className="mt-7 flex items-stretch gap-3">
              <div className="flex items-center border border-pierre-line rounded-xl bg-white overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-12 h-13 grid place-items-center text-ink hover:bg-sable-soft disabled:opacity-40 transition-colors"
                  aria-label="Diminuer la quantite"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  className="w-10 text-center text-sm font-semibold text-ink tabular-nums"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(stock || 99, q + 1))}
                  disabled={quantity >= stock}
                  className="w-12 h-13 grid place-items-center text-ink hover:bg-sable-soft disabled:opacity-40 transition-colors"
                  aria-label="Augmenter la quantite"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={busy || outOfStock}
                className="flex-1 bg-ambre hover:bg-ambre-deep hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-ink font-bold h-13 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                )}
                {outOfStock ? 'Rupture temporaire' : 'Ajouter au panier'}
              </button>
            </div>

            {added && (
              <p
                role="status"
                className="mt-4 text-xs text-succes bg-succes-soft px-4 py-3 rounded-xl flex items-center justify-between gap-3"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Ajoute au panier
                </span>
                <button onClick={openCart} className="underline font-semibold shrink-0">
                  Voir le panier
                </button>
              </p>
            )}

            <ul className="mt-8 pt-7 border-t border-pierre-line grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs text-ink-soft">
              {REASSURANCE.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>

      {/* ---------- Description ---------- */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="desc-title">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-10 lg:gap-16">
          <div>
            <h2 id="desc-title" className="text-xl font-serif font-bold text-ink">
              Description et caracteristiques
            </h2>
            <p className="mt-5 text-sm text-ink-soft leading-[1.75]">{product.description}</p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 self-start">
            {[
              ['Matiere', 'PLA vegetal issu d amidon de mais'],
              ['Source lumineuse', 'LED 2700 kelvins, lumiere chaude'],
              ['Reference', activeVariant?.sku],
              ['Fabrication', 'Atelier de Casablanca, 48h pour une gravure'],
            ].map(([term, value]) => (
              <div key={term} className="bg-ecru p-4 rounded-xl border border-pierre-line">
                <dt className="text-[11px] text-pierre-deep">{term}</dt>
                <dd className="mt-1 text-xs font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ---------- Reviews ---------- */}
      <Section tone="ecru" rhythm="default" aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="text-xl sm:text-2xl font-serif font-bold text-ink text-center">
          Ce que disent nos clients
        </h2>

        <SectionBody className="mt-8 sm:mt-10">
          {reviews.length === 0 ? (
            <p className="text-center text-sm text-ink-soft bg-white p-8 rounded-2xl border border-pierre-line">
              Aucun avis pour le moment. Soyez le premier à donner votre avis !
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.map((review) => (
                <figure key={review.id} className="bg-white p-6 rounded-2xl border border-pierre-line">
                  <span className="flex gap-0.5" aria-label={`${review.rating} etoiles sur 5`}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${review.rating > i ? 'fill-ambre text-ambre' : 'text-pierre-line'}`}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  {review.title && (
                    <p className="mt-3 font-serif font-bold text-ink">{review.title}</p>
                  )}
                  <blockquote className="mt-2 text-sm text-ink-soft leading-relaxed">
                    {review.body}
                  </blockquote>
                  <figcaption className="mt-4 text-xs text-terracotta-deep font-semibold">
                    {review.author_name}{review.author_city ? `, ${review.author_city}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </SectionBody>
      </Section>

      {/* ---------- Related ---------- */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="related-title">
        <h2 id="related-title" className="text-xl sm:text-2xl font-serif font-bold text-ink text-center">
          Vous aimerez aussi
        </h2>

        <SectionBody className="mt-8 sm:mt-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.length === 0
              ? [0, 1, 2].map((i) => <ProductCardSkeleton key={i} />)
              : related.map((p) => (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    slug={p.slug}
                    price_cents={p.variants?.[0]?.price_cents}
                    image_url={p.images?.[0]?.url}
                    image_alt={p.images?.[0]?.alt}
                    variant_id={p.variants?.[0]?.id}
                    stock={p.variants?.[0]?.stock}
                    brand={p.brand}
                  />
                ))}
          </div>
        </SectionBody>
      </Section>

      {/* Mobile sticky buy bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-100 bg-white border-t border-pierre-line px-5 py-3 flex items-center gap-4">
        <div className="shrink-0">
          <p className="text-[10px] text-pierre-deep leading-none">Total</p>
          <p className="mt-1 font-serif font-bold text-ink leading-none tabular-nums">
            {formatMad((activeVariant?.price_cents ?? 0) * quantity)}
          </p>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={busy || outOfStock}
          className="flex-1 bg-ambre hover:bg-ambre-deep text-ink font-bold h-12 rounded-xl text-sm disabled:opacity-50"
        >
          {outOfStock ? 'Rupture temporaire' : 'Ajouter au panier'}
        </button>
      </div>
      <div className="lg:hidden h-20" aria-hidden="true" />
    </>
  );
};
