// estimate-prices Edge Function (Deno). Premium (ADR 0022).
// Estimates a typical US supermarket price for ingredients that have no
// reference price — mostly ones a household created itself — so their recipes
// and lists can be costed. The client stores the result per household and
// shows it as EST, below the household's own store prices.
//
// One batch (up to 50 ingredients) = one metered credit via consume_ai_credit
// (source 'estimate-prices'). Premium-only: checked here, not just in the UI.
// Every returned package unit is validated against the ingredient's default
// unit, so an estimate the app couldn't convert never reaches the client.
//
// Env: ANTHROPIC_API_KEY (secret), optional ESTIMATE_MODEL (default claude-opus-5).
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const MODEL = Deno.env.get('ESTIMATE_MODEL') ?? 'claude-opus-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mirrors src/lib/ingredients/units.ts: count units only convert to themselves.
const MASS = ['g', 'kg', 'oz', 'lb'];
const VOLUME = ['ml', 'l', 'floz', 'cup', 'pt', 'qt', 'gal'];

function allowedUnits(defaultUnit: string): string[] {
  if (MASS.includes(defaultUnit)) return MASS;
  if (VOLUME.includes(defaultUnit)) return VOLUME;
  return [defaultUnit];
}

const resultSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      price_cents: z.number().int(),
      package_quantity: z.number(),
      package_unit: z.string(),
    }),
  ),
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
          id: { type: 'string' },
          price_cents: { type: 'integer' },
          package_quantity: { type: 'number' },
          package_unit: { type: 'string' },
        },
        required: ['id', 'price_cents', 'package_quantity', 'package_unit'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM_PROMPT = `You estimate grocery prices for a meal-planning app's budget features.
For each item, give a typical current price at a mainstream US supermarket (not a discount club, not a specialty store) for the package a home cook would usually buy.
Rules:
- price_cents is the whole-package price in US cents (e.g. $3.49 -> 349).
- package_quantity and package_unit describe that package. package_unit MUST be one of the item's allowed units, exactly as written.
- For count units (each, clove, bunch, head...), price a typical package counted in that unit (e.g. 12 each for a dozen eggs).
- Prefer store-brand or common-brand pricing; avoid organic or premium unless the item name says so.
- Return exactly one entry per input item, echoing its id unchanged.`;

interface CanonicalRow {
  id: string;
  name: string;
  default_unit: string | null;
  category: string | null;
}

async function estimate(rows: CanonicalRow[]): Promise<z.infer<typeof resultSchema>> {
  const client = new Anthropic();
  const lines = rows.map(
    (r) =>
      `- id: ${r.id} | item: ${r.name}${r.category ? ` (${r.category})` : ''} | allowed units: ${allowedUnits(r.default_unit ?? 'each').join(', ')}`,
  );
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: RESULT_JSON_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Estimate prices for:\n${lines.join('\n')}` }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Model declined the request');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text content in model response');
  return resultSchema.parse(JSON.parse(text.text));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const household_id: unknown = body.household_id;
    const ids: string[] = Array.isArray(body.canonical_ids)
      ? [...new Set<string>(body.canonical_ids.filter((n: unknown): n is string => typeof n === 'string'))].slice(0, 50)
      : [];
    if (ids.length === 0 || typeof household_id !== 'string') {
      return json({ error: 'canonical_ids and household_id are required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    // Premium-only. RLS scopes this read to the caller's own households.
    const { data: household } = await supabase
      .from('household')
      .select('is_premium')
      .eq('id', household_id)
      .maybeSingle();
    if (!household?.is_premium) {
      return json({ error: 'AI price estimates are a premium feature', premiumRequired: true }, 403);
    }

    const { data: rows, error: rowsErr } = await supabase
      .from('canonical_ingredient')
      .select('id, name, default_unit, category')
      .in('id', ids);
    if (rowsErr) return json({ error: rowsErr.message }, 400);
    if (!rows || rows.length === 0) return json({ estimates: [] });

    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'estimate-prices',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI limit reached', limitReached: true }, 429);
    }

    let parsed: z.infer<typeof resultSchema> | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = await estimate(rows as CanonicalRow[]);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr || !parsed) {
      console.error('estimate-prices failed:', lastErr);
      return json({ error: 'Could not estimate those prices' }, 502);
    }

    // Keep only estimates the app can actually use.
    const byId = new Map((rows as CanonicalRow[]).map((r) => [r.id, r]));
    const estimates = parsed.items.filter((e) => {
      const row = byId.get(e.id);
      return (
        !!row &&
        e.price_cents >= 0 &&
        e.price_cents <= 100_000 &&
        e.package_quantity > 0 &&
        allowedUnits(row.default_unit ?? 'each').includes(e.package_unit)
      );
    });

    return json({ estimates, creditsRemaining: remaining });
  } catch (err) {
    console.error('estimate-prices error:', err);
    return json({ error: 'Unexpected error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
