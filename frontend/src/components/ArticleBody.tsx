import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Info, ListOrdered } from 'lucide-react';
import type { Block, InlineToken, ParsedArticle } from '../lib/articleContent';

/**
 * Renders parsed article blocks as React nodes.
 *
 * Nothing here uses dangerouslySetInnerHTML: the content comes from the admin
 * and is rendered as typed blocks, so no markup can be smuggled through the
 * editor into a visitor's page.
 */

const Inline: React.FC<{ tokens: InlineToken[] }> = ({ tokens }) => (
  <>
    {tokens.map((token, i) => {
      if (token.type === 'strong') {
        return <strong key={i} className="font-semibold text-ink">{token.text}</strong>;
      }

      if (token.type === 'link' && token.href) {
        // Internal links stay in the router so navigation is instant and the
        // link equity stays on the site.
        if (!token.external) {
          return (
            <Link
              key={i}
              to={token.href}
              className="text-terracotta-deep font-medium underline underline-offset-2 decoration-ambre hover:decoration-terracotta"
            >
              {token.text}
            </Link>
          );
        }
        return (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta-deep font-medium underline underline-offset-2 decoration-ambre hover:decoration-terracotta inline-flex items-baseline gap-1"
          >
            {token.text}
            <ExternalLink className="w-3 h-3 shrink-0 self-center" aria-hidden="true" />
          </a>
        );
      }

      return <React.Fragment key={i}>{token.text}</React.Fragment>;
    })}
  </>
);

/** In page navigation, generated from the headings the author wrote. */
export const TableOfContents: React.FC<{ toc: ParsedArticle['toc'] }> = ({ toc }) => {
  if (toc.length < 3) return null; // not worth the space on a short guide

  return (
    <nav
      aria-labelledby="toc-title"
      className="bg-white border border-pierre-line rounded-2xl p-5 sm:p-6"
    >
      <p id="toc-title" className="flex items-center gap-2 text-sm font-bold text-ink">
        <ListOrdered className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
        Dans ce guide
      </p>
      <ol className="mt-4 space-y-1">
        {toc.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${item.id}`}
              className="flex items-center min-h-9 text-sm text-ink-soft hover:text-terracotta-deep transition-colors"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export const ArticleBody: React.FC<{ blocks: Block[] }> = ({ blocks }) => (
  <div className="article-body">
    {blocks.map((block, index) => {
      switch (block.type) {
        case 'heading': {
          const Tag = block.level === 2 ? 'h2' : 'h3';
          return (
            // scroll-mt clears the sticky header when an anchor is followed
            <Tag key={index} id={block.id} className="scroll-mt-32 group">
              {block.text}
              <a
                href={`#${block.id}`}
                className="ml-2 text-ambre opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[0.8em]"
                aria-label={`Lien vers la section ${block.text}`}
              >
                #
              </a>
            </Tag>
          );
        }

        case 'paragraph':
          return <p key={index}><Inline tokens={block.tokens} /></p>;

        case 'list':
          return block.ordered ? (
            <ol key={index} className="list-decimal pl-5 space-y-2 marker:text-terracotta marker:font-semibold">
              {block.items.map((item, i) => (
                <li key={i} className="pl-1"><Inline tokens={item} /></li>
              ))}
            </ol>
          ) : (
            <ul key={index} className="list-disc pl-5 space-y-2 marker:text-terracotta">
              {block.items.map((item, i) => (
                <li key={i} className="pl-1"><Inline tokens={item} /></li>
              ))}
            </ul>
          );

        case 'table':
          return (
            // A real table, crawlable, scrolling inside its own container so a
            // wide comparison never makes the page scroll sideways on a phone.
            <div key={index} className="overflow-x-auto border border-pierre-line rounded-2xl bg-white">
              <table className="w-full text-left text-sm min-w-[32rem]">
                <thead className="bg-sable-soft">
                  <tr>
                    {block.head.map((cell, i) => (
                      <th key={i} scope="col" className="px-4 py-3 font-serif font-semibold text-ink">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pierre-line">
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="px-4 py-3 text-ink-soft align-top">
                          <Inline tokens={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        case 'note':
          return (
            <aside key={index} className="bg-ambre-soft border-l-4 border-ambre rounded-r-xl px-5 py-4 flex gap-3">
              <Info className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-ink-soft leading-relaxed">
                <Inline tokens={block.tokens} />
              </p>
            </aside>
          );

        default:
          return null;
      }
    })}
  </div>
);
