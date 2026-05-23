export type NotificationSupport = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  reason?: string;
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
  await registration.showNotification('Fi is ready', {
    body: 'Notifications are enabled for this PWA.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'fi-notifications-ready',
  });

  return 'Notifications enabled.';
}
