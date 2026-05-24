const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');
const webpush = require('web-push');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const handleOptions = (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  return null;
};

const parseJsonBody = (event) => {
  if (!event.body) return {};
  return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
};

const getSubscriptionId = (endpoint) => crypto
  .createHash('sha256')
  .update(endpoint)
  .digest('hex');

const initBlobs = (event) => {
  connectLambda(event);
};

const getSubscriptionStore = () => getStore('fi-push-subscriptions');

const requireVapidKeys = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUSH_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('Push VAPID keys are not configured.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
};

const requirePushApiToken = (event) => {
  const expected = process.env.PUSH_API_TOKEN;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const actual = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';

  if (!expected || actual !== expected) {
    return json(401, { ok: false, error: 'Unauthorized' });
  }

  return null;
};

const listSubscriptions = async () => {
  const store = getSubscriptionStore();
  const subscriptions = [];

  for await (const page of store.list({ paginate: true })) {
    for (const blob of page.blobs) {
      const entry = await store.get(blob.key, { type: 'json' });
      if (entry?.subscription?.endpoint) {
        subscriptions.push(entry);
      }
    }
  }

  return subscriptions;
};

module.exports = {
  getSubscriptionId,
  getSubscriptionStore,
  handleOptions,
  initBlobs,
  json,
  listSubscriptions,
  parseJsonBody,
  requirePushApiToken,
  requireVapidKeys,
  webpush,
};
