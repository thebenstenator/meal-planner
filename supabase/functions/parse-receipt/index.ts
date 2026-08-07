// Slice 12 — parse-receipt Edge Function (Deno).
// Sends grocery receipt photos to Claude vision and returns strict, Zod-validated
// JSON: store, date, total, and a line item per purchased product. The Anthropic
// API key never leaves the server. Per-household monthly rate limiting via
// consume_ai_credit (same meter as the other AI features).
//
// Env: ANTHROPIC_API_KEY (secret), optional RECEIPT_PARSE_MODEL.
// SUPABASE_URL / SUPABASE_ANON_KEY are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

// Receipts are noisy; Haiku vision is cheap and good enough. Override if needed.
const MODEL = Deno.env.get('RECEIPT_PARSE_MODEL') ?? 'claude-haiku-4-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  total_price_cents: z.number().int().nullable(),
  unit_price_cents: z.number().int().nullable(),
});
const receiptSchema = z.object({
  store_name: z.string().nullable(),
  purchased_on: z.string().nullable(),
  total_cents: z.number().int().nullable(),
  line_items: z.array(lineItemSchema),
});

const RECEIPT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    store_name: { type: ['string', 'null'] },
    purchased_on: { type: ['string', 'null'] },
    total_cents: { type: ['integer', 'null'] },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          total_price_cents: { type: ['integer', 'null'] },
          unit_price_cents: { type: ['integer', 'null'] },
        },
        required: ['description', 'quantity', 'unit', 'total_price_cents', 'unit_price_cents'],
      },
    },
  },
  required: ['store_name', 'purchased_on', 'total_cents', 'line_items'],
};

const SYSTEM_PROMPT = `You extract a grocery receipt from one or more photos into structured JSON.
Rules:
- store_name: the store/merchant name, or null.
- purchased_on: the purchase date as YYYY-MM-DD, or null if not shown.
- total_cents: the grand total the customer paid, in integer cents (e.g. $42.17 -> 4217), or null.
- line_items: ONE entry per purchased food/grocery product. Exclude subtotals, tax lines,
  totals, discounts, loyalty/coupon lines, bag fees, and payment/change lines.
- description: the product text as printed (clean up obvious OCR garble, keep it recognizable).
- quantity: the count or weight if shown (e.g. "2", "1.34"), else null.
- unit: a short lowercase unit if shown (lb, oz, kg, ea, ...), else null.
- total_price_cents: the line's total price in integer cents, or null.
- unit_price_cents: the per-unit price in integer cents if shown (e.g. "$1.99/lb" -> 199), or null.
All money is integer cents. Return only the structured object.`;

interface ImageInput {
  media_type: string;
  data: string;
}

async function callClaude(images: ImageInput[]): Promise<unknown> {
  const content = [
    ...images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.media_type, data: img.data },
    })),
    { type: 'text', text: 'Extract this receipt as structured JSON.' },
  ];

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
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: RECEIPT_JSON_SCHEMA } },
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
    const { images, household_id } = await req.json();
    if (!Array.isArray(images) || images.length === 0 || !household_id) {
      return json({ error: 'images and household_id are required' }, 400);
    }
    if (images.length > 6) {
      return json({ error: 'At most 6 images per receipt' }, 400);
    }

    // Rate limit (and implicitly verify household membership) via the caller's JWT.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'parse-receipt',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI limit reached', limitReached: true }, 429);
    }

    let parsed: unknown;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = receiptSchema.parse(await callClaude(images));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) {
      console.error('parse-receipt failed:', lastErr);
      return json({ error: 'Could not read that receipt', fallback: true }, 502);
    }

    return json({ receipt: parsed, creditsRemaining: remaining });
  } catch (err) {
    console.error('parse-receipt error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
