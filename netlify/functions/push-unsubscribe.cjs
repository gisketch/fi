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
    const endpoint = body.endpoint || body.subscription?.endpoint;
    if (!endpoint) {
      return json(400, { ok: false, error: 'Missing subscription endpoint.' });
    }

    const id = getSubscriptionId(endpoint);
    await getSubscriptionStore().delete(id);
    return json(200, { ok: true, id });
  } catch (error) {
    return json(500, { ok: false, error: error instanceof Error ? error.message : 'Unsubscribe failed.' });
  }
};
