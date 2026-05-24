const {
  getSubscriptionStore,
  handleOptions,
  initBlobs,
  json,
  listSubscriptions,
  parseJsonBody,
  requirePushApiToken,
  requireVapidKeys,
  webpush,
} = require('./lib/push-common.cjs');

const cleanNotificationText = (value, fallback = '') => {
  return String(value || fallback)
    .replace(/^[\s"']*from\s+fi\b[\s"':,\-.]*/i, '')
    .trim();
};

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const authResponse = requirePushApiToken(event);
  if (authResponse) return authResponse;

  try {
    initBlobs(event);
    requireVapidKeys();
    const body = parseJsonBody(event);
    const rawTitle = cleanNotificationText(body.title, 'Fi');
    const rawBody = cleanNotificationText(body.body, 'New update.');
    const payload = {
      title: /^from\s+fi$/i.test(rawTitle) || /^fi\s+is\s+ready$/i.test(rawTitle) ? 'Fi' : rawTitle,
      body: rawBody || 'New update.',
      url: body.url || '/',
      tag: body.tag || 'fi-push',
      icon: body.icon || '/icons/fi-icon-192.png',
      badge: body.badge || '/icons/fi-icon-192.png',
      data: body.data || {},
    };

    const entries = await listSubscriptions();
    const store = getSubscriptionStore();
    const result = { ok: true, sent: 0, removed: 0, failed: 0, total: entries.length };

    await Promise.all(entries.map(async (entry) => {
      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify(payload));
        result.sent += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await store.delete(entry.id);
          result.removed += 1;
          return;
        }
        result.failed += 1;
      }
    }));

    return json(200, result);
  } catch (error) {
    return json(500, { ok: false, error: error instanceof Error ? error.message : 'Push send failed.' });
  }
};
