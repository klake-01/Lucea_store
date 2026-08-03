import React from 'react';

/**
 * Layout primitives.
 *
 * Every page composes from these instead of inventing its own paddings, so
 * the vertical rhythm and the horizontal gutter are identical everywhere.
 * Rule from 06-build-storefront/02: no page invents styles.
 */

type Tone = 'ecru' | 'sable' | 'white';
type Rhythm = 'tight' | 'default' | 'loose' | 'none';

const TONE: Record<Tone, string> = {
  ecru: 'bg-ecru',
  sable: 'bg-sable',
  white: 'bg-white',
};

// One of three vertical steps. Sections never pick an arbitrary value.
const RHYTHM: Record<Rhythm, string> = {
  none: '',
  tight: 'py-12 sm:py-14',
  default: 'py-14 sm:py-18',
  loose: 'py-16 sm:py-24',
};

const WIDTH = {
  page: 'max-w-[1200px]',
  narrow: 'max-w-3xl',
  reading: 'max-w-[68ch]',
  wide: 'max-w-[1360px]',
} as const;

export const Container: React.FC<{
  children: React.ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
}> = ({ children, width = 'page', className = '' }) => (
  <div className={`${WIDTH[width]} mx-auto px-5 sm:px-6 lg:px-8 ${className}`}>
    {children}
  </div>
);

/**
 * A full bleed horizontal band with its own background and vertical rhythm.
 * Adjacent bands of the same tone are separated by a hairline rather than
 * doubling their padding, which is what made the old page read as one blob.
 */
export const Section: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  rhythm?: Rhythm;
  width?: keyof typeof WIDTH;
  bordered?: boolean;
  id?: string;
  className?: string;
  'aria-labelledby'?: string;
}> = ({
  children,
  tone = 'ecru',
  rhythm = 'default',
  width = 'page',
  bordered = false,
  id,
  className = '',
  ...rest
}) => (
  <section
    id={id}
    className={`${TONE[tone]} ${RHYTHM[rhythm]} ${bordered ? 'border-y border-pierre-line' : ''} ${id ? 'scroll-mt-32' : ''} ${className}`}
    {...rest}
  >
    <Container width={width}>{children}</Container>
  </section>
);

/**
 * Eyebrow, heading and standfirst as one block, so the gap between a title
 * and its subtitle is the same on every page.
 */
export const SectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
}> = ({ eyebrow, title, subtitle, align = 'center', as = 'h2', id, className = '' }) => {
  const Heading = as;
  const centered = align === 'center';

  return (
    <div
      className={`${centered ? 'text-center mx-auto max-w-2xl' : 'text-left max-w-2xl'} ${className}`}
    >
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep mb-3">
          {eyebrow}
        </p>
      )}
      <Heading
        id={id}
        className={as === 'h1'
          ? 'text-[2rem] leading-[1.12] sm:text-[2.75rem] font-serif font-bold text-ink'
          : 'text-2xl sm:text-[2rem] font-serif font-bold text-ink'}
      >
        {title}
      </Heading>
      {subtitle && (
        <p className={`text-[0.9375rem] sm:text-base text-pierre-deep leading-relaxed mt-4 ${centered ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

/** Consistent gap between a section header and the content beneath it. */
export const SectionBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`mt-10 sm:mt-12 ${className}`}>{children}</div>;
