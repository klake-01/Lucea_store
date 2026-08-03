import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PageHero } from '../components/Hero';
import { Reveal } from '../components/Reveal';
import { Section, SectionBody } from '../components/Layout';
import { fetchApi } from '../lib/api';
import { GUIDES_SEO } from '../lib/pageSeo';
import { CLUSTERS } from '../lib/seoStrategy';
import { buildBreadcrumbSchema, buildCollectionSchema } from '../lib/jsonLdBuilder';

export const GuidesPage: React.FC = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchApi('/articles-cards?limit=24', { auth: false, signal: controller.signal })
      .then((data) => setArticles(data?.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <>
      <Seo
        title={GUIDES_SEO.title}
        description={GUIDES_SEO.description}
        path="/guides"
        keywords={GUIDES_SEO.keywords}
        jsonLd={[
          buildCollectionSchema('Guides LUCEA', GUIDES_SEO.description, '/guides'),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Guides', url: '/guides' },
          ]),
        ]}
      />

      <PageHero
        breadcrumb={
          <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
            <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span className="text-ink font-medium">Guides</span>
          </nav>
        }
        eyebrow="Conseils de l atelier"
        title="Guides eclairage et decoration"
        lede="Ce que nous avons appris en imprimant et en installant des milliers de lampes au Maroc, ecrit sans jargon."
      />

      <Section tone="ecru" rhythm="default">
        <SectionBody className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-pierre-line rounded-2xl p-7 space-y-4">
                  <div className="h-3 w-24 bg-sable-soft rounded animate-pulse" />
                  <div className="h-6 bg-sable-soft rounded animate-pulse" />
                  <div className="h-14 bg-sable-soft rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-white border border-pierre-line rounded-2xl p-12 text-center">
              <p className="text-sm text-ink-soft">Les guides arrivent tres bientot.</p>
              <Link
                to="/lampes"
                className="mt-5 inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-6 h-11 rounded-xl text-xs transition-colors"
              >
                Voir le catalogue
              </Link>
            </div>
          ) : (
            <Reveal stagger className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {articles.map((item) => {
                const cluster = CLUSTERS.find((c) => c.id === item.cluster_id);
                return (
                  <article
                    key={item.id || item.slug}
                    className="group relative bg-white border border-pierre-line rounded-2xl p-7 hover:border-ambre hover:shadow-[0_8px_24px_rgba(28,27,25,0.06)] transition-all flex flex-col"
                  >
                    <p className="flex items-center gap-2 text-terracotta-deep text-[11px] font-semibold uppercase tracking-[0.12em]">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {cluster?.shortLabel ?? 'Guide'}
                    </p>

                    <h2 className="mt-4 text-xl font-serif font-bold text-ink group-hover:text-terracotta-deep transition-colors leading-snug">
                      <Link to={`/guides/${item.slug}`} className="after:absolute after:inset-0">
                        {item.title}
                      </Link>
                    </h2>

                    <p className="mt-3 text-sm text-pierre-deep leading-relaxed flex-1">
                      {item.excerpt || ''}
                    </p>

                    <span className="mt-6 pt-5 border-t border-pierre-line flex items-center justify-between text-xs text-terracotta-deep font-semibold">
                      Lire le guide
                      {item.read_minutes ? (
                        <span className="ml-auto mr-3 font-normal text-pierre-deep">
                          {item.read_minutes} min
                        </span>
                      ) : null}
                      <ArrowRight
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                        aria-hidden="true"
                      />
                    </span>
                  </article>
                );
              })}
            </Reveal>
          )}
        </SectionBody>
      </Section>
    </>
  );
};
