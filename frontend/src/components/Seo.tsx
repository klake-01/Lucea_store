import { useEffect } from 'react';
import { applySeo, SeoInput } from '../lib/seo';

/**
 * Declarative head tags for a route. Render one per page:
 *
 *   <Seo title="..." description="..." path="/lampes" keywords={[...]} />
 *
 * Writes into document.head after paint, so it never blocks the first render.
 */
export const Seo: React.FC<SeoInput> = (props) => {
  const {
    title, description, path, keywords, imageUrl, noindex, type, jsonLd
  } = props;

  // Serialise the structured data so the effect does not refire on every
  // render just because the caller built a fresh object literal.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';
  const keywordsKey = keywords ? keywords.join(',') : '';

  useEffect(() => {
    applySeo({ title, description, path, keywords, imageUrl, noindex, type, jsonLd });
  }, [title, description, path, keywordsKey, imageUrl, noindex, type, jsonLdKey]);

  return null;
};
