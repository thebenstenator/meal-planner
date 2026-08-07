// classify-ingredients Edge Function (Deno).
// Classifies a batch of grocery item names into a fixed category vocabulary so
// the "what can I make?" seed can tell real ingredients from snacks/drinks/
// non-food. Used for items our free keyword guesser left uncategorized. The
// result is saved back onto the ingredient by the client, so each name is only
// classified once. Metered per household via consume_ai_credit (source
// 'classify-ingredients'). The Anthropic key stays server-side.
//
// Env: ANTHROPIC_API_KEY (secret), optional CLASSIFY_MODEL. The monthly AI limit
// is resolved server-side in consume_ai_credit (free vs premium).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const MODEL = Deno.env.get('CLASSIFY_MODEL') ?? 'claude-haiku-4-5';

const CATEGORIES = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'frozen',
  'canned',
  'pantry',
  'baking',
  'spices',
  'condiments',
  'beverages',
  'snacks',
  'breakfast',
  'other',
] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const resultSchema = z.object({
  items: z.array(z.object({ name: z.string(), category: z.enum(CATEGORIES) })),
});

const RESULT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
        required: ['name', 'category'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM_PROMPT = `You classify grocery/pantry items into exactly one category, for a cooking app.
Categories: produce, meat, seafood, dairy, bakery, frozen, canned, pantry, baking, spices, condiments, beverages, snacks, breakfast, other.
Rules:
- Pick the single best category for each item as a home cook would shelve it.
- "produce" = fresh fruit/veg/herbs. "pantry" = shelf-stable staples (rice, pasta, oil, dried beans, nuts, broth). "baking" = flour/sugar/leaveners/extracts. "spices" = dried seasonings.
- "snacks" = chips, candy, cookies, bars — things eaten as-is, not cooked with.
- "beverages" = drinks (soda, juice, coffee, tea, alcohol).
- "other" = anything NOT a food ingredient (paper towels, dish soap, pet food, vitamins) or that you genuinely can't place.
- Return one entry per input item, keeping the name exactly as given.
Return only the structured object.`;

async function callClaude(names: string[]): Promise<unknown> {
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
      messages: [{ role: 'user', content: `Classify these items:\n${names.join('\n')}` }],
      output_config: { format: { type: 'json_schema', schema: RESULT_JSON_SCHEMA } },
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
    const household_id: unknown = body.household_id;
    const names: string[] = Array.isArray(body.names)
      ? body.names.filter((n: unknown): n is string => typeof n === 'string').map((n) => n.trim()).filter(Boolean).slice(0, 50)
      : [];
    if (names.length === 0 || !household_id) {
      return json({ error: 'names and household_id are required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'classify-ingredients',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI limit reached', limitReached: true }, 429);
    }

    let parsed: z.infer<typeof resultSchema> | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = resultSchema.parse(await callClaude(names));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr || !parsed) {
      console.error('classify-ingredients failed:', lastErr);
      return json({ error: 'Could not classify those items', fallback: true }, 502);
    }

    return json({ items: parsed.items, creditsRemaining: remaining });
  } catch (err) {
    console.error('classify-ingredients error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
