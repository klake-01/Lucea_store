import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, Link2, Check, Facebook, Twitter, MessageCircle, Clock,
  Calendar, ArrowRight, ShieldCheck, Truck, List, HelpCircle,
} from 'lucide-react';
import { Container } from '../Layout';
import { BRAND } from '../../lib/brand';

/**
 * The article reading experience — `00-foundation/05-BLOG-SYSTEM.md` part C.
 *
 * Every article renders these blocks in the same order, so the layout is a
 * constant rather than something each post negotiates. The two rules from part
 * C that shape most of this file:
 *
 *  - exactly one `<h1>` (the title), and the body starts at `<h2>`
 *  - no component here emits JSON-LD. The server owns schema (part B.3), and
 *    the page injects what the server computed.
 */

/* ------------------------------------------------------- C.1 progress bar */

export const ReadingProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max <= 0 ? 0 : Math.min(100, (window.scrollY / max) * 100));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className="fixed top-0 inset-x-0 z-300 h-0.5 bg-transparent pointer-events-none"
      role="progressbar"
      aria-label="Progression de lecture"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-terracotta transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/* ----------------------------------------------------------- C.2 breadcrumb */

export const ArticleBreadcrumb: React.FC<{ title: string }> = ({ title }) => (
  <nav
    aria-label="Fil d ariane"
    className="flex flex-wrap items-center text-[11px] text-pierre-deep"
  >
    <Link to="/" className="inline-flex items-center min-h-11 hover:text-terracotta-deep">
      Accueil
    </Link>
    <span className="mx-2" aria-hidden="true">/</span>
    <Link to="/guides" className="inline-flex items-center min-h-11 hover:text-terracotta-deep">
      Guides
    </Link>
    <span className="mx-2" aria-hidden="true">/</span>
    <span className="text-ink font-medium truncate max-w-[22rem]">{title}</span>
  </nav>
);

/* ------------------------------------------------------- C.4 author box */

export const ArticleAuthorBox: React.FC<{
  author?: string | null;
  publishedDate?: string | null;
  readMinutes: number;
}> = ({ author, publishedDate, readMinutes }) => {
  const name = author?.trim() || BRAND.name;
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="flex items-center gap-4 bg-ecru border border-pierre-line rounded-2xl p-5">
      <span
        className="w-12 h-12 shrink-0 rounded-full bg-ambre-soft text-terracotta-deep grid place-items-center text-sm font-bold"
        aria-hidden="true"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-[11px] text-pierre-deep mt-0.5">
          Atelier d impression 3D, Casablanca
        </p>
        <p className="text-[11px] text-pierre-deep mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {publishedDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" aria-hidden="true" />
              {new Date(publishedDate).toLocaleDateString('fr-MA', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {readMinutes} min de lecture
          </span>
          <Link
            to="/a-propos"
            /* min-h-6 keeps this inline link at the 24px WCAG 2.5.8 AA floor
               without breaking the meta row onto another line. */
            className="inline-flex items-center min-h-6 text-terracotta-deep font-semibold hover:underline"
          >
            À propos de l atelier
          </Link>
        </p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------- C.5 share rail */

const shareTargets = (url: string, title: string) => [
  { label: 'Partager sur Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { label: 'Partager sur X', icon: Twitter, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { label: 'Partager sur WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
];

export const ArticleShare: React.FC<{ title: string; orientation?: 'rail' | 'row' }> = ({
  title,
  orientation = 'row',
}) => {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied; the other share targets still work */
    }
  };

  const cls = orientation === 'rail' ? 'flex-col' : 'flex-row flex-wrap';

  return (
    <div className={`flex ${cls} gap-2`} role="group" aria-label="Partager cet article">
      <button
        onClick={copy}
        aria-label={copied ? 'Lien copié' : 'Copier le lien'}
        className={`w-11 h-11 grid place-items-center rounded-xl border transition-colors ${
          copied
            ? 'bg-succes-soft border-succes text-succes'
            : 'bg-white border-pierre-line text-ink-soft hover:border-ambre'
        }`}
      >
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
      </button>

      {shareTargets(url, title).map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="w-11 h-11 grid place-items-center rounded-xl bg-white border border-pierre-line text-ink-soft hover:border-ambre transition-colors"
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------- C.7 TOC */

export interface TocEntry { id: string; text: string; }

export const ArticleTOC: React.FC<{ entries: TocEntry[] }> = ({ entries }) => {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.filter((r) => r.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      // Only counts a heading as current once it has reached the upper third,
      // otherwise every heading below the fold fights for the highlight.
      { rootMargin: '-80px 0px -66% 0px', threshold: 0 }
    );
    entries.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav
      aria-labelledby="toc-title"
      className="bg-ecru border border-pierre-line rounded-2xl p-5 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]"
    >
      <p id="toc-title" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-terracotta-deep">
        <List className="w-3.5 h-3.5" aria-hidden="true" />
        Sommaire
      </p>
      <ol className="mt-4 space-y-1">
        {entries.map(({ id, text }, i) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? 'true' : undefined}
              className={`flex gap-2 py-2 text-[0.8125rem] leading-snug transition-colors ${
                active === id
                  ? 'text-terracotta-deep font-semibold'
                  : 'text-ink-soft hover:text-terracotta-deep'
              }`}
            >
              <span className="text-pierre-deep tabular-nums shrink-0">{i + 1}.</span>
              <span>{text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

/* ------------------------------------------------------------- C.8 FAQ */

export const ArticleFAQ: React.FC<{ faqs: { question: string; answer: string }[] }> = ({ faqs }) => {
  const [open, setOpen] = useState<number | null>(0);
  if (faqs.length === 0) return null;

  return (
    <section aria-labelledby="faq-heading" className="mt-14">
      <h2 id="faq-heading" className="text-2xl font-serif font-bold text-ink">
        Questions fréquentes
      </h2>

      <div className="mt-6 space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div
              key={faq.question}
              className={`bg-white border rounded-2xl overflow-hidden transition-colors ${
                isOpen ? 'border-ambre' : 'border-pierre-line'
              }`}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`article-faq-${i}`}
                  id={`article-faq-btn-${i}`}
                  className="w-full flex items-center gap-3 text-left px-5 py-5 min-h-14"
                >
                  <span
                    className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 transition-colors ${
                      isOpen ? 'bg-ambre text-ink' : 'bg-ambre-soft text-terracotta-deep'
                    }`}
                    aria-hidden="true"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink leading-snug">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-pierre-deep shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              </h3>

              <div
                id={`article-faq-${i}`}
                role="region"
                aria-labelledby={`article-faq-btn-${i}`}
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  {/* Character identical to the FAQPage schema the server
                      emitted: both read the same `faqs` rows. */}
                  <p className="px-5 pb-5 pl-16 text-sm text-pierre-deep leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* --------------------------------------------------- C.9 related articles */

export interface RelatedCard {
  slug: string;
  title: string;
  excerpt?: string | null;
  banner_url?: string | null;
  banner_alt?: string | null;
  category?: string | null;
  read_minutes?: number;
}

export const RelatedArticles: React.FC<{ items: RelatedCard[] }> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-14">
      <h2 id="related-heading" className="text-2xl font-serif font-bold text-ink">
        À lire aussi
      </h2>

      <ul className="mt-6 grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              to={`/guides/${item.slug}`}
              className="group flex gap-4 bg-white border border-pierre-line rounded-2xl p-4 h-full transition-[border-color,transform] duration-300 hover:border-ambre hover:-translate-y-0.5"
            >
              <img
                src={item.banner_url || '/images/collections/veilleuses.webp'}
                alt=""
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                className="w-20 h-20 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0">
                {item.category && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-terracotta-deep">
                    {item.category}
                  </p>
                )}
                <p className="mt-1 text-sm font-serif font-semibold text-ink leading-snug line-clamp-2 group-hover:text-terracotta-deep transition-colors">
                  {item.title}
                </p>
                {item.read_minutes ? (
                  <p className="mt-2 text-[11px] text-pierre-deep">{item.read_minutes} min</p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

/* ------------------------------------------------------------ C.10 CTA */

export const ArticleCTA: React.FC<{
  cta?: { title?: string | null; description?: string | null; link?: string | null; category?: string | null } | null;
  fallbackLink: string;
}> = ({ cta, fallbackLink }) => {
  const title = cta?.title?.trim() || 'Découvrez nos lampes imprimées au Maroc';
  const description =
    cta?.description?.trim() ||
    'Fabriquées dans notre atelier de Casablanca, livrées en 48h et payées à la réception.';
  const link = cta?.link?.trim() || fallbackLink;

  return (
    <aside className="mt-14 bg-sable border border-pierre-line rounded-2xl p-7 sm:p-9">
      {cta?.category && (
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta-deep">
          {cta.category}
        </p>
      )}
      <h2 className="mt-2 text-xl sm:text-2xl font-serif font-bold text-ink leading-snug">
        {title}
      </h2>
      <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-xl">{description}</p>

      <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <Link
          to={link}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-terracotta hover:bg-terracotta-deep text-white font-bold px-6 h-13 rounded-xl text-sm transition-[background-color,transform] duration-200 hover:-translate-y-0.5"
        >
          Voir la collection
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <a
          href={BRAND.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-ecru text-ink font-semibold px-6 h-13 rounded-xl text-sm border border-pierre-line transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-terracotta" aria-hidden="true" />
          Poser une question
        </a>
      </div>

      <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
        {[
          [ShieldCheck, 'Paiement à la livraison'],
          [Truck, 'Livraison 48h à Casablanca et Rabat'],
        ].map(([Icon, label]: any) => (
          <li key={label} className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
            <Icon className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </aside>
  );
};

/* ------------------------------------------------- C.11 sticky mobile CTA */

export const StickyMobileCTA: React.FC<{ to: string; label?: string }> = ({
  to,
  label = 'Voir la collection',
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-90 p-3 bg-ecru/95 backdrop-blur border-t border-pierre-line transition-transform duration-300 ${show ? 'translate-y-0' : 'translate-y-full'}`}
      aria-hidden={!show}
    >
      <Link
        to={to}
        tabIndex={show ? 0 : -1}
        className="flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-deep text-white font-bold h-13 rounded-xl text-sm"
      >
        {label}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </div>
  );
};

/* ------------------------------------------- C.6 inline CRO product grid */

export interface GridProduct {
  id: string;
  name: string;
  slug: string;
  images?: { url: string; alt?: string }[];
  variants?: { id: string; price_cents: number; available?: number }[];
}

export const InlineProductGrid: React.FC<{ products: GridProduct[] }> = ({ products }) => {
  if (products.length === 0) return null;

  return (
    <aside
      aria-label="Nos lampes en rapport avec cet article"
      className="not-prose my-10 bg-ecru border border-pierre-line rounded-2xl p-5 sm:p-6"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta-deep">
        Nos lampes en rapport
      </p>
      <ul className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {products.slice(0, 4).map((p) => {
          const price = p.variants?.[0]?.price_cents;
          return (
            <li key={p.id}>
              <Link
                to={`/products/${p.slug}`}
                className="group block bg-white border border-pierre-line rounded-xl overflow-hidden h-full transition-[border-color,transform] duration-300 hover:border-ambre hover:-translate-y-0.5"
              >
                <img
                  src={p.images?.[0]?.url || '/images/collections/veilleuses.webp'}
                  alt={p.images?.[0]?.alt || p.name}
                  width={300}
                  height={300}
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3">
                  <p className="text-xs font-semibold text-ink leading-snug line-clamp-2 group-hover:text-terracotta-deep transition-colors">
                    {p.name}
                  </p>
                  {typeof price === 'number' && price > 0 && (
                    <p className="mt-1.5 text-xs font-serif font-bold text-ink tabular-nums">
                      {Math.round(price / 100)} MAD
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

/* --------------------------------------------------------- C.3 header */

export const ArticleHeader: React.FC<{
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  coverAlt?: string | null;
  category?: string | null;
}> = ({ title, excerpt, coverUrl, coverAlt, category }) => (
  <header>
    <Container>
      <div className="pt-8 max-w-[68ch]">
        <ArticleBreadcrumb title={title} />

        {category && (
          <p className="mt-5 inline-flex items-center gap-2 bg-ambre-soft text-terracotta-deep text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full">
            {category}
          </p>
        )}

        <h1 className="mt-5 text-[1.875rem] sm:text-[2.5rem] leading-[1.12] font-serif font-bold text-ink">
          {title}
        </h1>

        {excerpt && (
          <p className="mt-5 text-base sm:text-lg text-pierre-deep leading-relaxed">
            {excerpt}
          </p>
        )}
      </div>
    </Container>

    {coverUrl && (
      // The cover is the LCP element: eager, high priority, and never faded in.
      <div className="mt-8 relative isolate">
        <img
          src={coverUrl}
          alt={coverAlt || ''}
          width={1600}
          height={900}
          loading="eager"
          decoding="sync"
          {...{ fetchpriority: 'high' }}
          className="w-full aspect-[16/9] sm:aspect-[21/9] object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ecru/60 to-transparent"
        />
      </div>
    )}
  </header>
);
