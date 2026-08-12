import { env } from '@/lib/config/env';

/** Whether this browser can do Web Push at all (iOS needs an installed PWA). */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** True once VAPID is configured (env key present) — reminders are dark without it. */
export function isPushConfigured(): boolean {
  return env.VITE_VAPID_PUBLIC_KEY.length > 0;
}

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function notificationPermission(): PermissionState {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PermissionState;
}

/** The stored PushSubscription for this browser, if the user already subscribed. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export interface SubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Ask permission and subscribe this browser to push. Returns the endpoint +
 * keys the server needs to send an encrypted message, or null if the user
 * declined / it isn't available.
 */
export async function subscribe(): Promise<SubscriptionKeys | null> {
  if (!isPushSupported() || !isPushConfigured()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.VITE_VAPID_PUBLIC_KEY),
    }));

  return toKeys(sub);
}

/** Unsubscribe this browser locally; returns the endpoint that was removed. */
export async function unsubscribe(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}

/**
 * Show a notification from the service worker right now, so you can confirm
 * reminders actually surface on this device without waiting for the daily cron
 * (which only fires when something is expiring). This is a local display test —
 * it exercises permission and the SW's notification handling, not the server
 * push round-trip.
 */
export async function showTestNotification(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Reminders are on', {
    body: 'This is what an expiring-item nudge will look like.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'reminder-test',
    data: { url: '/app' },
  });
}

function toKeys(sub: PushSubscription): SubscriptionKeys {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
}

/** VAPID keys are base64url; the Push API wants an ArrayBuffer-backed view. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
