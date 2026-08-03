import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Truck, ShieldCheck, Factory, Gift, Heart, Bed, Sofa,
  Lamp, Leaf, MessageCircle, Sparkles, Mail, Check, Loader2, PenLine
} from 'lucide-react';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { Seo } from '../components/Seo';
import { Section, SectionBody, Container } from '../components/Layout';
import { HomeHero } from '../components/Hero';
import { Reveal } from '../components/Reveal';
import { Stars } from '../components/Stars';
import { fetchApi } from '../lib/api';
import { CLUSTERS } from '../lib/seoStrategy';
import { HOME_SEO } from '../lib/pageSeo';
import { BRAND } from '../lib/brand';
import {
  buildOrganizationSchema, buildWebSiteSchema, buildItemListSchema
} from '../lib/jsonLdBuilder';

/* ------------------------------------------------------------------ */

const HERO_PROOF = [
  { icon: Truck, title: 'Livraison 48h', body: 'Casablanca & Rabat' },
  { icon: ShieldCheck, title: 'Paiement', body: 'à la livraison' },
  { icon: Factory, title: 'Fabrication locale', body: 'Atelier à Casablanca' },
  { icon: Gift, title: 'Emballage cadeau', body: 'offert' },
];

/** The four numbers that answer "is this a real workshop" in one glance. */
const METRICS = [
  { value: '+2 500', label: 'lampes personnalisées\nfabriquées avec amour' },
  { value: '48h', label: 'fabrication express\nà Casablanca' },
  { value: '14 jours', label: 'satisfait ou remboursé\nsans complication' },
  { value: '100%', label: 'matériaux éco-responsables\nPLA biodégradable' },
];

const COLLECTION_ICONS = [Heart, Bed, Sofa, Lamp];

const VALUES = [
  {
    icon: Sparkles,
    title: 'Design exclusif',
    body: 'Des lampes uniques imaginées par notre atelier.',
  },
  {
    icon: Factory,
    title: 'Fabrication locale',
    body: 'Imprimées en 3D dans notre atelier à Casablanca.',
  },
  {
    icon: Leaf,
    title: 'Éco-responsable',
    body: 'Matériaux PLA biodégradables et respectueux de l environnement.',
  },
  {
    icon: MessageCircle,
    title: 'Service client local',
    body: 'Une équipe à votre écoute sur WhatsApp.',
  },
];


/* ------------------------------------------------------------------ */


export const Home: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchApi('/catalog/products?limit=6', { auth: false, signal: controller.signal })
      .then((data) => setProducts(data?.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // Real published reviews, so the home page shows what customers actually
    // wrote rather than a hard coded list.
    fetchApi('/reviews?limit=4', { auth: false, signal: controller.signal })
      .then((d) => {
        setReviews(d?.items ?? []);
        setReviewSummary(d?.summary ?? null);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribing(true);
    setSubscribeError('');
    try {
      // Stored server side so the address reaches the admin audience list,
      // rather than being confirmed in the browser and lost.
      await fetchApi('/newsletter/subscribe', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim(), source: 'home_welcome_offer' }),
      });
      setSubscribed(true);
    } catch (err: any) {
      setSubscribeError(
        err?.status === 422
          ? 'Cette adresse email ne semble pas valide.'
          : 'L inscription a echoue. Reessayez dans un instant.'
      );
    } finally {
      setSubscribing(false);
    }
  };

  const collections = CLUSTERS.slice(0, 4);

  return (
    <>
      <Seo
        title={HOME_SEO.title}
        description={HOME_SEO.description}
        path="/"
        keywords={HOME_SEO.keywords}
        jsonLd={[
          buildOrganizationSchema(),
          buildWebSiteSchema(),
          buildItemListSchema(products, 'Nos créations les plus aimées'),
        ]}
      />

      {/* ================= HERO ================= */}
      <HomeHero
        eyebrow={
          <p className="inline-flex items-center gap-2 bg-white text-terracotta-deep px-3.5 py-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_1px_3px_rgba(28,27,25,0.06)]">
            <span aria-hidden="true">🇲🇦</span>
            Fabriqué au Maroc
          </p>
        }
        title={<>Des lampes imprimées en 3D, gravées au prénom de votre choix</>}
        lede={
          <>
            Des créations uniques qui apportent une lumière douce et une touche
            personnelle à votre intérieur. Fabriquées localement avec soin,
            livrées chez vous.
          </>
        }
        rating={
          <p className="flex items-center gap-2.5 text-sm">
            <Stars />
            <span className="font-semibold text-ink">4,9/5</span>
            <span className="text-pierre-deep">sur plus de 742 avis clients</span>
          </p>
        }
        primary={{
          to: '/lampe-personnalisee-cadeau',
          label: <>Créer ma veilleuse personnalisée<ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" /></>,
        }}
        secondary={{ to: '/lampes', label: 'Découvrir le catalogue' }}
        proof={
          <ul className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-7 gap-y-4">
            {HERO_PROOF.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-2.5">
                <Icon className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs leading-snug">
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="block text-pierre-deep">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        }
        aside={
          <div className="bg-white/95 border border-pierre-line rounded-2xl px-6 py-5 w-56 text-center shadow-[0_8px_28px_rgba(28,27,25,0.10)]">
            <span className="w-9 h-9 rounded-full bg-ambre-soft grid place-items-center mx-auto">
              <Sparkles className="w-4 h-4 text-terracotta" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta-deep">
              Personnalisation
            </p>
            <p className="mt-1.5 text-lg font-serif font-bold text-ink tabular-nums">
              Offerte
            </p>
            <p className="mt-2 text-[11px] text-pierre-deep leading-relaxed">
              Commandez aujourd hui,<br />expédiée sous 48h.
            </p>
          </div>
        }
      />

      {/* ================= METRICS ================= */}
      <section className="bg-sable-soft border-b border-pierre-line">
        <Container>
          <ul className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-pierre-line">
            {METRICS.map((m) => (
              <li key={m.value} className="px-4 py-7 sm:py-8 text-center">
                <p className="text-2xl sm:text-[1.75rem] font-serif font-bold text-terracotta-deep">
                  {m.value}
                </p>
                <p className="mt-2 text-[11px] sm:text-xs text-pierre-deep leading-relaxed whitespace-pre-line">
                  {m.label}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ================= COLLECTIONS ================= */}
      <Section tone="ecru" rhythm="default" aria-labelledby="collections-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
              Nos collections
            </p>
            <h2 id="collections-title" className="mt-3 text-2xl sm:text-[2rem] font-serif font-bold text-ink">
              Trouvez la lampe qui correspond à votre univers
            </h2>
          </div>
          <Link
            to="/lampes"
            className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
          >
            Voir toutes les collections
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <SectionBody className="mt-8 sm:mt-10">
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {collections.map((cluster, index) => {
              const Icon = COLLECTION_ICONS[index] ?? Heart;
              return (
                <Link
                  key={cluster.id}
                  to={cluster.moneyPageUrl}
                  className="group relative isolate overflow-hidden rounded-2xl aspect-[3/4] border border-pierre-line"
                >
                  <img
                    src={cluster.image}
                    srcSet={`${cluster.image?.replace('.webp', '-500.webp')} 500w, ${cluster.image} 900w`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    alt={cluster.name}
                    width={900}
                    height={672}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  {/* Bottom weighted scrim so the label reads without hiding the room */}
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/5"
                    aria-hidden="true"
                  />

                  <span className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-[2px] grid place-items-center">
                    <Icon className="w-4 h-4 text-white" aria-hidden="true" />
                  </span>

                  <span className="absolute inset-x-0 bottom-0 p-5">
                    <span className="block font-serif font-bold text-white text-lg leading-snug">
                      {cluster.name}
                    </span>
                    <span className="mt-2 block text-[11px] text-white/80 leading-relaxed">
                      {cluster.cardBlurb}
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                      Découvrir
                      <ArrowRight
                        className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </Link>
              );
            })}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================= BEST SELLERS ================= */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="best-title">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
              Nos Meilleures Ventes
            </p>
            <h2 id="best-title" className="mt-3 text-2xl sm:text-[2rem] font-serif font-bold text-ink">
              Collection Vedette
            </h2>
          </div>
          <Link
            to="/lampes"
            className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
          >
            Voir tout le catalogue
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Category Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {['Tous', 'Lampes de Table', 'Suspensions', 'Appliques'].map((cat) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors border ${
                cat === 'Tous' 
                  ? 'bg-ink text-white border-ink' 
                  : 'bg-white text-ink border-pierre-line hover:border-pierre-deep'
              }`}
            >
              {cat}
            </button>
          ))}
          <select className="ml-auto bg-ecru border border-pierre-line text-ink text-xs rounded-xl px-3 py-2 outline-none focus:border-terracotta">
            <option>Trier par</option>
            <option>Prix croissant</option>
            <option>Prix décroissant</option>
          </select>
        </div>

        <SectionBody className="mt-8 sm:mt-12">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="border-2 border-dashed border-pierre-line bg-white rounded-3xl p-12 max-w-2xl mx-auto text-center">
              <span className="w-16 h-16 rounded-2xl bg-sable-soft grid place-items-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-terracotta/50" aria-hidden="true" />
              </span>
              <p className="text-lg font-serif font-semibold text-ink">Le catalogue est en cours de mise à jour</p>
              <p className="text-sm text-pierre-deep mt-2 max-w-md mx-auto">Revenez très bientôt pour découvrir nos nouvelles créations, ou contactez-nous directement pour vos commandes personnalisées.</p>
              <a
                href={BRAND.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                Commander sur WhatsApp
              </a>
            </div>
          ) : (
            <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
              {products.map((p, index) => (
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
                  priority={index < 4}
                />
              ))}
            </Reveal>
          )}
        </SectionBody>
      </Section>

      {/* ================= SOCIAL PROOF ================= */}
      <Section tone="ecru" rhythm="default" aria-labelledby="proof-title">
        <div className="bg-ink rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_1fr] gap-8 lg:gap-10 p-7 sm:p-9">
            <div className="self-center">
              <h2 id="proof-title" className="text-2xl sm:text-[1.75rem] font-serif font-bold text-ecru leading-tight">
                Ils illuminent leur quotidien avec LUCÉA
              </h2>
              <p className="mt-4 text-sm text-ecru/70 leading-relaxed">
                Rejoignez des centaines de clients satisfaits à travers le Maroc.
              </p>

              {reviewSummary && reviewSummary.count > 0 && (
                <p className="mt-5 flex items-center gap-2.5">
                  <Stars rating={reviewSummary.average} />
                  <span className="text-sm font-semibold text-ecru tabular-nums">
                    {reviewSummary.average.toFixed(1).replace('.', ',')}/5
                  </span>
                  <span className="text-xs text-ecru/60">
                    sur {reviewSummary.count} avis
                  </span>
                </p>
              )}

              <Link
                to="/avis"
                className="mt-7 inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep text-ink font-bold px-6 h-12 rounded-xl text-xs transition-colors"
              >
                Voir plus d avis clients
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <Link
                to="/avis/nouveau"
                className="mt-3 flex items-center gap-2 min-h-10 text-xs font-semibold text-ambre hover:text-ambre-soft"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                Laisser mon avis
              </Link>
            </div>

            {reviews.length > 0 ? (
              <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {reviews.map((r: any) => (
                  <figure
                    key={r.id}
                    className="bg-white/8 border border-white/10 rounded-2xl p-5 flex flex-col"
                  >
                    <Stars rating={r.rating} />
                    <blockquote className="mt-3 text-xs text-ecru/85 leading-relaxed flex-1">
                      {r.body.length > 130 ? `${r.body.slice(0, 130).trim()}...` : r.body}
                    </blockquote>
                    <figcaption className="mt-4 text-[11px] text-ambre font-semibold">
                      {r.author_name}{r.author_city ? `, ${r.author_city}` : ''}
                    </figcaption>
                  </figure>
                ))}
              </Reveal>
            ) : (
              /* No published reviews yet. Inviting the first one is more honest
                 than showing invented testimonials. */
              <div className="grid place-items-center border border-dashed border-white/15 rounded-2xl p-10 text-center">
                <div>
                  <p className="text-sm text-ecru/80">
                    Les premiers avis arrivent bientôt.
                  </p>
                  <Link
                    to="/avis/nouveau"
                    className="mt-4 inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep text-ink font-bold px-5 h-11 rounded-xl text-xs transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                    Être le premier à donner son avis
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ================= WHY LOCAL ================= */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="values-title">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
            Pourquoi choisir LUCÉA
          </p>
          <h2 id="values-title" className="mt-3 text-2xl sm:text-[2rem] font-serif font-bold text-ink">
            Un atelier local, des valeurs qui comptent
          </h2>
        </div>

        <SectionBody className="mt-10 sm:mt-12">
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 lg:gap-8">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 sm:block">
                <span className="w-11 h-11 rounded-full bg-ambre-soft grid place-items-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-terracotta" aria-hidden="true" />
                </span>
                <div className="sm:mt-5">
                  <h3 className="font-semibold text-ink text-sm">{title}</h3>
                  <p className="mt-2 text-xs text-pierre-deep leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================= NEWSLETTER ================= */}
      <section className="relative isolate overflow-hidden border-t border-pierre-line">
        <img
          src="/images/newsletter.webp"
          srcSet="/images/newsletter-900.webp 900w, /images/newsletter.webp 1600w"
          sizes="100vw"
          alt=""
          width={1600}
          height={854}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[70%_center]"
        />
        <div
          className="absolute inset-0 bg-ecru/80 sm:bg-gradient-to-r sm:from-ecru sm:from-14% sm:via-ecru/62 sm:via-48% sm:to-transparent sm:to-72%"
          aria-hidden="true"
        />

        <Container className="relative">
          <div className="py-14 sm:py-20 max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
              Offre de bienvenue
            </p>
            <h2 className="mt-4 text-2xl sm:text-[2rem] font-serif font-bold text-ink leading-tight">
              10% sur votre première commande
            </h2>
            <p className="mt-4 text-sm text-ink-soft leading-relaxed">
              Inscrivez vous et recevez votre code de réduction, ainsi que nos
              nouveautés en avant première.
            </p>

            {subscribed ? (
              <p
                role="status"
                className="mt-7 inline-flex items-center gap-2.5 bg-succes-soft text-succes px-5 py-3.5 rounded-xl text-sm font-semibold"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                Merci, votre code arrive par email.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="mt-7 flex flex-col sm:flex-row gap-3">
                <label htmlFor="newsletter-email" className="sr-only">
                  Votre adresse email
                </label>
                <div className="relative flex-1">
                  <Mail
                    className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-pierre-deep pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre adresse e-mail"
                    /* 16px so iOS does not zoom the page on focus */
                    className="w-full h-13 bg-white border border-pierre-line rounded-xl pl-11 pr-4 text-base sm:text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-13 rounded-xl transition-colors disabled:opacity-60 shrink-0"
                >
                  {subscribing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Recevoir mon code
                </button>
              </form>
            )}

            {subscribeError && (
              <p role="alert" className="mt-4 text-xs text-alerte bg-alerte-soft px-4 py-3 rounded-xl">
                {subscribeError}
              </p>
            )}

            <p className="mt-4 text-[11px] text-pierre-deep">
              Un email par mois au maximum. Désinscription en un clic.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
};
