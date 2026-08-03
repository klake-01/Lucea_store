import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingBag, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatMad } from '../lib/format';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80';

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price_cents?: number;
  image_url?: string;
  image_alt?: string;
  variant_id?: string;
  brand?: string;
  stock?: number;
  priority?: boolean;
  compact?: boolean;
  is_customizable?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  slug,
  price_cents = 29900,
  image_url,
  image_alt,
  variant_id,
  brand = 'LUCÉA',
  stock,
  priority = false,
  compact = false,
  is_customizable = false,
}) => {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const outOfStock = typeof stock === 'number' && stock <= 0;

  // Determine if we should show customizable badge based on name/props
  const showCustomizable = is_customizable || name.toLowerCase().includes('personnalis');

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (variant_id && !outOfStock && !isAdding) {
      setIsAdding(true);
      await addToCart(variant_id, 1);
      setIsAdding(false);
    }
  };

  return (
    <article className="group bg-white border border-pierre-line rounded-2xl overflow-hidden flex flex-col hover:border-ambre hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative" aria-labelledby={`product-${id}-title`}>
      <Link
        to={`/products/${slug}`}
        className="relative block aspect-square overflow-hidden bg-sable-soft"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          src={image_url || FALLBACK_IMAGE}
          alt={image_alt || name}
          loading={priority ? 'eager' : 'lazy'}
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          decoding={priority ? 'sync' : 'async'}
          width={600}
          height={600}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
        />
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/5 transition-colors duration-300 pointer-events-none" />
        
        {brand && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-ink font-semibold text-[9px] uppercase tracking-[0.15em] px-2.5 py-1.5 rounded-full shadow-sm leading-none">
            {brand}
          </span>
        )}
        
        {outOfStock ? (
          <span className="absolute top-3 right-3 bg-ink/90 backdrop-blur text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-full shadow-sm leading-none">
            RUPTURE
          </span>
        ) : showCustomizable ? (
          <span className="absolute top-3 right-3 bg-ambre/90 backdrop-blur text-ink text-[10px] font-semibold px-2.5 py-1.5 rounded-full shadow-sm leading-none flex items-center gap-1">
            ✨ PERSONNALISABLE
          </span>
        ) : null}
      </Link>

      <div className={`p-5 flex-1 flex flex-col bg-white`}>
        <div className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-label="Noté 4.9 sur 5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-3 h-3 fill-ambre text-ambre" aria-hidden="true" />
            ))}
          </span>
          <span className="text-pierre-deep text-[11px] font-medium">4,9 (128)</span>
        </div>

        <h3 id={`product-${id}-title`} className={`mt-2 font-serif font-bold text-ink leading-snug line-clamp-2 ${compact ? 'text-sm' : 'text-lg'}`}>
          <Link
            to={`/products/${slug}`}
            className="hover:text-terracotta transition-colors after:absolute after:inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 rounded-sm"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-auto pt-4 flex items-end justify-between min-w-0">
          <div>
            <p className="text-[10px] text-pierre-deep font-medium mb-0.5">
              À partir de
            </p>
            <p className={`font-serif font-bold text-ink leading-none tabular-nums ${compact ? 'text-base' : 'text-xl'}`}>
              {formatMad(price_cents)}
            </p>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={isAdding || outOfStock || !variant_id}
            className={`relative z-10 w-10 h-10 flex items-center justify-center bg-ambre hover:bg-ambre-deep text-ink font-semibold disabled:opacity-50 disabled:bg-pierre-line disabled:text-pierre-deep disabled:cursor-not-allowed rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 shrink-0`}
            aria-label={outOfStock ? `${name} en rupture de stock` : `Ajouter ${name} au panier`}
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden flex flex-col relative h-full">
    <div className="aspect-square bg-sable-soft animate-pulse" />
    <div className="p-5 flex-1 flex flex-col bg-white space-y-3">
      <div className="h-3 w-28 bg-sable-soft rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-sable-soft rounded animate-pulse" />
      <div className="mt-auto pt-4 flex justify-between items-end gap-3">
        <div className="w-20 space-y-2">
          <div className="h-2 w-12 bg-sable-soft rounded animate-pulse" />
          <div className="h-5 w-full bg-sable-soft rounded animate-pulse" />
        </div>
        <div className="w-10 h-10 bg-sable-soft rounded-xl animate-pulse shrink-0" />
      </div>
    </div>
  </div>
);
