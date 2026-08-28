// recipe-companion Edge Function (Deno). The "ask about this recipe" box: takes
// the recipe the user is looking at plus their question(s) and returns a
// grounded, practical answer — substitutions, doneness, technique, dietary
// swaps. Decision 0015 (the premium AI recipe companion).
//
// Same guarantees as the other AI functions (parse-recipe, suggest-meals): the
// Anthropic key stays a server secret, and every call is metered per household
// through consume_ai_credit on the caller's JWT. Metering is per request — one
// credit per question (0015 "metering", model A). That's the single RPC call
// below, so moving to a per-session/conversation model later is contained.
//
// Env: ANTHROPIC_API_KEY (secret), optional COMPANION_MODEL. The monthly AI
// limit (free vs premium) is resolved server-side inside consume_ai_credit.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

// Q&A grounded in a recipe that's supplied in context is reasoning over provided
// text, not open-ended generation — Haiku handles it well and cheaply. Bump to a
// stronger model via COMPANION_MODEL if answer quality needs it.
const MODEL = Deno.env.get('COMPANION_MODEL') ?? 'claude-haiku-4-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// The recipe context the client sends — the recipe already on screen. Trusted as
// the user's own view; sizes are capped so a question can't smuggle a huge
// payload. Not re-fetched server-side (no data leak: it's the user's own recipe).
const recipeSchema = z.object({
  title: z.string().max(300),
  servings: z.number().int().positive().nullable().optional(),
  ingredients: z.array(z.string().max(400)).max(120).default([]),
  instructions: z.string().max(20_000).nullable().optional(),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4_000),
});

const requestSchema = z.object({
  household_id: z.string().uuid(),
  recipe: recipeSchema,
  // The conversation so far, oldest first. The client trims history; the recipe
  // (in the system prompt) carries the context, not a long transcript.
  messages: z.array(messageSchema).min(1).max(20),
});

const SYSTEM_PREAMBLE = `You are a warm, practical cooking assistant. The person is cooking (or about to cook) one specific recipe, given below, and will ask you about it.

RULES:
1. Ground every answer in THIS recipe and general cooking knowledge. Never claim the recipe contains an ingredient or step that it does not.
2. Be honest about food safety. Never endorse an unsafe shortcut — undercooked poultry, eggs or pork, unsafe canning, food left out too long. Say so plainly.
3. Talk like a friend who cooks: concise and practical, not a textbook. When you suggest a substitution or change, give amounts (e.g. "use 1 cup plain yogurt thinned with 2 tbsp milk").
4. If they ask you to change the recipe (halve the sugar, make it dairy-free, convert to metric), explain the change clearly and completely. For now they apply it themselves — you cannot save edits yet.
5. If a question is not about cooking or this recipe, answer briefly and steer back to the recipe.

Keep answers short unless the question genuinely needs detail.`;

function recipeContext(recipe: z.infer<typeof recipeSchema>): string {
  const parts = [`Title: ${recipe.title}`];
  if (recipe.servings != null) parts.push(`Serves: ${recipe.servings}`);
  const ingredients = recipe.ingredients.map((i) => i.trim()).filter(Boolean);
  if (ingredients.length > 0) {
    parts.push(`Ingredients:\n${ingredients.map((i) => `- ${i}`).join('\n')}`);
  }
  if (recipe.instructions?.trim()) parts.push(`Instructions:\n${recipe.instructions.trim()}`);
  return parts.join('\n\n');
}

async function callClaude(
  recipe: z.infer<typeof recipeSchema>,
  messages: z.infer<typeof messageSchema>[],
): Promise<string> {
  const system = `${SYSTEM_PREAMBLE}\n\n--- THE RECIPE THE USER IS COOKING ---\n${recipeContext(recipe)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text content in model response');
  return textBlock.text as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'household_id, recipe and messages are required' }, 400);
    }
    const { household_id, recipe, messages } = parsed.data;

    // A turn ends on the user's question — the thing we're answering.
    if (messages[messages.length - 1]?.role !== 'user') {
      return json({ error: 'The last message must be your question' }, 400);
    }

    // Meter (and implicitly verify membership) via the caller's JWT. One credit
    // per question — the whole metering policy is this one call.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: remaining, error: rlError } = await supabase.rpc('consume_ai_credit', {
      p_household_id: household_id,
      p_source: 'recipe-companion',
    });
    if (rlError) return json({ error: rlError.message }, 403);
    if (remaining === -1) {
      return json({ error: 'Monthly AI limit reached', limitReached: true }, 429);
    }

    let answer: string;
    try {
      answer = await callClaude(recipe, messages);
    } catch (err) {
      console.error('recipe-companion call failed:', err);
      return json({ error: 'Could not get an answer — try again', fallback: true }, 502);
    }

    return json({ answer, creditsRemaining: remaining });
  } catch (err) {
    console.error('recipe-companion error:', err);
    return json({ error: 'Unexpected error', fallback: true }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
