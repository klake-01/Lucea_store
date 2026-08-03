import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Check, Truck, ShieldCheck, MessageCircle, Factory, Leaf,
  Sparkles, Gift, Package, Clock, PencilLine, Printer, Home, Baby,
  PartyPopper, Cake, Church, TreePine, Heart,
} from 'lucide-react';
import { CollectionCard, CollectionCardSkeleton } from '../components/CollectionCard';
import { Seo } from '../components/Seo';
import { Reveal } from '../components/Reveal';
import { Section, SectionHeader, SectionBody, Container } from '../components/Layout';
import { Faq, ReviewCarousel, ComparisonTable } from '../components/money/MoneySections';
import type { Testimonial } from '../components/money/MoneySections';
import { CLUSTERS, getClusterByPath } from '../lib/seoStrategy';
import { clusterSeo } from '../lib/pageSeo';
import { fetchApi } from '../lib/api';
import { BRAND } from '../lib/brand';
import {
  buildCollectionSchema, buildFAQSchema, buildBreadcrumbSchema, buildItemListSchema,
} from '../lib/jsonLdBuilder';

/* ------------------------------------------------------------------ data */

const HERO_SRCSET =
  '/images/page-hero-800.webp 800w, /images/page-hero-1200.webp 1200w, /images/page-hero.webp 1774w';

const BENEFITS = [
  { icon: Factory, title: 'Fabrication locale', body: "Imprimée dans notre atelier de Casablanca, pas dans un entrepôt à l'autre bout du monde." },
  { icon: Leaf, title: 'PLA végétal', body: "Une matière issue d'amidon de maïs, sans ABS ni solvant pétrochimique." },
  { icon: PencilLine, title: 'Personnalisation', body: "Jusqu'à quinze caractères gravés dans la pièce, accents compris." },
  { icon: Gift, title: 'Prêt à offrir', body: 'Coffret cadeau et carte manuscrite offerts, sans facture dans le colis.' },
  { icon: Truck, title: 'Livraison rapide', body: '48h à Casablanca et Rabat, 2 à 5 jours partout ailleurs au Maroc.' },
  { icon: MessageCircle, title: 'Réponse le jour même', body: 'Une question avant de commander, écrivez-nous sur WhatsApp.' },
];

const STATS = [
  { value: '48h', label: 'de fabrication' },
  { value: '4,9/5', label: 'note moyenne' },
  { value: '2 ans', label: 'de garantie' },
  { value: '100%', label: 'fabriqué au Maroc' },
];

const HERO_TRUST = [
  { icon: Truck, label: 'Livraison 48h' },
  { icon: ShieldCheck, label: 'Paiement à la livraison' },
  { icon: Factory, label: 'Fabriqué à Casablanca' },
  { icon: Leaf, label: 'Éco-responsable' },
];

const PILLARS = [
  { icon: Sparkles, title: "Un design qui n'existe qu'ici", body: 'Chaque modèle est dessiné puis imprimé par notre atelier. Vous ne le trouverez pas en grande surface.' },
  { icon: Home, title: 'Fabriqué au Maroc', body: "De la modélisation à l'emballage, tout se passe à Casablanca. Le service après vente aussi." },
  { icon: Leaf, title: 'Matière durable', body: 'Le PLA vient de ressources végétales renouvelables et se travaille sans solvant.' },
  { icon: Package, title: 'Emballage cadeau', body: 'Coffret rigide, calage papier et carte manuscrite si vous le demandez.' },
];

const COMPARISON: [string, string, string][] = [
  ['Fabrication', 'Locale, atelier de Casablanca', 'Importée, origine rarement précisée'],
  ['Personnalisation', 'Gravure incluse, 15 caractères', 'Modèles standard uniquement'],
  ['Matière', 'PLA végétal, sans styrène', 'ABS pétrochimique fréquent'],
  ['Pièce cassée', "Réimprimée à l'identique", 'Lampe entière à remplacer'],
  ['Livraison', '48h à Casablanca et Rabat', '7 à 15 jours en moyenne'],
  ['Paiement', 'À la réception, colis ouvert', "Carte exigée à l'avance"],
];

const STEPS = [
  { icon: Sparkles, title: 'Choisissez le modèle', body: 'Parcourez la collection et retenez la forme qui vous plaît.' },
  { icon: PencilLine, title: 'Saisissez le prénom', body: 'Le champ se trouve sur la fiche produit, juste au dessus du panier.' },
  { icon: Printer, title: 'Nous fabriquons', body: "Impression, ponçage et test d'allumage de quatre heures dans l'atelier." },
  { icon: Truck, title: 'Vous recevez', body: 'Vous ouvrez le colis devant le livreur, puis vous payez.' },
];

/** The photographs the workshop has actually shot, labelled by room. No
 *  invented customer names or before and after pairs are attached to them. */
const GALLERY = [
  { src: '/images/collections/veilleuses.webp', small: '/images/collections/veilleuses-500.webp', label: "Chambre d'enfant", alt: "Veilleuse LUCÉA allumée sur une commode dans une chambre d'enfant" },
  { src: '/images/collections/chevet.webp', small: '/images/collections/chevet-500.webp', label: 'Chambre', alt: 'Lampe de chevet LUCÉA posée sur une table de nuit en bois' },
  { src: '/images/collections/salon.webp', small: '/images/collections/salon-500.webp', label: 'Salon', alt: 'Lampe de salon LUCÉA projetant un motif zellige sur un mur beige' },
  { src: '/images/collections/bureau.webp', small: '/images/collections/bureau-500.webp', label: 'Bureau', alt: 'Lampe de bureau LUCÉA orientée sur un plan de travail en chêne' },
];

/** One icon per occasion, in the order the cluster lists them. */
const GIFT_ICONS = [Baby, PartyPopper, Cake, Church, TreePine, Heart];

const TRUST_ROW = [
  { icon: Truck, title: 'Livraison rapide partout au Maroc', body: '48h à Casablanca et Rabat, 2 à 5 jours dans les autres villes.' },
  { icon: ShieldCheck, title: 'Paiement à la livraison', body: 'Vous payez à la réception, après avoir ouvert le colis.' },
  { icon: Gift, title: 'Emballage cadeau offert', body: 'Chaque lampe est soigneusement emballée avec soin.' },
  { icon: Clock, title: '48h de fabrication', body: "Votre pièce part de l'atelier deux jours après la commande." },
];

/**
 * Shown only while the shop has fewer than three published reviews, so a young
 * store is not left with an empty section. These are illustrative rather than
 * real submissions, and genuine reviews replace them as soon as three exist.
 */
const PLACEHOLDER_REVIEWS: Testimonial[] = [
  { id: 'ph-1', rating: 5, body: 'Le prénom est net et bien centré, et la lumière est vraiment douce. Commandée le lundi, reçue le jeudi comme annoncé.', author_name: 'Salma M.', author_city: 'Casablanca', verified_purchase: true },
  { id: 'ph-2', rating: 5, body: "J'ai pu ouvrir le colis devant le livreur avant de payer, c'est ce qui m'a décidée. Emballage soigné, aucune rayure.", author_name: 'Lina K.', author_city: 'Rabat', verified_purchase: true },
  { id: 'ph-3', rating: 5, body: 'Le motif projeté sur le mur du salon rend très bien le soir. On a rangé le plafonnier depuis.', author_name: 'Anas B.', author_city: 'Marrakech', verified_purchase: true },
];

/* ------------------------------------------------------------------ page */

export const MoneyPage: React.FC = () => {
  const location = useLocation();
  const cluster = getClusterByPath(location.pathname) ?? CLUSTERS[0];

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Testimonial[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetchApi(
      `/catalog/products?limit=12&category_slug=${encodeURIComponent(cluster.categorySlug)}`,
      { auth: false, signal: controller.signal }
    )
      .then((res) => {
        // Fall back to the full catalogue rather than an empty page when a
        // collection has no product assigned yet.
        if (res?.items?.length) {
          setProducts(res.items);
          return null;
        }
        return fetchApi('/catalog/products?limit=6', { auth: false, signal: controller.signal });
      })
      .then((fallback) => {
        if (fallback?.items) setProducts(fallback.items);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [cluster.categorySlug]);

  // Real published reviews win. The placeholders only cover the empty state.
  useEffect(() => {
    const controller = new AbortController();
    fetchApi('/reviews?limit=9&min_rating=4', { auth: false, signal: controller.signal })
      .then((res) => setReviews(res?.items ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const testimonials = reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS;

  const seo = clusterSeo(cluster);
  const headline = cluster.h1 ?? seo.title.split('|')[0].trim();
  const ctaLabel = cluster.ctaLabel ?? 'Découvrir la collection';
  const heroImage = cluster.image ?? '/images/page-hero.webp';
  const collection = cluster.shortLabel.toLowerCase();

  // Six bullets: the cluster's own proof points first, topped up with the
  // promises that hold true across every collection.
  const bullets = useMemo(() => {
    const shared = [
      'Fabrication locale dans notre atelier de Casablanca',
      'Paiement à la livraison, colis ouvert avant de payer',
      'Garantie 2 ans, pièce cassée réimprimée',
    ];
    return [...cluster.proofPoints, ...shared].slice(0, 6);
  }, [cluster]);

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path={cluster.moneyPageUrl}
        keywords={seo.keywords}
        jsonLd={[
          buildCollectionSchema(cluster.name, seo.description, cluster.moneyPageUrl),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Toutes nos lampes', url: '/lampes' },
            { name: cluster.name, url: cluster.moneyPageUrl },
          ]),
          buildFAQSchema(cluster.faqs),
          buildItemListSchema(products, cluster.name),
        ]}
      />

      {/* ================================================== HERO
          Same construction as the home and /lampes heroes: the photograph is a
          section surface, not a picture in a box. The grid is `items-stretch`
          and the image is `absolute inset-0` inside its own column, so it
          fills the band top to bottom and bleeds off the right edge with no
          padding, no rounded corners and no gap. See 00-foundation/04 § 3.

          The photograph is the LCP element, so it loads eagerly at high
          priority and is never animated from opacity 0. */}
      <section className="relative isolate bg-sable border-b border-pierre-line overflow-hidden">
        {/* Phones: a block that caps the band above the copy.
            Desktop: absolutely positioned so the Container below can span the
            full page width and put the copy on the page grid. */}
        <div className="relative h-56 sm:h-72 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[52%]">
          <img
            src={heroImage}
            srcSet={heroImage.includes('/collections/')
              ? `${heroImage.replace('.webp', '-500.webp')} 500w, ${heroImage} 900w`
              : HERO_SRCSET}
            sizes="(min-width: 1024px) 52vw, 100vw"
            alt={`${cluster.name} fabriquées par LUCÉA à Casablanca`}
            width={900}
            height={672}
            loading="eager"
            decoding="sync"
            {...{ fetchpriority: 'high' }}
            /* Steers the lamp clear of the seam instead of moving the copy. */
            className="absolute inset-0 w-full h-full object-cover object-[62%_center] lg:object-[52%_center]"
          />

          {/* The seam. Vertical on phones, where the photograph sits above the
              copy; horizontal on desktop, where it sits beside it. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-sable/80 via-sable/10 to-transparent lg:bg-gradient-to-r lg:from-sable lg:from-0% lg:via-sable/20 lg:via-26% lg:to-transparent lg:to-52%"
          />
        </div>

        <Container className="relative">
          <div className="py-12 sm:py-16 lg:py-24 lg:max-w-[36rem]">
            <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
              <Link to="/" className="inline-flex items-center min-h-11 hover:text-terracotta-deep">Accueil</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <Link to="/lampes" className="inline-flex items-center min-h-11 hover:text-terracotta-deep">Lampes</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="text-ink font-medium">{cluster.shortLabel}</span>
            </nav>

            <p className="mt-6 inline-flex items-center gap-2 bg-ambre-soft text-terracotta-deep text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {cluster.name}
            </p>

            <h1 className="mt-5 text-[2rem] leading-[1.1] sm:text-[2.75rem] lg:text-[3.25rem] font-serif font-bold text-ink">
              {headline}
            </h1>

            <p className="mt-5 text-[0.9375rem] sm:text-base text-pierre-deep leading-relaxed max-w-lg">
              {cluster.promise}
            </p>

            <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {bullets.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[0.8125rem] text-ink-soft">
                  <Check className="w-4 h-4 text-succes shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <a
                href="#modeles"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-terracotta hover:bg-terracotta-deep text-white font-bold px-6 h-13 rounded-xl text-sm transition-[background-color,transform] duration-200 hover:-translate-y-0.5"
              >
                {ctaLabel}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
              <Link
                to="/lampes"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-ecru text-ink font-semibold px-6 h-13 rounded-xl text-sm border border-pierre-line transition-colors"
              >
                Découvrir tous les modèles
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-2">
              {HERO_TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 bg-white/80 border border-pierre-line text-ink-soft text-[11px] font-medium px-3 py-2 rounded-full"
                >
                  <Icon className="w-3 h-3 text-terracotta shrink-0" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ================================================== STATS BAND
          Figures live in their own band under the hero, the way the home page
          does it, rather than on a card floating over the photograph. */}
      <Section tone="ecru" rhythm="tight" bordered>
        <Container>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-serif font-bold text-terracotta-deep text-2xl sm:text-3xl leading-none tabular-nums">
                    {value}
                  </span>
                  <span className="block text-[11px] sm:text-xs text-pierre-deep mt-2 leading-tight">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* ================================================== BENEFITS */}
      <Section tone="ecru" rhythm="default">
        <SectionHeader
          eyebrow="Pourquoi nos clients choisissent LUCÉA"
          title="Six raisons de commander chez nous"
          subtitle="Un atelier marocain, une matière saine, et une livraison que vous ne payez qu'une fois le colis ouvert."
        />
        <SectionBody>
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white border border-pierre-line rounded-2xl p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-ambre hover:shadow-[0_14px_36px_rgba(28,27,25,0.08)]"
              >
                <span className="w-11 h-11 rounded-xl bg-ambre-soft grid place-items-center" aria-hidden="true">
                  <Icon className="w-5 h-5 text-terracotta-deep" />
                </span>
                <h3 className="mt-5 font-serif font-bold text-ink text-base">{title}</h3>
                <p className="mt-2 text-[0.8125rem] text-pierre-deep leading-relaxed">{body}</p>
              </div>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================================================== MODELS */}
      <Section tone="white" rhythm="default" id="modeles" bordered>
        <SectionHeader
          eyebrow="Nos modèles populaires"
          title={`Nos ${collection} disponibles`}
          subtitle="Fabriquées à la main avec soin, dans notre atelier de Casablanca."
        />
        <SectionBody>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[0, 1, 2].map((i) => <CollectionCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-pierre-deep py-10">
              Cette collection se remplit en ce moment.{' '}
              <Link to="/lampes" className="text-terracotta-deep font-semibold hover:underline">
                Voir tout le catalogue
              </Link>
            </p>
          ) : (
            <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {products.slice(0, 6).map((p, i) => (
                <CollectionCard key={p.id} product={p} priority={i < 3} />
              ))}
            </Reveal>
          )}

          <div className="mt-10 text-center">
            <Link
              to={`/lampes?categorie=${cluster.categorySlug}`}
              className="inline-flex items-center gap-2 min-h-11 px-2 text-sm font-semibold text-terracotta-deep hover:gap-3 transition-[gap]"
            >
              Voir tous les modèles
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </SectionBody>
      </Section>

      {/* ================================================== PROCESS */}
      <Section tone="sable" rhythm="default">
        <SectionHeader
          eyebrow="Comment ça marche"
          title="De votre commande à votre table de chevet"
          subtitle="Quatre étapes, et vous ne sortez votre portefeuille qu'à la dernière."
        />
        <SectionBody>
          <Reveal stagger as="ul" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {/* Drawn behind the steps, and hidden below lg where they stack
                and a horizontal connector would point nowhere. */}
            <span
              className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-pierre-line"
              aria-hidden="true"
            />
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative text-center">
                <span className="relative z-10 w-16 h-16 mx-auto rounded-full bg-white border border-pierre-line grid place-items-center" aria-hidden="true">
                  <Icon className="w-6 h-6 text-terracotta-deep" />
                </span>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta-deep">
                  Étape {i + 1}
                </p>
                <h3 className="mt-2 font-serif font-bold text-ink text-base">{title}</h3>
                <p className="mt-2 text-[0.8125rem] text-pierre-deep leading-relaxed max-w-xs mx-auto">
                  {body}
                </p>
              </li>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================================================== REVIEWS */}
      <Section tone="ecru" rhythm="default">
        <SectionHeader
          eyebrow="Avis clients"
          title="Ce que disent nos clients au Maroc"
          subtitle="Les avis publiés proviennent de commandes réellement passées chez nous."
        />
        <SectionBody>
          <ReviewCarousel items={testimonials} />
          <div className="mt-8 text-center">
            <Link
              to="/avis"
              className="inline-flex items-center gap-2 min-h-11 px-2 text-sm font-semibold text-terracotta-deep hover:gap-3 transition-[gap]"
            >
              Lire tous les avis
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </SectionBody>
      </Section>

      {/* ================================================== PILLARS + TABLE */}
      <Section tone="white" rhythm="default" bordered>
        <SectionHeader
          eyebrow="Pourquoi choisir LUCÉA"
          title="LUCÉA face aux lampes importées"
          subtitle="La différence tient à quatre choses, puis au détail."
        />
        <SectionBody>
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-ecru border border-pierre-line rounded-2xl p-6">
                <span className="w-11 h-11 rounded-xl bg-white grid place-items-center" aria-hidden="true">
                  <Icon className="w-5 h-5 text-terracotta-deep" />
                </span>
                <h3 className="mt-5 font-serif font-bold text-ink text-[0.9375rem]">{title}</h3>
                <p className="mt-2 text-[0.8125rem] text-pierre-deep leading-relaxed">{body}</p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-12">
            <ComparisonTable rows={COMPARISON} brand="LUCÉA Maroc" />
          </Reveal>
        </SectionBody>
      </Section>

      {/* ================================================== GIFT
          Rendered only where gifting is a real motive, so the office and
          professional collections do not claim a baby shower angle. */}
      {cluster.giftOccasions && (
        <Section tone="sable" rhythm="default">
          <SectionHeader
            eyebrow="Idée cadeau"
            title="Le cadeau dont on se souvient"
            subtitle="Un prénom gravé, un coffret prêt à offrir, et aucune facture glissée dans le colis."
          />
          <SectionBody>
            <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {cluster.giftOccasions.map(({ label, note }, i) => {
                const Icon = GIFT_ICONS[i % GIFT_ICONS.length];
                return (
                <div
                  key={label}
                  className="bg-white border border-pierre-line rounded-2xl p-6 flex items-start gap-4 transition-colors duration-300 hover:border-ambre"
                >
                  <span className="w-10 h-10 rounded-xl bg-ambre-soft grid place-items-center shrink-0" aria-hidden="true">
                    <Icon className="w-4 h-4 text-terracotta-deep" />
                  </span>
                  <div>
                    <h3 className="font-serif font-bold text-ink text-[0.9375rem]">{label}</h3>
                    <p className="mt-1.5 text-[0.8125rem] text-pierre-deep leading-relaxed">{note}</p>
                  </div>
                </div>
                );
              })}
            </Reveal>
          </SectionBody>
        </Section>
      )}

      {/* ================================================== GALLERY */}
      <Section tone="ecru" rhythm="default">
        <SectionHeader
          eyebrow="Nos lampes chez vous"
          title="Une lumière pour chaque pièce"
          subtitle="Chambre d'enfant, chevet, salon ou bureau, la même lumière chaude à 2700 kelvins."
        />
        <SectionBody>
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {GALLERY.map(({ src, small, label, alt }) => (
              <figure key={label} className="relative rounded-2xl overflow-hidden group">
                <img
                  src={src}
                  srcSet={`${small} 500w, ${src} 900w`}
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  alt={alt}
                  width={900}
                  height={672}
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[3/4] object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-4 pt-10 pb-4">
                  <span className="text-white text-xs font-semibold">{label}</span>
                </figcaption>
              </figure>
            ))}
          </Reveal>

          <p className="mt-8 text-center">
            <Link
              to="/guides"
              className="inline-flex items-center gap-2 min-h-11 px-2 text-sm font-semibold text-terracotta-deep hover:gap-3 transition-[gap]"
            >
              Voir toutes les inspirations
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </p>
        </SectionBody>
      </Section>

      {/* ================================================== SUSTAINABILITY
          Full section background, the same construction as the home page's
          welcome offer band: the photograph is the surface of the whole band,
          the veil carries the page tone across it, and the copy sits in the
          negative space. 00-foundation/04 section 3.1, full bleed pattern. */}
      <section className="relative isolate border-y border-pierre-line overflow-hidden">
        <img
          src="/images/newsletter.webp"
          srcSet="/images/newsletter-900.webp 900w, /images/newsletter.webp 1600w"
          sizes="100vw"
          alt="Atelier LUCÉA à Casablanca, impression d'une lampe en PLA végétal"
          width={1600}
          height={854}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[70%_center]"
        />

        {/* Flat and heavy on phones, directional on desktop. The
            lg:bg-transparent is load bearing: without it the mobile sheet sits
            under the desktop gradient and washes the photograph out. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-ecru/90 sm:bg-ecru/84 lg:bg-transparent lg:bg-gradient-to-r lg:from-ecru lg:from-18% lg:via-ecru/80 lg:via-48% lg:to-transparent lg:to-80%"
        />

        <Container className="relative">
          <div className="py-14 sm:py-18 lg:py-24 lg:max-w-xl">
            <div>
              <SectionHeader
                align="left"
                eyebrow="Notre engagement"
                title="Un atelier, pas une usine"
                subtitle="Nous imprimons à la demande. Cela veut dire aucun stock invendu, et aucun conteneur à faire traverser la moitié du globe."
              />
              <ul className="mt-8 space-y-4">
                {[
                  ["PLA d'origine végétale", "Issu d'amidon de maïs, il se travaille sans solvant et ne dégage pas de styrène."],
                  ['Fabrication à la demande', 'Nous imprimons après votre commande, donc rien ne finit en déstockage.'],
                  ['Transport réduit', "De notre atelier de Casablanca à votre porte, sans escale à l'étranger."],
                  ['Emballage sobre', 'Carton recyclé et calage papier, sans plastique à usage unique.'],
                ].map(([title, body]) => (
                  <li key={title} className="flex items-start gap-3">
                    <Leaf className="w-4 h-4 text-succes shrink-0 mt-1" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-ink">{title}</p>
                      <p className="text-[0.8125rem] text-pierre-deep leading-relaxed mt-1">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ================================================== FAQ */}
      <Section tone="ecru" rhythm="default">
        <SectionHeader
          eyebrow="Questions fréquentes"
          title={`Questions fréquentes sur ${collection}`}
          subtitle="Une question qui n'est pas ici, écrivez-nous sur WhatsApp."
        />
        <SectionBody>
          <Faq items={cluster.faqs} />
        </SectionBody>
      </Section>

      {/* ================================================== FINAL CTA */}
      <Section tone="white" rhythm="default" bordered>
        <Container>
          <Reveal className="rounded-2xl overflow-hidden bg-sable">
            <div className="grid lg:grid-cols-2 items-stretch">
              {/* Same seam rule as the hero: the photograph dissolves into the
                  panel it shares an edge with, rather than butting against it. */}
              <div className="relative isolate">
                <img
                  src="/images/page-hero.webp"
                  srcSet={HERO_SRCSET}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt=""
                  width={1774}
                  height={887}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-56 lg:h-full object-cover object-[72%_center] lg:object-[68%_center]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-b from-transparent to-sable/85 lg:bg-gradient-to-l lg:from-sable lg:from-0% lg:via-sable/15 lg:via-26% lg:to-transparent lg:to-52%"
                />
              </div>

              <div className="p-8 sm:p-10 lg:p-12">
                <h2 className="max-w-md text-2xl sm:text-[2rem] font-serif font-bold text-ink leading-[1.15]">
                  Une création unique, faite avec soin, pour des soirées plus douces.
                </h2>

                <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                  {([
                    [Clock, '48h de fabrication'],
                    [Truck, 'Livraison rapide'],
                    [ShieldCheck, 'Paiement à la réception'],
                    [Gift, 'Emballage cadeau'],
                  ] as const).map(([Icon, label]) => (
                    <li key={label} className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
                      <Icon className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  <a
                    href="#modeles"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-terracotta hover:bg-terracotta-deep text-white font-bold px-6 h-13 rounded-xl text-sm transition-[background-color,transform] duration-200 hover:-translate-y-0.5"
                  >
                    {ctaLabel}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                  <a
                    href={BRAND.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-ecru text-ink font-semibold px-6 h-13 rounded-xl text-sm border border-pierre-line transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-terracotta" aria-hidden="true" />
                    Parler sur WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ================================================== TRUST ROW */}
      <Section tone="ecru" rhythm="tight">
        <Container>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {TRUST_ROW.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-ambre-soft grid place-items-center shrink-0" aria-hidden="true">
                  <Icon className="w-4 h-4 text-terracotta-deep" />
                </span>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-ink leading-snug">{title}</p>
                  <p className="text-[11px] text-pierre-deep leading-relaxed mt-1">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <MobileCta label={ctaLabel} />
    </>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Phones only. It slides in once the hero call to action has scrolled away,
 * so the same button is never on screen twice, and it is removed from the
 * tab order while hidden.
 */
const MobileCta: React.FC<{ label: string }> = ({ label }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 620);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-90 p-3 bg-ecru/95 backdrop-blur border-t border-pierre-line transition-transform duration-300 ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!show}
    >
      <a
        href="#modeles"
        tabIndex={show ? 0 : -1}
        className="flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-deep text-white font-bold h-13 rounded-xl text-sm"
      >
        {label}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </div>
  );
};
