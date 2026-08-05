// Slice 9 (URL import) — parse-recipe-url Edge Function (Deno).
// Fetches a recipe web page server-side (bypassing browser CORS) and extracts a
// recipe. The fast path reads schema.org/Recipe JSON-LD with NO AI call (free);
// pages without usable JSON-LD fall back to Claude on the page text, which
// consumes a monthly AI credit. Returns the same shape either way so the client
// can run its own engine parser + matcher on the ingredient lines.
//
// Env: ANTHROPIC_API_KEY (secret), optional RECIPE_PARSE_MODEL, AI_MONTHLY_LIMIT.
// SUPABASE_URL / SUPABASE_ANON_KEY are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const MODEL = Deno.env.get('RECIPE_PARSE_MODEL') ?? 'claude-haiku-4-5';
const MONTHLY_LIMIT = Number(Deno.env.get('AI_MONTHLY_LIMIT') ?? '50');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Unified return shape. Ingredients are raw lines — the client parses + matches.
const recipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  instructions: z.string().nullable(),
  ingredient_lines: z.array(z.string()),
});
type Recipe = z.infer<typeof recipeSchema>;

// ---- JSON-LD (schema.org/Recipe) fast path -------------------------------

/** Pull every <script type="application/ld+json"> payload out of the HTML. */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // skip malformed blocks
    }
  }
  return out;
}

function typeMatchesRecipe(t: unknown): boolean {
  if (typeof t === 'string') return t.toLowerCase().includes('recipe');
  if (Array.isArray(t)) return t.some(typeMatchesRecipe);
  return false;
}

/** Walk JSON-LD (objects, arrays, @graph) and return the first Recipe node. */
function findRecipeNode(blocks: unknown[]): Record<string, unknown> | null {
  const stack: unknown[] = [...blocks];
  while (stack.length) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...node);
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeMatchesRecipe(obj['@type'])) return obj;
      if (Array.isArray(obj['@graph'])) stack.push(...(obj['@graph'] as unknown[]));
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** ISO-8601 duration (PT1H30M) -> minutes, or null. */
function isoDurationToMinutes(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(v);
  if (!m || (!m[1] && !m[2])) return null;
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) || null;
}

function parseServings(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw === 'number') return Math.round(raw);
  if (typeof raw === 'string') {
    const n = /\d+/.exec(raw);
    if (n) return Number(n[0]);
  }
  return null;
}

function extractInstructions(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return stripTags(v) || null;
  if (Array.isArray(v)) {
    const steps = v
      .map((step) => {
        if (typeof step === 'string') return stripTags(step);
        if (step && typeof step === 'object') {
          const o = step as Record<string, unknown>;
          // HowToSection contains itemListElement of HowToStep.
          if (Array.isArray(o.itemListElement)) return extractInstructions(o.itemListElement);
          if (typeof o.text === 'string') return stripTags(o.text);
          if (typeof o.name === 'string') return stripTags(o.name);
        }
        return '';
      })
      .filter(Boolean);
    return steps.length ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : null;
  }
  return null;
}

function recipeFromJsonLd(node: Record<string, unknown>): Recipe | null {
  const ingredientsRaw = node.recipeIngredient ?? node.ingredients;
  const ingredient_lines = Array.isArray(ingredientsRaw)
    ? ingredientsRaw.filter((x): x is string => typeof x === 'string').map(stripTags).filter(Boolean)
    : [];
  if (ingredient_lines.length === 0) return null; // not enough to be useful

  const name = typeof node.name === 'string' ? stripTags(node.name) : 'Imported recipe';
  return {
    title: name || 'Imported recipe',
    servings: parseServings(node.recipeYield),
    prep_minutes: isoDurationToMinutes(node.prepTime),
    cook_minutes: isoDurationToMinutes(node.cookTime),
    instructions: extractInstructions(node.recipeInstructions),
    ingredient_lines,
  };
}

// ---- Claude fallback ------------------------------------------------------

const RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    servings: { type: ['integer', 'null'] },
    prep_minutes: { type: ['integer', 'null'] },
    cook_minutes: { type: ['integer', 'null'] },
    instructions: { type: ['string', 'null'] },
    ingredient_lines: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'servings', 'prep_minutes', 'cook_minutes', 'instructions', 'ingredient_lines'],
};

const SYSTEM_PROMPT = `You extract a single recipe from the text of a web page.
Rules:
- title: the recipe name.
- ingredient_lines: an array of the ingredient lines, each VERBATIM as written (e.g. "2 (8 oz) packages cream cheese, softened"). One entry per ingredient.
- instructions: the numbered method as plain text, or null.
- servings/prep_minutes/cook_minutes: integers or null.
- Ignore ads, comments, navigation and unrelated text.
Return only the structured object.`;

/** Collapse a page to a bounded chunk of visible text for the model. */
function pageToText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body).replace(/\s+/g, ' ').trim().slice(0, 24000);
}

async function callClaude(pageText: string): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract the recipe from this page:\n\n${pageText}` }],
      output_config: { format: { type: 'json_schema', schema: RECIPE_JSON_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text content in model response');
  return JSON.parse(textBlock.text);
}

// ---- Handler --------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { url, household_id } = await req.json();
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || !household_id) {
      return json({ error: 'A valid http(s) url and household_id are required' }, 400);
    }

    // Fetch the page server-side, presenting as a real browser. This gets past
    // sites that filter on User-Agent/headers; it does NOT beat sites that
    // fingerprint the TLS/HTTP client (e.g. allrecipes) — those are unfetchable
    // from a server and surface as a "blocked" status below.
    let html: string;
    try {
      const page = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });
      if (!page.ok) {
        // 401/402/403/429/451/503 from a recipe site is almost always bot
        // blocking, not a real "page missing" — tell the user what to do.
        const blocked = [401, 402, 403, 429, 451, 503].includes(page.status);
        return json(
          {
            error: blocked
              ? "This site doesn't allow recipe import. Try a photo or paste the recipe instead."
              : `Couldn't open that page (error ${page.status}).`,
            blocked,
          },
          502,
        );
      }
      html = await page.text();
    } catch (_err) {
      return json({ error: "Couldn't reach that site — check the URL and try again." }, 502);
    }

    // Fast path: schema.org/Recipe JSON-LD, no AI credit consumed.
    const node = findRecipeNode(jsonLdBlocks(html));
    const fromLd = node ? recipeFromJsonLd(node) : null;
    if (fromLd) {
      return json({ recipe: fromLd, source: url, usedAi: false });
    }

    // Fallback: Claude on the page text — this costs a credit. Rate-limit first
    // (also implicitly verifies household membership via the caller's JWT).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_limit: MONTHLY_LIMIT,
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI import limit reached', limitReached: true }, 429);
    }

    const pageText = pageToText(html);
    let parsed: Recipe | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = recipeSchema.parse(await callClaude(pageText));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr || !parsed) {
      console.error('parse-recipe-url failed:', lastErr);
      return json(
        {
          error: "Couldn't find a recipe on that page. Try a photo or paste it instead.",
          fallback: true,
        },
        502,
      );
    }

    return json({ recipe: parsed, source: url, usedAi: true, creditsRemaining: remaining });
  } catch (err) {
    console.error('parse-recipe-url error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
