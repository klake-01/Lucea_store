import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, BadgeCheck, MessageCircle } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PageHero } from '../components/Hero';
import { Section, SectionBody } from '../components/Layout';
import { Reveal } from '../components/Reveal';
import { Stars } from '../components/Stars';
import { fetchApi } from '../lib/api';
import { BRAND } from '../lib/brand';
import { buildBreadcrumbSchema } from '../lib/jsonLdBuilder';

export const ReviewsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const q = filter ? `?min_rating=${filter}&limit=50` : '?limit=50';
    fetchApi(`/reviews${q}`, { auth: false, signal: controller.signal })
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filter]);

  const summary = data?.summary ?? { average: 0, count: 0, distribution: {} };
  const reviews = data?.items ?? [];

  return (
    <>
      <Seo
        title="Avis clients | LUCÉA Maroc"
        description="Les avis de nos clients au Maroc sur nos lampes et veilleuses imprimées en 3D. Notes, commentaires et achats vérifiés."
        path="/avis"
        keywords={['avis lucea maroc', 'avis veilleuse personnalisee', 'temoignages clients lampe maroc']}
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Avis clients', url: '/avis' },
          ]),
        ]}
      />

      <PageHero
        breadcrumb={
          <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
            <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span className="text-ink font-medium">Avis clients</span>
          </nav>
        }
        eyebrow="Ils ont commandé chez nous"
        title="Les avis de nos clients"
        lede="Chaque avis vient d une personne qui a reçu sa lampe. Nous publions les critiques comme les compliments."
      >
        <Link
          to="/avis/nouveau"
          className="inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-deep text-white font-semibold px-7 h-13 rounded-xl transition-colors"
        >
          <PenLine className="w-4 h-4" aria-hidden="true" />
          Laisser mon avis
        </Link>
      </PageHero>

      {/* Summary */}
      <Section tone="ecru" rhythm="tight">
        <div className="bg-white border border-pierre-line rounded-2xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="text-center sm:border-r sm:border-pierre-line sm:pr-8">
            <p className="text-4xl font-serif font-bold text-ink tabular-nums">
              {summary.count ? summary.average.toFixed(1).replace('.', ',') : '—'}
            </p>
            <Stars rating={summary.average} size="md" className="justify-center mt-2" />
            <p className="mt-2 text-xs text-pierre-deep">
              {summary.count} avis publié{summary.count > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution?.[String(star)] ?? 0;
              const pct = summary.count ? (count / summary.count) * 100 : 0;
              return (
                <button
                  key={star}
                  onClick={() => setFilter(filter === star ? null : star)}
                  aria-pressed={filter === star}
                  className={`w-full flex items-center gap-3 text-xs group ${
                    filter === star ? 'font-semibold text-ink' : 'text-pierre-deep'
                  }`}
                >
                  <span className="w-12 text-left shrink-0">{star} étoile{star > 1 ? 's' : ''}</span>
                  <span className="flex-1 h-2 bg-ecru rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-ambre rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums shrink-0">{count}</span>
                </button>
              );
            })}
            {filter && (
              <button
                onClick={() => setFilter(null)}
                className="text-[11px] text-terracotta-deep font-semibold min-h-9"
              >
                Voir tous les avis
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* List */}
      <Section tone="ecru" rhythm="default">
        <SectionBody className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white border border-pierre-line rounded-2xl p-6 space-y-3">
                  <div className="h-4 w-24 bg-sable-soft rounded animate-pulse" />
                  <div className="h-16 bg-sable-soft rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white border border-pierre-line rounded-2xl p-12 text-center">
              <p className="text-sm text-ink-soft">
                {filter
                  ? `Aucun avis à ${filter} étoile${filter > 1 ? 's' : ''} pour le moment.`
                  : 'Aucun avis publié pour le moment. Soyez le premier.'}
              </p>
              <Link
                to="/avis/nouveau"
                className="mt-6 inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep text-ink font-bold px-6 h-11 rounded-xl text-xs transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                Laisser mon avis
              </Link>
            </div>
          ) : (
            <Reveal stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r: any) => (
                <figure
                  key={r.id}
                  className="bg-white border border-pierre-line rounded-2xl p-6 flex flex-col"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={r.rating} />
                    {r.verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-succes bg-succes-soft px-2 py-1 rounded">
                        <BadgeCheck className="w-3 h-3" aria-hidden="true" />
                        Achat vérifié
                      </span>
                    )}
                  </div>

                  {r.title && (
                    <p className="mt-3 font-serif font-bold text-ink text-base leading-snug">
                      {r.title}
                    </p>
                  )}

                  <blockquote className="mt-2.5 text-sm text-ink-soft leading-relaxed flex-1">
                    {r.body}
                  </blockquote>

                  <figcaption className="mt-5 pt-4 border-t border-pierre-line flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-terracotta-deep">
                      {r.author_name}
                      {r.author_city && <span className="text-pierre-deep font-normal">, {r.author_city}</span>}
                    </span>
                    <time dateTime={r.created_at} className="text-pierre-deep shrink-0">
                      {new Date(r.created_at).toLocaleDateString('fr-MA', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </time>
                  </figcaption>

                  {r.product_name && (
                    <p className="mt-2 text-[11px] text-pierre-deep">À propos de {r.product_name}</p>
                  )}
                </figure>
              ))}
            </Reveal>
          )}
        </SectionBody>
      </Section>

      {/* CTA */}
      <Section tone="sable" rhythm="loose" bordered>
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-[2rem] font-serif font-bold text-ink">
            Vous avez commandé chez nous ?
          </h2>
          <p className="mt-5 text-sm sm:text-base text-ink-soft leading-relaxed">
            Votre retour aide les prochains acheteurs, et nous aide à corriger ce
            qui doit l être.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/avis/nouveau"
              className="inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-13 rounded-xl transition-colors"
            >
              <PenLine className="w-4 h-4" aria-hidden="true" />
              Laisser mon avis
            </Link>
            <a
              href={BRAND.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-ecru text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Nous écrire
            </a>
          </div>
        </div>
      </Section>
    </>
  );
};
