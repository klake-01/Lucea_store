import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Seo } from '../components/Seo';
import { Container } from '../components/Layout';
import {
  ReadingProgress, ArticleHeader, ArticleAuthorBox, ArticleShare, ArticleTOC,
  ArticleFAQ, RelatedArticles, ArticleCTA, StickyMobileCTA, InlineProductGrid,
} from '../components/blog/ArticleParts';
import { prepareArticleBody } from '../lib/articleHtml';
import { fetchApi } from '../lib/api';
import { CLUSTERS } from '../lib/seoStrategy';

/**
 * The article page — `00-foundation/05-BLOG-SYSTEM.md` part C, rendered in the
 * fixed order the spec requires.
 *
 * Everything SEO-bearing comes from `/articles/{slug}/render`: the server
 * computes the meta and the whole JSON-LD graph, and this page injects them
 * verbatim. Part B.3 is explicit that schema has exactly one author, so
 * nothing here builds a node and `buildArticleSchema` is deliberately no
 * longer imported.
 */
export const ArticleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    window.scrollTo(0, 0);

    fetchApi(`/articles/${slug}/render`, { auth: false, signal: controller.signal })
      .then(setPayload)
      .catch(async () => {
        if (controller.signal.aborted) return;

        // Part E.3: a renamed article must not dead-end on its old URL. The
        // build bakes redirects into the edge config; this is the runtime path
        // for one created since the last deploy.
        try {
          const redirects = await fetchApi('/redirects', { auth: false });
          const hit = redirects?.find((r: any) => r.source === `/guides/${slug}`);
          if (hit?.target) {
            navigate(hit.target, { replace: true });
            return;
          }
        } catch {
          /* fall through to the not-found state */
        }
        setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [slug, navigate]);

  const article = payload?.article;

  const body = useMemo(
    () => (article ? prepareArticleBody(article.content, article.content_images || []) : null),
    [article]
  );

  if (loading) {
    return (
      <Container width="reading">
        <div className="py-20 space-y-5">
          <div className="h-10 bg-sable-soft rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-sable-soft rounded animate-pulse" />
          <div className="h-64 bg-sable-soft rounded-2xl animate-pulse" />
        </div>
      </Container>
    );
  }

  if (notFound || !article) {
    return (
      <Container width="narrow">
        <div className="py-24 text-center">
          <h1 className="text-2xl font-serif font-bold text-ink">Guide introuvable</h1>
          <p className="mt-4 text-sm text-ink-soft">
            Ce guide a peut être été renommé ou retiré.
          </p>
          <Link
            to="/guides"
            className="mt-8 inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-12 rounded-xl text-sm transition-colors"
          >
            Voir tous les guides
          </Link>
        </div>
      </Container>
    );
  }

  const meta = payload.meta || {};
  const cluster = CLUSTERS.find((c) => c.id === article.cluster_id);
  const moneyPage = cluster?.moneyPageUrl || '/lampes';

  return (
    <>
      <Seo
        title={meta.title}
        description={meta.description}
        path={`/guides/${article.slug}`}
        keywords={(meta.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean)}
        imageUrl={meta.og_image}
        type="article"
        noindex={String(meta.robots || '').startsWith('noindex')}
        /* Injected exactly as the server built it. */
        jsonLd={payload.json_ld}
      />

      <ReadingProgress />

      <article>
        <ArticleHeader
          title={article.title}
          excerpt={article.excerpt}
          coverUrl={article.banner_url}
          coverAlt={article.banner_alt}
          category={article.category || cluster?.shortLabel}
        />

        <Container>
          <div className="py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14 lg:items-start">
            <div className="min-w-0 lg:max-w-[68ch]">
              <ArticleAuthorBox
                author={article.author}
                publishedDate={article.published_date || article.created_at}
                readMinutes={meta.read_minutes || 1}
              />

              <div className="mt-6 lg:hidden">
                <ArticleShare title={article.title} />
              </div>

              {body && (
                <div className="article-prose mt-10">
                  {body.intro && <div dangerouslySetInnerHTML={{ __html: body.intro }} />}

                  {/* C.6: commerce right after the hook, before the long read. */}
                  <InlineProductGrid products={payload.products || []} />

                  <div dangerouslySetInnerHTML={{ __html: body.rest }} />
                </div>
              )}

              <ArticleFAQ faqs={article.faqs || []} />
              <ArticleCTA cta={article.cta} fallbackLink={moneyPage} />
              <RelatedArticles items={payload.related || []} />

              <div className="mt-12 pt-8 border-t border-pierre-line flex flex-wrap items-center justify-between gap-4">
                <Link
                  to="/guides"
                  className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-terracotta-deep hover:gap-3 transition-[gap]"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Tous les guides
                </Link>
                <ArticleShare title={article.title} />
              </div>
            </div>

            <aside className="hidden lg:block">
              {body && <ArticleTOC entries={body.toc} />}
              <div className="mt-6">
                <ArticleShare title={article.title} orientation="rail" />
              </div>
            </aside>
          </div>
        </Container>
      </article>

      <StickyMobileCTA to={moneyPage} />
    </>
  );
};
