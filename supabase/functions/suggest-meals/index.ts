// suggest-meals Edge Function (Deno). "What can I make?" — takes a set of
// ingredients (typed, or later from the pantry) + optional filters and asks
// Claude for dinner ideas that use them. Prompt adapted from the dinner-ideas
// ("forkit") fallback generator. Each idea comes back in the same shape the URL
// import produces (title/servings/times/instructions/ingredient_lines) so the
// client can reuse the recipe-review path to save it, plus uses/missing so it
// can offer "add missing to the list".
//
// Same guarantees as parse-recipe: the Anthropic key stays server-side, and the
// call is rate-limited per household via consume_ai_credit.
//
// Env: ANTHROPIC_API_KEY (secret), optional SUGGEST_MODEL. The monthly AI limit
// is resolved server-side in consume_ai_credit (free vs premium).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

// Dinner ideas are a creative task, so default to Sonnet (what the source app
// used); override to claude-haiku-4-5 via SUGGEST_MODEL to cut cost.
const MODEL = Deno.env.get('SUGGEST_MODEL') ?? 'claude-sonnet-4-6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const mealSchema = z.object({
  title: z.string(),
  pitch: z.string(),
  time_estimate: z.string(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  ingredient_lines: z.array(z.string()),
  instructions: z.string().nullable(),
  uses: z.array(z.string()),
  missing: z.array(z.string()),
});
const suggestSchema = z.object({ meals: z.array(mealSchema) });

const MEAL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          pitch: { type: 'string' },
          time_estimate: { type: 'string' },
          servings: { type: ['integer', 'null'] },
          prep_minutes: { type: ['integer', 'null'] },
          cook_minutes: { type: ['integer', 'null'] },
          ingredient_lines: { type: 'array', items: { type: 'string' } },
          instructions: { type: ['string', 'null'] },
          uses: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'title',
          'pitch',
          'time_estimate',
          'servings',
          'prep_minutes',
          'cook_minutes',
          'ingredient_lines',
          'instructions',
          'uses',
          'missing',
        ],
      },
    },
  },
  required: ['meals'],
};

const SYSTEM_PROMPT = `You are a warm, practical cooking assistant helping busy people figure out dinner with whatever they have on hand.

The user gives you a list of ingredients they have. Suggest dinner ideas they can make tonight.

RULES:
1. Only suggest meals makeable with the provided ingredients plus common pantry staples (salt, pepper, oil, butter, garlic, basic dried spices, soy sauce, vinegar, flour, sugar). Do NOT assume specialty ingredients.
2. Prioritize meals that take 30 minutes or less unless the user asks otherwise.
3. Warm, encouraging tone — like a friend who cooks, not a recipe bot. Be honest: "simple but satisfying" beats overselling.
4. Give VARIETY — never the same cuisine for more than one idea.
5. Respect any dietary needs the user states.

For EACH idea, fill every field:
- title: the dish name.
- pitch: ONE warm sentence on why it works with their ingredients.
- time_estimate: a short human string like "~25 min".
- servings / prep_minutes / cook_minutes: integers (estimate sensibly), or null.
- ingredient_lines: the FULL ingredient list as quantified lines, e.g. "2 (8 oz) chicken breasts", "1 cup rice". Include the pantry staples you use. One entry per ingredient.
- instructions: the method as numbered steps separated by newlines (e.g. "1. ...\\n2. ...").
- uses: the subset of the USER'S provided ingredients this idea actually uses (their wording).
- missing: non-staple ingredients this idea needs that the user did NOT provide (max 5; [] if none). Pantry staples never count as missing.

Return only the structured object.`;

async function callClaude(ingredients: string[], filters: string[], count: number): Promise<unknown> {
  const filtersLine = filters.length > 0 ? `\nDietary needs: ${filters.join(', ')}` : '';
  const userContent = `My ingredients: ${ingredients.join(', ')}${filtersLine}\n\nPlease suggest exactly ${count} dinner idea${count > 1 ? 's' : ''}.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: { type: 'json_schema', schema: MEAL_JSON_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text content in model response');
  return JSON.parse(textBlock.text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const ingredients: unknown = body.ingredients;
    const household_id: unknown = body.household_id;
    const filters: string[] = Array.isArray(body.filters) ? body.filters.slice(0, 8) : [];
    const count = Math.min(5, Math.max(1, Number(body.count ?? 3)));

    if (!Array.isArray(ingredients) || ingredients.length === 0 || !household_id) {
      return json({ error: 'ingredients and household_id are required' }, 400);
    }
    const cleaned = ingredients
      .filter((i): i is string => typeof i === 'string')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (cleaned.length === 0) return json({ error: 'No usable ingredients' }, 400);

    // Rate limit (and implicitly verify membership) via the caller's JWT.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'suggest-meals',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI limit reached', limitReached: true }, 429);
    }

    let parsed: z.infer<typeof suggestSchema> | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = suggestSchema.parse(await callClaude(cleaned, filters, count));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr || !parsed) {
      console.error('suggest-meals failed:', lastErr);
      return json({ error: 'Could not come up with ideas — try again', fallback: true }, 502);
    }

    return json({ meals: parsed.meals, creditsRemaining: remaining });
  } catch (err) {
    console.error('suggest-meals error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
