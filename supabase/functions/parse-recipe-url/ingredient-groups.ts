// Ingredient group headings ("Lemon curd:", "Lemon cookies:") for URL import.
//
// schema.org JSON-LD — the free fast path — only carries a flat list of
// ingredient lines; the grouping lives in the page's HTML, drawn by the site's
// recipe plugin. This reads the groups back out of the two common plugins' markup
// and re-inserts each heading into the flat list as a "Name:" line, which the
// client's paste parser already turns into a section.
//
// Pure and dependency-free so Vitest can cover it without Deno.

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

interface Group {
  name: string | null;
  count: number;
}

/** "Lemon curd:" / "LEMON CURD" → "Lemon curd"-ish, ready to append a colon to. */
function cleanName(raw: string): string | null {
  const name = stripTags(raw).replace(/:\s*$/, '').trim();
  return name === '' ? null : name;
}

/**
 * WP Recipe Maker: each group is a `wprm-recipe-ingredient-group` block with an
 * optional `wprm-recipe-group-name` heading and `wprm-recipe-ingredient` items.
 */
function wprmGroups(html: string): Group[] {
  // Exact class token — `wprm-recipe-ingredient-group-name` must not match.
  const starts: number[] = [];
  const groupRe = /class="(?:[^"]*\s)?wprm-recipe-ingredient-group(?=[\s"])[^"]*"/g;
  let m: RegExpExecArray | null;
  while ((m = groupRe.exec(html))) starts.push(m.index);
  if (starts.length === 0) return [];

  return starts.map((start, i) => {
    const chunk = html.slice(start, starts[i + 1] ?? html.length);
    const heading =
      /class="[^"]*\bwprm-recipe-group-name\b[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|div|span|p|strong)>/.exec(
        chunk,
      );
    const items =
      chunk.match(/<li[^>]*class="(?:[^"]*\s)?wprm-recipe-ingredient(?=[\s"])/g) ?? [];
    return { name: heading?.[1] ? cleanName(heading[1]) : null, count: items.length };
  });
}

/**
 * Tasty Recipes: the ingredients body holds `<h3>/<h4>` headings followed by
 * `<ul><li>` items, in document order.
 */
function tastyGroups(html: string): Group[] {
  const start = html.search(/class="[^"]*\btasty-recipes-ingredients\b/);
  if (start === -1) return [];
  const endRel = html.slice(start).search(/class="[^"]*\btasty-recipes-instructions\b/);
  const body = html.slice(start, endRel === -1 ? undefined : start + endRel);

  const groups: Group[] = [{ name: null, count: 0 }];
  const tokenRe = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>|<li\b/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body))) {
    if (m[1] !== undefined) groups.push({ name: cleanName(m[1]), count: 0 });
    else groups[groups.length - 1]!.count++;
  }
  // The body's own title ("Ingredients") shows up as a heading with nothing
  // before it; drop empty groups so it doesn't become a section.
  return groups.filter((g) => g.count > 0);
}

/**
 * Re-insert group headings into JSON-LD's flat ingredient lines. Only applies
 * when the plugin's item count matches the line count exactly — the one check
 * that the HTML and the JSON-LD describe the same list in the same order. On any
 * mismatch (several recipes on a page, a plugin we misread) the lines come back
 * untouched: no sections is better than wrong ones.
 */
export function withGroupHeadings(html: string, lines: string[]): string[] {
  for (const groups of [wprmGroups(html), tastyGroups(html)]) {
    if (!groups.some((g) => g.name)) continue;
    const total = groups.reduce((n, g) => n + g.count, 0);
    if (total !== lines.length) continue;

    const out: string[] = [];
    let i = 0;
    for (const g of groups) {
      if (g.name) out.push(`${g.name}:`);
      out.push(...lines.slice(i, i + g.count));
      i += g.count;
    }
    return out;
  }
  return lines;
}
