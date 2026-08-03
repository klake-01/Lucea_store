import React from 'react';
import { Link } from 'react-router-dom';
import { Container } from './Layout';

/**
 * Hero backgrounds.
 *
 * Both photographs place the lamp on the right with open wall on the left, so
 * the copy sits in the negative space rather than over the subject. Two
 * performance rules apply (00-foundation/03 section 6):
 *
 *   - the hero image is the LCP element, so it is eager, high priority and
 *     never lazy loaded
 *   - nothing in the hero animates from opacity 0, or Lighthouse would measure
 *     the end of the animation instead of the paint
 *
 * srcset carries three widths: a DPR 3 phone must not pull the desktop asset.
 */

const HOME_HERO = '/images/home-hero.webp';
const HOME_HERO_MD = '/images/home-hero-1200.webp';
const HOME_HERO_SM = '/images/home-hero-800.webp';
const PAGE_HERO = '/images/page-hero.webp';
const PAGE_HERO_MD = '/images/page-hero-1200.webp';
const PAGE_HERO_SM = '/images/page-hero-800.webp';

/**
 * Home hero: editorial photograph full bleed, copy in the left negative space.
 *
 * On mobile the image sits behind the whole block under a heavier veil, because
 * there is no room for a side by side arrangement at 390px.
 */
export const HomeHero: React.FC<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede: React.ReactNode;
  rating?: React.ReactNode;
  primary: { to: string; label: React.ReactNode };
  secondary?: { to: string; label: React.ReactNode };
  proof?: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ eyebrow, title, lede, rating, primary, secondary, proof, aside }) => (
  <section className="relative isolate bg-sable border-b border-pierre-line overflow-hidden">
    <img
      src={HOME_HERO}
      srcSet={`${HOME_HERO_SM} 800w, ${HOME_HERO_MD} 1200w, ${HOME_HERO} 1536w`}
      sizes="100vw"
      alt="Lampe LUCÉA imprimée en 3D posée sur une table basse dans un salon lumineux"
      width={1536}
      height={1024}
      loading="eager"
      decoding="sync"
      {...{ fetchpriority: 'high' }}
      className="absolute inset-0 w-full h-full object-cover object-[62%_center] lg:object-[70%_center]"
    />

    {/*
      Legibility veil. A background colour and a background image both apply, so
      the flat mobile sheet has to be cleared with lg:bg-transparent or it would
      sit under the gradient and wash the photograph out.
    */}
    <div
      className="absolute inset-0 bg-ecru/82 sm:bg-ecru/70 lg:bg-transparent lg:bg-gradient-to-r lg:from-ecru lg:from-22% lg:via-ecru/72 lg:via-52% lg:to-transparent lg:to-78%"
      aria-hidden="true"
    />

    <Container className="relative">
      <div className="py-12 sm:py-20 lg:py-28 max-w-xl lg:max-w-[34rem]">
        {eyebrow}

        <h1 className="mt-5 sm:mt-6 text-[1.875rem] leading-[1.1] sm:text-[2.75rem] lg:text-[3.125rem] font-serif font-bold text-ink">
          {title}
        </h1>

        <p className="mt-5 text-[0.9375rem] sm:text-base lg:text-lg text-ink-soft leading-relaxed max-w-lg">
          {lede}
        </p>

        {rating && <div className="mt-6">{rating}</div>}

        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            to={primary.to}
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap bg-terracotta hover:bg-terracotta-deep text-white font-semibold px-7 h-13 rounded-xl transition-colors shadow-[0_2px_12px_rgba(183,91,57,0.22)]"
          >
            {primary.label}
          </Link>

          {secondary && (
            <Link
              to={secondary.to}
              className="inline-flex items-center justify-center whitespace-nowrap bg-white hover:bg-ecru text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>

        {proof && <div className="mt-8 sm:mt-10">{proof}</div>}
      </div>
    </Container>

    {/* Floating card, bottom right of the photograph on large screens only:
        below that it would cover the lamp it is meant to sit beside. */}
    {aside && (
      <div className="hidden xl:block absolute right-8 bottom-10 z-10">{aside}</div>
    )}
  </section>
);

/**
 * Shorter hero used by every page other than the home page. Centred copy over
 * the wide negative space of the second photograph.
 */
export const PageHero: React.FC<{
  breadcrumb?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'center' | 'left';
  priority?: boolean;
}> = ({ breadcrumb, eyebrow, title, lede, children, align = 'center', priority = true }) => {
  const centered = align === 'center';

  return (
    <section className="relative isolate bg-sable border-b border-pierre-line overflow-hidden">
      <img
        src={PAGE_HERO}
        srcSet={`${PAGE_HERO_SM} 800w, ${PAGE_HERO_MD} 1200w, ${PAGE_HERO} 1774w`}
        sizes="100vw"
        alt=""
        width={1774}
        height={887}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...(priority ? { fetchpriority: 'high' } : {})}
        className="absolute inset-0 w-full h-full object-cover object-[75%_center]"
      />

      <div
        className="absolute inset-0 bg-ecru/78 sm:bg-ecru/64 sm:bg-gradient-to-r sm:from-ecru sm:from-10% sm:via-ecru/62 sm:via-55% sm:to-ecru/25"
        aria-hidden="true"
      />

      <Container className="relative">
        <div className={`py-11 sm:py-18 ${centered ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}`}>
          {breadcrumb}

          {eyebrow && (
            <p className={`mt-6 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep bg-white px-4 py-2 rounded-full ${centered ? '' : 'w-fit'}`}>
              {eyebrow}
            </p>
          )}

          <h1 className="mt-5 text-[2rem] sm:text-[2.75rem] leading-[1.12] font-serif font-bold text-ink">
            {title}
          </h1>

          {lede && (
            <p className={`mt-5 text-sm sm:text-base text-ink-soft leading-relaxed max-w-xl ${centered ? 'mx-auto' : ''}`}>
              {lede}
            </p>
          )}

          {children && <div className="mt-8">{children}</div>}
        </div>
      </Container>
    </section>
  );
};
