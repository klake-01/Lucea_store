// Article content parser.
//
// Articles are stored as plain text with a small, deliberate markup subset.
// Parsing into typed blocks rather than injecting HTML keeps the content path
// free of markup a compromised admin account could smuggle in, which matters
// because the storefront CSP forbids inline scripts and we do not want to be
// the reason that protection is weakened.
//
// Supported syntax
//   ## Heading            a section heading, receives an id for anchoring
//   ### Sub heading
//   | a | b |             a table, second row of dashes marks the header
//   - item                a bullet list
//   1. item               a numbered list
//   > note                a callout
//   [label](/url)         an inline link, internal or external
//   **bold**              emphasis

export interface InlineToken {
  type: 'text' | 'link' | 'strong';
  text: string;
  href?: string;
  external?: boolean;
}

export type Block =
  | { type: 'heading'; level: 2 | 3; text: string; id: string }
  | { type: 'paragraph'; tokens: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'table'; head: string[]; rows: InlineToken[][][] }
  | { type: 'note'; tokens: InlineToken[] };

export interface ParsedArticle {
  /** First paragraph, lifted out for the answer first summary box. */
  lead: string;
  blocks: Block[];
  /** Headings, for the table of contents and in page anchors. */
  toc: { id: string; text: string; level: 2 | 3 }[];
}

export function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Splits a line into text, links and bold runs. */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // One pass over links and bold, so a link label can never swallow the rest
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', text: line.slice(cursor, match.index) });
    }

    if (match[1] !== undefined) {
      const href = match[2].trim();
      tokens.push({
        type: 'link',
        text: match[1],
        href,
        // Anything not starting with / or # leaves the site
        external: !/^[/#]/.test(href),
      });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'strong', text: match[3] });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    tokens.push({ type: 'text', text: line.slice(cursor) });
  }
  return tokens.length ? tokens : [{ type: 'text', text: line }];
}

const isTableRow = (line: string) => line.startsWith('|') && line.endsWith('|');
const isDivider = (line: string) => /^\|[\s:|-]+\|$/.test(line);
const splitRow = (line: string) =>
  line.slice(1, -1).split('|').map((cell) => cell.trim());

export function parseArticle(content: string): ParsedArticle {
  const lines = (content || '').split('\n').map((l) => l.trim());
  const blocks: Block[] = [];
  const toc: ParsedArticle['toc'] = [];
  const usedIds = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line) { i++; continue; }

    // ---- Heading ----
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      const level = (heading[1].length === 2 ? 2 : 3) as 2 | 3;
      const text = heading[2].trim();

      // Ids must be unique or two anchors would fight for the same target
      let id = slugifyHeading(text);
      let suffix = 2;
      while (usedIds.has(id)) id = `${slugifyHeading(text)}-${suffix++}`;
      usedIds.add(id);

      blocks.push({ type: 'heading', level, text, id });
      toc.push({ id, text, level });
      i++;
      continue;
    }

    // ---- Table ----
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: InlineToken[][][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    // ---- Lists ----
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: InlineToken[][] = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\.\s+/.test(lines[i]) : /^[-*]\s+/.test(lines[i]))
      ) {
        items.push(parseInline(lines[i].replace(/^([-*]|\d+\.)\s+/, '')));
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // ---- Callout ----
    if (line.startsWith('>')) {
      blocks.push({ type: 'note', tokens: parseInline(line.replace(/^>\s?/, '')) });
      i++;
      continue;
    }

    // ---- Paragraph ----
    blocks.push({ type: 'paragraph', tokens: parseInline(line) });
    i++;
  }

  // The first paragraph becomes the summary box, so it is removed from the body
  const leadIndex = blocks.findIndex((b) => b.type === 'paragraph');
  let lead = '';
  if (leadIndex >= 0) {
    const block = blocks[leadIndex] as Extract<Block, { type: 'paragraph' }>;
    lead = block.tokens.map((t) => t.text).join('');
    blocks.splice(leadIndex, 1);
  }

  return { lead, blocks, toc };
}

export const readingMinutes = (content: string) =>
  Math.max(1, Math.round((content || '').split(/\s+/).length / 200));
