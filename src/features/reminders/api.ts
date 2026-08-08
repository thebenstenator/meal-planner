import type { SubscriptionKeys } from '@/features/reminders/push';
import { supabase } from '@/lib/supabase/client';

/** Store this browser's push subscription (endpoint is unique; re-saves no-op). */
export async function savePushSubscription(
  householdId: string,
  userId: string,
  keys: SubscriptionKeys,
): Promise<void> {
  const { error } = await supabase.from('push_subscription').upsert(
    {
      household_id: householdId,
      user_id: userId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscription').delete().eq('endpoint', endpoint);
  if (error) throw error;
}
