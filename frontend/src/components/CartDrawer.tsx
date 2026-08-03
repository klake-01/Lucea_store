import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Trash2, Tag, ArrowRight, ShieldCheck, Minus, Plus, AlertCircle, Truck, ShoppingBag
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatMad, amountToFreeShipping, FREE_SHIPPING_THRESHOLD_CENTS } from '../lib/format';

export const CartDrawer: React.FC = () => {
  const {
    cart, isOpen, closeCart, removeFromCart, updateQuantity,
    applyVoucher, clearVoucher, voucherCode, busy, error, dismissError,
  } = useCart();

  const [voucherInput, setVoucherInput] = useState('');
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    // Escape closes, Tab stays inside the panel while it is open
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal_cents ?? 0;
  const missing = amountToFreeShipping(subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD_CENTS) * 100);

  const handleCheckout = () => {
    closeCart();
    navigate('/checkout');
  };

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherInput.trim()) {
      applyVoucher(voucherInput.trim());
      setVoucherInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-300">
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={closeCart}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 w-full sm:max-w-[26rem] bg-ecru shadow-2xl flex flex-col border-l border-pierre-line"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 bg-white border-b border-pierre-line shrink-0">
          <h2 id="cart-title" className="font-serif text-lg font-bold text-ink">
            Votre panier
            {items.length > 0 && (
              <span className="text-pierre-deep font-sans font-normal text-sm ml-2">
                {items.length} article{items.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={closeCart}
            className="w-10 h-10 grid place-items-center -mr-2 rounded-xl text-pierre-deep hover:text-ink hover:bg-ecru transition-colors"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free delivery progress */}
        {items.length > 0 && (
          <div className="px-6 py-4 bg-sable-soft border-b border-pierre-line shrink-0">
            {missing > 0 ? (
              <>
                <p className="text-xs text-ink-soft flex items-center gap-2">
                  <Truck className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
                  <span>
                    Plus que <strong className="text-ink">{formatMad(missing)}</strong> pour la livraison offerte
                  </span>
                </p>
                <div
                  className="mt-3 h-1.5 bg-white rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progression vers la livraison offerte"
                >
                  <div
                    className="h-full bg-ambre rounded-full transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-succes font-semibold flex items-center gap-2">
                <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />
                Livraison offerte sur cette commande
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-6 mt-4 bg-alerte-soft border border-alerte/25 text-alerte text-xs p-3.5 rounded-xl flex items-start gap-2.5 shrink-0"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
            <span className="flex-1 leading-relaxed">{error}</span>
            <button onClick={dismissError} aria-label="Masquer le message" className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-12">
              <div className="w-14 h-14 rounded-full bg-sable-soft grid place-items-center">
                <ShoppingBag className="w-6 h-6 text-pierre-deep" aria-hidden="true" />
              </div>
              <div>
                <p className="font-serif font-bold text-ink">Votre panier est vide</p>
                <p className="text-xs text-pierre-deep mt-2 max-w-56">
                  Toutes nos lampes sont gravees au prenom de votre choix, sans supplement.
                </p>
              </div>
              <button
                onClick={() => { closeCart(); navigate('/lampes'); }}
                className="bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-6 py-3 rounded-xl text-xs transition-colors"
              >
                Decouvrir nos lampes
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-pierre-line hover:border-pierre-deep transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-16 h-16 bg-sable-soft rounded-lg overflow-hidden shrink-0 border border-pierre-line">
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name || 'Thumbnail'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-pierre-deep">
                            <ShoppingBag className="w-6 h-6 opacity-20" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-1">
                          {item.product_name || 'Lampe LUCEA'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-pierre-deep font-mono bg-ecru px-1.5 py-0.5 rounded">
                            {item.variant_sku || 'Standard'}
                          </span>
                          <span className="text-xs text-ink-soft">
                            {formatMad(item.unit_price_cents)}/u
                          </span>
                        </div>
                        {item.config_text && (
                          <p className="inline-block bg-ambre-soft text-terracotta-deep text-[11px] font-medium px-2 py-1 rounded mt-2">
                            Gravé : {item.config_text}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      disabled={busy}
                      className="w-8 h-8 grid place-items-center rounded-full text-pierre-deep hover:text-alerte hover:bg-alerte-soft transition-colors disabled:opacity-40 shrink-0"
                      aria-label={`Supprimer ${item.product_name} du panier`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-4">
                    <div className="flex items-center border border-pierre-line rounded-lg overflow-hidden bg-white shadow-sm">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={busy}
                        className="w-8 h-8 grid place-items-center text-ink hover:bg-ecru disabled:opacity-40 transition-colors"
                        aria-label={`Retirer une unité de ${item.product_name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className="w-8 text-center text-xs font-semibold text-ink tabular-nums"
                        aria-live="polite"
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={busy}
                        className="w-8 h-8 grid place-items-center text-ink hover:bg-ecru disabled:opacity-40 transition-colors"
                        aria-label={`Ajouter une unité de ${item.product_name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-ink text-sm tabular-nums">
                        {formatMad(item.item_total_cents)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="bg-white border-t border-pierre-line px-6 py-5 space-y-4 shrink-0">
            <form onSubmit={handleVoucherSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <label htmlFor="voucher" className="sr-only">Code promo</label>
                <Tag
                  className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-pierre-deep pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="voucher"
                  type="text"
                  placeholder="Code promo"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  className="w-full h-11 bg-ecru border border-pierre-line rounded-xl pl-10 pr-3 text-xs text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !voucherInput.trim()}
                className="h-11 px-4 bg-sable hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors shrink-0"
              >
                Appliquer
              </button>
            </form>

            {voucherCode && (
              <div className="flex items-center justify-between gap-3 text-xs bg-succes-soft text-succes px-3.5 py-2.5 rounded-xl">
                <span className="font-semibold">Code {voucherCode} applique</span>
                <button onClick={clearVoucher} className="underline shrink-0" type="button">
                  Retirer
                </button>
              </div>
            )}

            <dl className="space-y-2.5 text-xs text-ink-soft">
              <div className="flex justify-between gap-3">
                <dt>Sous total</dt>
                <dd className="tabular-nums">{formatMad(cart?.subtotal_cents)}</dd>
              </div>
              {(cart?.discount_cents ?? 0) > 0 && (
                <div className="flex justify-between gap-3 text-succes font-semibold">
                  <dt>Remise</dt>
                  <dd className="tabular-nums">moins {formatMad(cart?.discount_cents)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt>Livraison</dt>
                <dd className="tabular-nums">
                  {(cart?.delivery_charge_cents ?? 0) === 0 ? 'Offerte' : formatMad(cart?.delivery_charge_cents)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 pt-3 border-t border-pierre-line text-base font-serif font-bold text-ink">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMad(cart?.total_cents)}</dd>
              </div>
            </dl>

            <button
              onClick={handleCheckout}
              disabled={busy}
              className="w-full bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold h-13 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              Passer la commande
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <p className="flex items-center justify-center gap-2 text-[11px] text-pierre-deep">
              <ShieldCheck className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
              Vous reglez en especes a la reception du colis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
