// Slice 9 — parse-recipe Edge Function (Deno).
// Sends recipe photos (one recipe, possibly multiple pages) to Claude vision and
// returns strict, Zod-validated JSON. The Anthropic API key never leaves the
// server. Per-household monthly rate limiting via consume_ai_credit.
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

// Zod validator for Claude's response (single source of truth for the shape).
const parsedIngredientSchema = z.object({
  raw_text: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  name: z.string(),
  descriptor: z.string().nullable(),
  is_optional: z.boolean(),
  confidence: z.number().min(0).max(1),
});
const parsedRecipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  instructions: z.string().nullable(),
  ingredients: z.array(parsedIngredientSchema),
});

// JSON Schema that constrains Claude's output (structured outputs).
const RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    servings: { type: ['integer', 'null'] },
    prep_minutes: { type: ['integer', 'null'] },
    cook_minutes: { type: ['integer', 'null'] },
    instructions: { type: ['string', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          raw_text: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          name: { type: 'string' },
          descriptor: { type: ['string', 'null'] },
          is_optional: { type: 'boolean' },
          confidence: { type: 'number' },
        },
        required: ['raw_text', 'quantity', 'unit', 'name', 'descriptor', 'is_optional', 'confidence'],
      },
    },
  },
  required: ['title', 'servings', 'prep_minutes', 'cook_minutes', 'instructions', 'ingredients'],
};

const SYSTEM_PROMPT = `You extract a single recipe from one or more photos or a PDF (a recipe may span multiple pages).
Rules:
- Combine all images into ONE recipe.
- For each ingredient line, put the ORIGINAL text verbatim in raw_text.
- quantity: a decimal number (convert fractions like 1/2 -> 0.5, ranges -> the upper bound), or null if none ("to taste").
- unit: a short lowercase unit (oz, lb, g, cup, tbsp, tsp, clove, can, package, ...), or null.
- name: the core ingredient (e.g. "cream cheese"), lowercased, without quantity/descriptors.
- descriptor: prep notes like "softened", "finely chopped", or null.
- is_optional: true only if the line says optional.
- confidence: 0-1, your confidence in that line's parse.
- servings/prep_minutes/cook_minutes: integers or null.
- instructions: the method as markdown, or null.
Return only the structured object.`;

interface ImageInput {
  media_type: string;
  data: string;
}

async function callClaude(images: ImageInput[]): Promise<unknown> {
  const content = [
    ...images.map((img) =>
      img.media_type === 'application/pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: img.data },
          }
        : {
            type: 'image',
            source: { type: 'base64', media_type: img.media_type, data: img.data },
          },
    ),
    { type: 'text', text: 'Extract this recipe as structured JSON.' },
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
      output_config: { format: { type: 'json_schema', schema: RECIPE_JSON_SCHEMA } },
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }
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
      return json({ error: 'At most 6 images per recipe' }, 400);
    }

    // Rate limit (and implicitly verify household membership) via the caller's JWT.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'parse-recipe',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI import limit reached', limitReached: true }, 429);
    }

    // Parse with one retry on validation failure.
    let parsed: unknown;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callClaude(images);
        parsed = parsedRecipeSchema.parse(raw);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) {
      console.error('parse-recipe failed:', lastErr);
      return json({ error: 'Could not read that recipe', fallback: true }, 502);
    }

    return json({ recipe: parsed, creditsRemaining: remaining });
  } catch (err) {
    console.error('parse-recipe error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
