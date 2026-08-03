import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, ArrowRight, Search, Package, LifeBuoy } from 'lucide-react';
import { Seo } from '../components/Seo';
import { Section, SectionHeader, SectionBody } from '../components/Layout';
import { PageHero } from '../components/Hero';
import { Reveal } from '../components/Reveal';
import { CLUSTERS } from '../lib/seoStrategy';

const SHORTCUTS = [
  {
    icon: Package,
    title: 'Tout le catalogue',
    body: 'Nos veilleuses, lampes de chevet, de salon et de bureau disponibles aujourd hui.',
    to: '/lampes',
  },
  {
    icon: LifeBuoy,
    title: 'Suivre ma commande',
    body: 'Votre numero de commande et votre telephone suffisent pour voir ou elle en est.',
    to: '/suivi-commande',
  },
  {
    icon: Search,
    title: 'Guides et conseils',
    body: 'Comment choisir une veilleuse, eclairer une chambre ou un bureau sans reflet.',
    to: '/guides',
  },
];

export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/lampes?q=${encodeURIComponent(q)}` : '/lampes');
  };

  return (
    <>
      {/* Marked noindex so a mistyped URL never enters the index as a soft 404 */}
      <Seo
        title="Page introuvable | LUCEA Maroc"
        description="Cette page n existe pas ou a change d adresse. Retrouvez nos veilleuses prenom et nos lampes design imprimees en 3D au Maroc."
        path={location.pathname}
        noindex
      />

      <PageHero
        eyebrow="Erreur 404"
        title="Cette page n existe pas"
        lede="Le lien est peut etre errone, ou la page a change d adresse. Voici par ou continuer."
      >
        <form onSubmit={submitSearch} role="search" className="max-w-md mx-auto">
          <label htmlFor="notfound-search" className="sr-only">
            Rechercher une lampe
          </label>
          <div className="relative">
            <Search
              className="w-[1.125rem] h-[1.125rem] absolute left-4 top-1/2 -translate-y-1/2 text-pierre-deep pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="notfound-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Veilleuse prenom, lampe de chevet"
              className="w-full h-13 bg-white border border-pierre-line rounded-full pl-12 pr-28 text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-5 bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-xs font-bold rounded-full transition-colors"
            >
              Rechercher
            </button>
          </div>
        </form>
      </PageHero>

      {/* Shortcuts */}
      <Section tone="ecru" rhythm="default" aria-labelledby="shortcuts-title">
        <SectionHeader
          id="shortcuts-title"
          eyebrow="Raccourcis"
          title="Ou souhaitez vous aller ?"
        />

        <SectionBody>
          <Reveal stagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SHORTCUTS.map(({ icon: Icon, title, body, to }) => (
              <Link
                key={to}
                to={to}
                className="group bg-white border border-pierre-line rounded-2xl p-7 hover:border-ambre hover:shadow-[0_8px_24px_rgba(28,27,25,0.06)] transition-all flex flex-col"
              >
                <div className="w-11 h-11 rounded-xl bg-ambre-soft grid place-items-center">
                  <Icon className="w-5 h-5 text-terracotta" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-serif font-bold text-ink group-hover:text-terracotta-deep transition-colors">
                  {title}
                </h3>
                <p className="mt-3 text-sm text-pierre-deep leading-relaxed flex-1">{body}</p>
                <span className="mt-6 pt-5 border-t border-pierre-line flex items-center justify-between text-xs text-terracotta-deep font-semibold">
                  Continuer
                  <ArrowRight
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* Collections */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="collections-404">
        <SectionHeader
          id="collections-404"
          eyebrow="Nos collections"
          title="Choisir par usage"
        />

        <SectionBody>
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CLUSTERS.map((c) => (
              <Link
                key={c.id}
                to={c.moneyPageUrl}
                className="group flex items-start justify-between gap-4 p-5 rounded-2xl border border-pierre-line hover:border-ambre transition-colors"
              >
                <div>
                  <span className="font-serif font-semibold text-ink text-sm block group-hover:text-terracotta-deep transition-colors">
                    {c.name}
                  </span>
                  <span className="mt-2 text-xs text-pierre-deep leading-relaxed block">
                    {c.promise}
                  </span>
                </div>
                <ArrowRight
                  className="w-4 h-4 text-terracotta-deep shrink-0 mt-1 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* Closing */}
      <Section tone="sable" rhythm="loose">
        <div className="text-center max-w-xl mx-auto">
          <Compass className="w-10 h-10 text-terracotta mx-auto" aria-hidden="true" />
          <h2 className="mt-5 text-2xl sm:text-[2rem] font-serif font-bold text-ink">
            Toujours perdu ?
          </h2>
          <p className="mt-5 text-sm sm:text-base text-ink-soft leading-relaxed">
            Ecrivez nous sur WhatsApp en decrivant ce que vous cherchiez, nous vous
            envoyons le lien direct.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-13 rounded-xl transition-colors"
            >
              Retour a l accueil
            </Link>
            <a
              href="https://wa.me/212600000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white hover:bg-ecru text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
            >
              Ecrire sur WhatsApp
            </a>
          </div>
        </div>
      </Section>
    </>
  );
};
