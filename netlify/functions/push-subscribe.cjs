const {
  getSubscriptionId,
  getSubscriptionStore,
  handleOptions,
  initBlobs,
  json,
  parseJsonBody,
} = require('./lib/push-common.cjs');

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    initBlobs(event);
    const body = parseJsonBody(event);
    const subscription = body.subscription || body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return json(400, { ok: false, error: 'Invalid push subscription.' });
    }

    const id = getSubscriptionId(subscription.endpoint);
    await getSubscriptionStore().setJSON(id, {
      id,
      subscription,
      userAgent: body.userAgent || event.headers['user-agent'] || '',
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return json(200, { ok: true, id });
  } catch (error) {
    return json(500, { ok: false, error: error instanceof Error ? error.message : 'Subscribe failed.' });
  }
};
