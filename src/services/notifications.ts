export type NotificationSupport = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  reason?: string;
};

type PushPublicKeyResponse = {
  ok: boolean;
  publicKey?: string;
  error?: string;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, permission: 'unsupported', reason: 'Notifications require a browser.' };
  }

  if (!('Notification' in window)) {
    return { supported: false, permission: 'unsupported', reason: 'This browser does not support notifications.' };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, permission: Notification.permission, reason: 'Service workers are unavailable.' };
  }

  if (!('PushManager' in window)) {
    return { supported: false, permission: Notification.permission, reason: 'Web Push is unavailable in this browser.' };
  }

  if (!window.isSecureContext) {
    return { supported: false, permission: Notification.permission, reason: 'Notifications require HTTPS or localhost.' };
  }

  return { supported: true, permission: Notification.permission };
}

export async function enableNotifications(): Promise<string> {
  const support = getNotificationSupport();
  if (!support.supported) {
    throw new Error(support.reason || 'Notifications are not supported here.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notification permission is blocked.' : 'Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const keyResponse = await fetch('/push-api/vapid-public-key');
    const keyPayload = await keyResponse.json() as PushPublicKeyResponse;
    const publicKey = keyPayload.publicKey || import.meta.env.VITE_PUSH_PUBLIC_KEY;

    if (!keyResponse.ok || !publicKey) {
      throw new Error(keyPayload.error || 'Push public key is not configured.');
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const subscribeResponse = await fetch('/push-api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      userAgent: navigator.userAgent,
    }),
  });

  if (!subscribeResponse.ok) {
    const errorPayload = await subscribeResponse.json().catch(() => null) as { error?: string } | null;
    throw new Error(errorPayload?.error || 'Failed to store push subscription.');
  }

  await registration.showNotification('Fi is ready', {
    body: 'Notifications are enabled for this PWA.',
    icon: '/icons/fi-icon-192.png',
    badge: '/icons/fi-icon-192.png',
    tag: 'fi-notifications-ready',
  });

  return 'Push notifications enabled.';
}
