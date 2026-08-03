import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag, Search, Menu, X, ShieldCheck, Truck, ChevronRight, Package, RotateCcw
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { CLUSTERS } from '../lib/seoStrategy';
import { Container } from './Layout';

const PRIMARY_NAV = [
  { label: 'Toutes nos lampes', to: '/lampes' },
  ...CLUSTERS.slice(0, 3).map((c) => ({ label: c.shortLabel, to: c.moneyPageUrl })),
  { label: 'Guides', to: '/guides' },
];

const SECONDARY_NAV = [
  { label: 'Avis clients', to: '/avis' },
  { label: 'Suivre ma commande', to: '/suivi-commande' },
  { label: 'Livraison et paiement', to: '/livraison-paiement' },
  { label: 'Questions fréquentes', to: '/faq' },
  { label: 'À propos de l atelier', to: '/a-propos' },
  { label: 'Nous contacter', to: '/contact' },
];

export const Navbar: React.FC = () => {
  const { itemCount, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Any navigation closes whatever is open
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSearchOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  // The drawer locks the page behind it and traps focus while open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
      );
      if (!focusable.length) return;
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
    };
  }, [mobileMenuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(q ? `/lampes?q=${encodeURIComponent(q)}` : '/lampes');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/*
        Reassurance strip. On a narrow phone only the delivery promise fits, so
        the second line is dropped rather than wrapped into a two line block
        that pushes the header down the screen.
      */}
      <div className="bg-ink text-ecru">
        <Container>
          <div className="flex items-center justify-center gap-x-8 py-2 text-center">
            <span className="inline-flex items-center gap-2 text-[clamp(0.6875rem,2.6vw,0.75rem)] font-medium">
              <Truck className="w-3.5 h-3.5 text-ambre shrink-0" aria-hidden="true" />
              <span className="truncate">Livraison 48h à Casablanca et Rabat</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-ambre shrink-0" aria-hidden="true" />
              Paiement à la livraison
            </span>
            <span className="hidden lg:inline-flex items-center gap-2 text-xs font-medium">
              <RotateCcw className="w-3.5 h-3.5 text-ambre shrink-0" aria-hidden="true" />
              Satisfait ou remboursé 14 jours
            </span>
          </div>
        </Container>
      </div>

      {/*
        Opaque, not blurred: a backdrop-filter on a sticky bar forces a full
        width repaint on every scroll frame.
      */}
      <header className="sticky top-0 z-200 bg-ecru border-b border-pierre-line">
        <Container>
          {/*
            Two column grid on phones (brand | actions) and three on desktop so
            the nav can be centred against the page. The row height is fluid
            rather than fixed, which keeps the bar compact on short landscape
            viewports and comfortable on tall ones.
          */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 h-[var(--nav-h)]">

            <Link
              to="/"
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 py-3 -my-3"
              aria-label="LUCÉA Maroc, retour à l accueil"
            >
              <img
                src="/brand/lucea-mark.png"
                alt=""
                width={40}
                height={39}
                /* Part of the header, so never deferred */
                loading="eager"
                decoding="sync"
                className="h-[clamp(1.75rem,7vw,2.25rem)] w-auto shrink-0"
              />
              <span className="font-serif font-bold tracking-[0.06em] text-ink leading-none text-[clamp(1.125rem,5.2vw,1.375rem)]">
                LUCÉA
              </span>
              {/* Hidden below 380px, where the wordmark alone must win the space */}
              <span className="hidden min-[380px]:inline text-[9px] tracking-[0.18em] uppercase bg-ambre-soft text-terracotta-deep px-1.5 py-1 rounded font-semibold leading-none shrink-0">
                Maroc
              </span>
            </Link>

            <nav
              className="hidden lg:flex items-center justify-center gap-6 xl:gap-8"
              aria-label="Navigation principale"
            >
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive(item.to) ? 'page' : undefined}
                  className={`relative text-[0.8125rem] py-3 transition-colors hover:text-terracotta-deep whitespace-nowrap ${
                    isActive(item.to)
                      ? 'text-terracotta-deep font-semibold'
                      : 'text-ink-soft font-medium'
                  }`}
                >
                  {item.label}
                  {isActive(item.to) && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-ambre rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Actions. Square 44px targets, tightened to 40px under 380px so
                three of them plus the wordmark always fit. */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="w-10 h-10 min-[380px]:w-11 min-[380px]:h-11 grid place-items-center rounded-xl text-ink hover:bg-sable-soft active:bg-sable transition-colors"
                aria-label="Rechercher une lampe"
                aria-expanded={searchOpen}
                aria-controls="search-panel"
              >
                <Search className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
              </button>

              <button
                onClick={openCart}
                className="relative w-10 h-10 min-[380px]:w-11 min-[380px]:h-11 grid place-items-center rounded-xl text-ink hover:bg-sable-soft active:bg-sable transition-colors"
                aria-label={`Ouvrir le panier, ${itemCount} article${itemCount > 1 ? 's' : ''}`}
              >
                <ShoppingBag className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 bg-terracotta text-white font-bold text-[10px] min-w-[1.125rem] h-[1.125rem] px-1 rounded-full grid place-items-center leading-none tabular-nums">
                    {itemCount}
                  </span>
                )}
              </button>

              <button
                ref={menuButtonRef}
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden w-10 h-10 min-[380px]:w-11 min-[380px]:h-11 grid place-items-center rounded-xl text-ink hover:bg-sable-soft active:bg-sable transition-colors"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav"
                aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </Container>

        {/* Search panel: its own full width row, so the field is never squeezed */}
        {searchOpen && (
          <div id="search-panel" className="border-t border-pierre-line bg-white">
            <Container>
              <form onSubmit={submitSearch} role="search" className="py-4 sm:py-5">
                <label htmlFor="site-search" className="sr-only">Rechercher une lampe</label>
                <div className="relative max-w-2xl mx-auto">
                  <Search
                    className="w-[1.125rem] h-[1.125rem] absolute left-4 top-1/2 -translate-y-1/2 text-pierre-deep pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    id="site-search"
                    type="search"
                    enterKeyHint="search"
                    placeholder="Veilleuse prenom, lampe de chevet"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    /* 16px minimum: anything smaller makes iOS zoom the page on focus */
                    className="w-full h-13 bg-ecru border border-pierre-line rounded-full pl-12 pr-4 sm:pr-28 text-base sm:text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12"
                  />
                  <button
                    type="submit"
                    className="hidden sm:block absolute right-1.5 top-1.5 bottom-1.5 px-5 bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-xs font-bold rounded-full transition-colors"
                  >
                    Rechercher
                  </button>
                </div>
                <button
                  type="submit"
                  className="sm:hidden mt-3 w-full h-12 bg-ambre active:bg-ambre-deep text-ink text-sm font-bold rounded-xl transition-colors"
                >
                  Rechercher
                </button>
              </form>
            </Container>
          </div>
        )}
      </header>

      {/* ---------------- Mobile drawer ---------------- */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-300">
          <button
            className="absolute inset-0 bg-ink/50 w-full"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fermer le menu"
            tabIndex={-1}
          />

          {/*
            A side drawer rather than an expanding header block. The header
            version pushed the page down and left an awkward gap at short
            viewport heights. This one is its own scroll container, capped at
            the dynamic viewport height so a landscape phone can still reach
            every item.
          */}
          <div
            ref={panelRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="absolute inset-y-0 right-0 w-[min(20rem,88vw)] bg-ecru border-l border-pierre-line flex flex-col max-h-[100dvh] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 px-5 h-[var(--nav-h)] bg-white border-b border-pierre-line shrink-0">
              <span className="font-serif font-bold text-ink tracking-[0.06em]">LUCÉA</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-11 h-11 -mr-2 grid place-items-center rounded-xl text-pierre-deep hover:text-ink hover:bg-ecru transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-4 py-5" aria-label="Navigation mobile">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
                Nos collections
              </p>
              <ul className="mt-2">
                {PRIMARY_NAV.map((item) => (
                  <li key={item.to} className="border-b border-pierre-line/70 last:border-0">
                    <Link
                      to={item.to}
                      aria-current={isActive(item.to) ? 'page' : undefined}
                      className={`flex items-center justify-between gap-3 min-h-[3.25rem] px-2 rounded-lg transition-colors active:bg-sable-soft ${
                        isActive(item.to)
                          ? 'text-terracotta-deep font-semibold'
                          : 'text-ink font-medium'
                      }`}
                    >
                      <span className="text-[0.9375rem]">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-pierre-deep shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
                {CLUSTERS.slice(3).map((c) => (
                  <li key={c.id} className="border-b border-pierre-line/70 last:border-0">
                    <Link
                      to={c.moneyPageUrl}
                      className="flex items-center justify-between gap-3 min-h-[3.25rem] px-2 rounded-lg text-ink font-medium transition-colors active:bg-sable-soft"
                    >
                      <span className="text-[0.9375rem]">{c.shortLabel}</span>
                      <ChevronRight className="w-4 h-4 text-pierre-deep shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta-deep">
                Informations
              </p>
              <ul className="mt-2">
                {SECONDARY_NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center min-h-[2.75rem] px-2 rounded-lg text-sm text-ink-soft transition-colors active:bg-sable-soft"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Purchase actions stay pinned, reachable with the thumb */}
            <div className="shrink-0 border-t border-pierre-line bg-white px-4 py-4 space-y-2.5">
              <Link
                to="/lampes"
                className="flex items-center justify-center gap-2 w-full h-12 bg-ambre active:bg-ambre-deep text-ink font-bold rounded-xl text-sm transition-colors"
              >
                <Package className="w-4 h-4" aria-hidden="true" />
                Voir tout le catalogue
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); openCart(); }}
                className="flex items-center justify-center gap-2 w-full h-12 bg-ecru active:bg-sable text-ink font-semibold rounded-xl text-sm border border-pierre-line transition-colors"
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                Mon panier
                {itemCount > 0 && (
                  <span className="bg-terracotta text-white text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full grid place-items-center tabular-nums">
                    {itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
