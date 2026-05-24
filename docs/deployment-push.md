# Deploy And Push Notifications

## Production Deploy

Target Netlify project:

- Site name: `dulcet-naiad-d96d5a`
- Site ID: `266db21c-a1a5-4b8e-8858-1d4a9f644e46`
- Production URL: `https://dulcet-naiad-d96d5a.netlify.app`

Local deploy stack:

```bash
nvm use 24
bun install
bun scripts/check-hermes-events.ts
bun run build
netlify deploy --prod --build
```

Required Netlify env:

```bash
VITE_API_URL=/api
VITE_API_TOKEN=<legacy browser token if still needed>
VITE_HERMES_API_URL=https://fi.gisketch.com
VITE_HERMES_WEB_TOKEN=<regular Hermes browser token>
VITE_TERMINAL_GATEWAY_URL=https://fi-terminal.gisketch.com
VITE_TERMINAL_DEFAULT_HOST=167.254.240.228
VITE_TERMINAL_DEFAULT_PORT=22
VITE_TERMINAL_DEFAULT_USER=root
VITE_PUSH_PUBLIC_KEY=<VAPID public key>
VAPID_PUBLIC_KEY=<same VAPID public key>
VAPID_PRIVATE_KEY=<VAPID private key>
VAPID_SUBJECT=mailto:<owner email>
PUSH_API_TOKEN=<server-to-server bearer token>
```

Do not commit `.env`; import/set these in Netlify.

## Terminal Gateway

The in-app terminal is separate from Hermes. Browser code talks to the private terminal gateway:

```txt
POST https://fi-terminal.gisketch.com/auth/unlock
GET  https://fi-terminal.gisketch.com/auth/verify
WS   wss://fi-terminal.gisketch.com/terminal
```

Browser storage:

- `fi_terminal_gateway_token`: JWT returned by the terminal gateway after PIN unlock.
- `fi_terminal_ssh_profile`: local SSH host, port, user, and password profile.

The PIN itself is not stored. SSH credentials stay browser-local until the user opens a terminal session, then they are sent directly to the terminal gateway WebSocket.

## Push API

Browser endpoints:

- `GET /push-api/vapid-public-key` returns the VAPID public key.
- `POST /push-api/subscribe` stores a browser `PushSubscription`.
- `POST /push-api/unsubscribe` removes a subscription by endpoint.

Server/API endpoint:

```bash
curl -X POST https://dulcet-naiad-d96d5a.netlify.app/push-api/send \
  -H "Authorization: Bearer $PUSH_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fi",
    "body": "Background task finished.",
    "url": "/",
    "tag": "fi-task"
  }'
```

Payload fields:

- `title`: notification title, defaults to `Fi`.
- `body`: notification body, defaults to `New update.`.
- Do not prefix the title or body with `from Fi`; Fi strips that redundant sender text before delivery. iOS may still render its own `from <app name>` attribution line.
- `url`: page opened when the notification is tapped.
- `tag`: browser notification replacement/grouping tag.
- `icon` and `badge`: optional icon paths; defaults use Fi PNG icons.
- `data`: optional JSON object copied into notification data.

## iOS Setup

1. Open the production URL in Safari on iPhone/iPad.
2. Share -> Add to Home Screen.
3. Open Fi from the Home Screen icon, not inside Safari.
4. Menu -> Notifications -> Enable notifications.
5. Accept the iOS permission prompt.
6. Send a server push through `POST /push-api/send`.

iOS requirements:

- iOS/iPadOS 16.4+.
- Installed Home Screen web app.
- HTTPS production origin.
- Manifest with stable `id`, standalone display, and PNG icons.
- User gesture to request permission/subscribe.

## Implementation Notes

- Push subscriptions are stored in Netlify Blobs store `fi-push-subscriptions`.
- Expired subscriptions returning 404/410 are removed during send.
- The generated service worker imports `/push-handler.js` for `push` and `notificationclick` events.
- `PUSH_API_TOKEN` is a server-to-server secret. Do not expose it to browser code.
- `VITE_PUSH_PUBLIC_KEY` is public and safe to expose.
