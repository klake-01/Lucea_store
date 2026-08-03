import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Loader2, Sparkles, Truck, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatMad } from '../lib/format';
import { Stars } from './Stars';

const FALLBACK = '/images/collections/veilleuses.webp';

export interface CollectionCardProduct {
  id: string;
  name: string;
  slug: string;
  images?: { url: string; alt?: string }[];
  variants?: { id: string; price_cents: number; available?: number; stock?: number }[];
  badge?: string | null;
  personalisable?: boolean;
}

/**
 * Collection grid card.
 *
 * Two behaviours worth knowing:
 *
 * - The whole card is one click target, via an `::after` overlay on the title
 *   link. The quick add button sits above it on the z axis so it stays its own
 *   action, which keeps the markup to a single anchor instead of nesting
 *   interactive elements.
 * - The hover image is the product's second photograph when it has one. It is
 *   only mounted after the first pointer enter, so a grid of twelve cards does
 *   not fetch twenty four images on load.
 */
export const CollectionCard: React.FC<{
  product: CollectionCardProduct;
  priority?: boolean;
}> = ({ product, priority = false }) => {
  const { addToCart, busy } = useCart();
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);

  const variant = product.variants?.[0];
  const available = variant?.available ?? variant?.stock ?? 0;
  const outOfStock = available <= 0;
  const lowStock = available > 0 && available <= 5;

  const images = product.images ?? [];
  const primary = images[0]?.url || FALLBACK;
  const secondary = images[1]?.url;

  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant?.id || outOfStock) return;
    await addToCart(variant.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article
      className="group relative bg-white border border-pierre-line rounded-2xl overflow-hidden flex flex-col transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-ambre hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
      onMouseEnter={() => setHovered(true)}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sable-soft">
        <img
          src={primary}
          alt={images[0]?.alt || product.name}
          width={600}
          height={750}
          loading={priority ? 'eager' : 'lazy'}
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          decoding={priority ? 'sync' : 'async'}
          className={`absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.06] ${
            secondary && hovered ? 'group-hover:opacity-0' : ''
          }`}
        />

        {/* Mounted only once the pointer has arrived, so the grid does not
            download a second image per card on first paint. */}
        {secondary && hovered && (
          <img
            src={secondary}
            alt=""
            width={600}
            height={750}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
          />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {product.badge && (
            <span className="bg-white/95 text-ink text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1.5 rounded-lg leading-none">
              {product.badge}
            </span>
          )}
          {product.personalisable && (
            <span className="inline-flex items-center gap-1 bg-ambre text-ink text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-lg leading-none">
              <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
              Personnalisable
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3">
          {outOfStock ? (
            <span className="bg-ink text-ecru text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-lg leading-none">
              Rupture
            </span>
          ) : lowStock ? (
            <span className="bg-terracotta text-white text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-lg leading-none">
              Plus que {available}
            </span>
          ) : null}
        </div>

        {/* Delivery reassurance, revealed on hover over the image */}
        <span className="absolute bottom-3 left-3 right-3 hidden sm:flex items-center gap-1.5 bg-white/92 text-ink text-[10px] font-medium px-2.5 py-2 rounded-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-300">
          <Truck className="w-3 h-3 text-terracotta shrink-0" aria-hidden="true" />
          Livrée en 48h, payée à la réception
        </span>
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5">
          <Stars rating={4.9} />
          <span className="text-[10px] text-pierre-deep tabular-nums">4,9 (128)</span>
        </div>

        <h3 className="mt-2 font-serif font-semibold text-ink text-sm sm:text-[0.9375rem] leading-snug">
          <Link
            to={`/products/${product.slug}`}
            className="hover:text-terracotta-deep transition-colors after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-pierre-deep leading-none">À partir de</p>
            <p className="mt-1.5 font-serif font-bold text-ink text-base leading-none tabular-nums">
              {formatMad(variant?.price_cents)}
            </p>
          </div>

          <button
            onClick={quickAdd}
            disabled={busy || outOfStock || !variant?.id}
            /* z-10 keeps it above the card wide link overlay */
            className={`relative z-10 w-10 h-10 grid place-items-center rounded-xl shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              added ? 'bg-succes text-white' : 'bg-ambre hover:bg-ambre-deep hover:text-white text-ink'
            }`}
            aria-label={
              outOfStock ? `${product.name}, en rupture de stock` : `Ajouter ${product.name} au panier`
            }
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : added ? (
              <Check className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

/** Matches the card's real proportions so the grid does not reflow on load. */
export const CollectionCardSkeleton: React.FC = () => (
  <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
    <div className="aspect-[4/5] bg-sable-soft animate-pulse" />
    <div className="p-4 sm:p-5 space-y-3">
      <div className="h-3 w-24 bg-sable-soft rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-sable-soft rounded animate-pulse" />
      <div className="h-9 w-full bg-sable-soft rounded animate-pulse mt-4" />
    </div>
  </div>
);
