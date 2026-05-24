# Config

Keep local environment values out of git.

## Client Env Contract

Vite exposes `VITE_*` values to browser JavaScript. Do not treat them as secret after deployment.

```bash
VITE_HERMES_API_URL=https://fi.gisketch.com
VITE_HERMES_WEB_TOKEN=regular-client-token
VITE_HERMES_ADMIN_MODE=proxy
VITE_HERMES_ADMIN_PROXY_URL=
VITE_USAGE_URL=/usage-api/usage.json
VITE_PUSH_PUBLIC_KEY=web-push-vapid-public-key
```

Legacy aliases still read by current code:

```bash
VITE_API_URL=
VITE_API_TOKEN=
```

## Deployment Notes

- Use `https://fi.gisketch.com` for Hermes API calls.
- The API has no root route. Check `https://fi.gisketch.com/health`, `/v1/...`, or `/api/ws`.
- Keep `HERMES_WEB_ADMIN_TOKEN` server-only. Browser admin writes require a private proxy.
- Never commit token values, logs, screenshots, or fixtures containing tokens.
- Tighten Hermes CORS origins before public production; wildcard CORS is only acceptable for private testing.
- Keep legacy usage at `/usage-api/usage.json` or set `VITE_USAGE_URL`.

## Server Env Contract

These values stay in Netlify/server environment variables:

```bash
VAPID_PUBLIC_KEY=web-push-vapid-public-key
VAPID_PRIVATE_KEY=web-push-vapid-private-key
VAPID_SUBJECT=mailto:owner@example.com
PUSH_API_TOKEN=server-to-server-send-token
```
