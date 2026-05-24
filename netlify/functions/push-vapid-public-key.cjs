const { handleOptions, json } = require('./lib/push-common.cjs');

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUSH_PUBLIC_KEY;
  if (!publicKey) {
    return json(500, { ok: false, error: 'VAPID public key is not configured.' });
  }

  return json(200, { ok: true, publicKey });
};
