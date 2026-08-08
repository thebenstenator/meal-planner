// send-reminders Edge Function (Deno). Invoked on a daily schedule (GitHub
// Actions cron) — not by users — so it's guarded by a shared CRON_SECRET rather
// than a user JWT. Finds pantry items expiring soon per household and sends a
// Web Push notification to that household's subscribed devices.
//
// Env (secrets): CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (e.g. mailto:you@example.com). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected by the platform. Deploy with verify_jwt = false (see config.toml).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Items expiring within this many days (or already expired) trigger a nudge.
const HORIZON_DAYS = 3;

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** "Milk, spinach and 2 more are about to expire — use them up before they go." */
function buildBody(names: string[]): string {
  const unique = [...new Set(names)];
  const shown = unique.slice(0, 3).join(', ');
  const extra = unique.length - 3;
  const list = extra > 0 ? `${shown} and ${extra} more` : shown;
  const verb = unique.length === 1 ? 'is' : 'are';
  return `${list} ${verb} about to expire — use ${unique.length === 1 ? 'it' : 'them'} up.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@mealplan.app';
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'VAPID keys not configured' }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Subscriptions to notify.
  const { data: subs, error: subErr } = await supabase
    .from('push_subscription')
    .select('household_id, endpoint, p256dh, auth');
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, note: 'no subscriptions' });

  // Expiring items (within horizon or already expired), grouped by household.
  const { data: items, error: itemErr } = await supabase
    .from('pantry_item')
    .select('household_id, canonical_ingredient(name)')
    .eq('amount_unknown', false)
    .lte('expires_on', isoDay(HORIZON_DAYS));
  if (itemErr) return json({ error: itemErr.message }, 500);

  const namesByHousehold = new Map<string, string[]>();
  for (const it of items ?? []) {
    const name = (it.canonical_ingredient as { name?: string } | null)?.name;
    if (!name) continue;
    const arr = namesByHousehold.get(it.household_id) ?? [];
    arr.push(name);
    namesByHousehold.set(it.household_id, arr);
  }

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const names = namesByHousehold.get(sub.household_id);
    if (!names || names.length === 0) continue;

    const payload = JSON.stringify({
      title: 'Use it up',
      body: buildBody(names),
      url: '/app',
      tag: 'expiring-soon',
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // Gone / not found → the subscription is dead; drop it.
      if (status === 404 || status === 410) {
        await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint);
        pruned += 1;
      } else {
        console.error('push send failed:', status, (err as Error).message);
      }
    }
  }

  return json({ sent, pruned });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
