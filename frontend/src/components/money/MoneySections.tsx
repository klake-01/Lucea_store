import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Check, X, Star, HelpCircle } from 'lucide-react';

/**
 * Pieces the money page is built from. They live here rather than inline so
 * MoneyPage stays readable, and so the accordion and the carousel keep their
 * keyboard behaviour in one place instead of being reimplemented per section.
 */

/* ---------------------------------------------------------------- Accordion */

export const Faq: React.FC<{ items: { question: string; answer: string }[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.question}
            className={`bg-white border rounded-2xl overflow-hidden transition-colors duration-200 ${
              isOpen ? 'border-ambre' : 'border-pierre-line'
            }`}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-button-${i}`}
                className="w-full flex items-center gap-3 text-left px-5 sm:px-6 py-5 min-h-14"
              >
                <span
                  className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 transition-colors ${
                    isOpen ? 'bg-ambre text-ink' : 'bg-ambre-soft text-terracotta-deep'
                  }`}
                  aria-hidden="true"
                >
                  <HelpCircle className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm sm:text-[0.9375rem] font-semibold text-ink leading-snug">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-pierre-deep shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </h3>

            {/* Animating grid-template-rows gives a real height transition
                without measuring the panel or locking it to a fixed height. */}
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-button-${i}`}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 sm:px-6 pb-5 pl-16 text-sm text-pierre-deep leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------------------------------------------------------------- Carousel */

export interface Testimonial {
  id: string;
  rating: number;
  body: string;
  author_name: string;
  author_city?: string | null;
  product_name?: string | null;
  verified_purchase: boolean;
}

/** First letters of the reviewer's name. We hold no customer photographs, so
 *  an initial is used rather than a stock portrait pretending to be them. */
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const ReviewCarousel: React.FC<{ items: Testimonial[] }> = ({ items }) => {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  useEffect(() => {
    sync();
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [items.length]);

  const nudge = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 420), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        /* Native scroll with snap points: it is swipeable on a phone and
           keyboard scrollable on a desktop without any drag handling. */
        className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label="Avis de nos clients, faites defiler pour en voir plus"
      >
        {items.map((r) => (
          <li
            key={r.id}
            className="snap-start shrink-0 w-[85%] sm:w-[22rem] bg-white border border-pierre-line rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-1" aria-label={`${r.rating} etoiles sur 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3.5 h-3.5 ${n <= r.rating ? 'text-ambre fill-ambre' : 'text-pierre-line'}`}
                  aria-hidden="true"
                />
              ))}
            </div>

            <p className="mt-4 text-sm text-ink-soft leading-relaxed flex-1">{r.body}</p>

            <div className="mt-6 pt-5 border-t border-pierre-line flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-full bg-ambre-soft text-terracotta-deep grid place-items-center text-xs font-bold shrink-0"
                aria-hidden="true"
              >
                {initials(r.author_name)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate">
                  {r.author_name}
                  {r.author_city ? `, ${r.author_city}` : ''}
                </p>
                {r.verified_purchase && (
                  <p className="text-[10px] text-succes font-semibold flex items-center gap-1 mt-0.5">
                    <Check className="w-3 h-3" aria-hidden="true" />
                    Achat verifie
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden sm:flex justify-end gap-2 mt-6">
        {([['Precedent', -1, ChevronLeft, atStart], ['Suivant', 1, ChevronRight, atEnd]] as const).map(
          ([label, dir, Icon, disabled]) => (
            <button
              key={label}
              onClick={() => nudge(dir as 1 | -1)}
              disabled={disabled}
              aria-label={`${label} avis`}
              className="w-11 h-11 grid place-items-center rounded-full bg-white border border-pierre-line text-ink hover:border-ambre transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </button>
          )
        )}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- Table */

export const ComparisonTable: React.FC<{
  rows: [string, string, string][];
  brand: string;
}> = ({ rows, brand }) => (
  <div className="max-w-4xl mx-auto bg-white border border-pierre-line rounded-2xl overflow-hidden">
    {/* The table scrolls inside its own box so the page body never does. */}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[36rem]">
        <caption className="sr-only">
          Comparaison entre {brand} et les lampes importees
        </caption>
        <thead>
          <tr className="bg-ecru border-b border-pierre-line">
            <th scope="col" className="py-4 px-5 text-xs font-semibold text-pierre-deep">
              Critere
            </th>
            <th scope="col" className="py-4 px-5 text-xs font-bold text-ink">
              {brand}
            </th>
            <th scope="col" className="py-4 px-5 text-xs font-semibold text-pierre-deep">
              Lampes importees
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pierre-line">
          {rows.map(([criterion, ours, theirs]) => (
            <tr key={criterion} className="hover:bg-ecru/60 transition-colors">
              <th scope="row" className="py-4 px-5 text-xs font-semibold text-ink align-top">
                {criterion}
              </th>
              <td className="py-4 px-5 align-top">
                <span className="flex items-start gap-2 text-ink">
                  <Check className="w-4 h-4 text-succes shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[0.8125rem] leading-relaxed">{ours}</span>
                </span>
              </td>
              <td className="py-4 px-5 align-top">
                <span className="flex items-start gap-2 text-pierre-deep">
                  <X className="w-4 h-4 text-alerte/70 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[0.8125rem] leading-relaxed">{theirs}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
