# Config

Keep local environment values out of git.

## Client Env Contract

Vite exposes `VITE_*` values to browser JavaScript. Do not treat them as secret after deployment.

```bash
VITE_HERMES_API_URL=http://167.254.240.228:8643
VITE_HERMES_WEB_TOKEN=regular-client-token
VITE_HERMES_ADMIN_MODE=proxy
VITE_HERMES_ADMIN_PROXY_URL=
VITE_USAGE_URL=/usage-api/usage.json
```

Legacy aliases still read by current code:

```bash
VITE_API_URL=
VITE_API_TOKEN=
```

## Deployment Notes

- Use `http://167.254.240.228:8643` for migration/integration testing.
- Use `https://fi.gisketch.com` after final API/DNS cutover.
- Keep `HERMES_WEB_ADMIN_TOKEN` server-only. Browser admin writes require a private proxy.
- Never commit token values, logs, screenshots, or fixtures containing tokens.
- Tighten Hermes CORS origins before public production; wildcard CORS is only acceptable for private testing.
- Keep legacy usage at `/usage-api/usage.json` or set `VITE_USAGE_URL`.
