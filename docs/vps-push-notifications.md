---
name: fi-vps-push-notifications
description: VPS-only guide for sending Fi PWA push notifications.
---

# VPS Push Notifications

This guide is only for a VPS, API server, cron job, worker, or backend service that wants to send a notification to the Fi PWA.

Fi production push endpoint:

```txt
https://fi-web.gisketch.com/push-api/send
```

## VPS Secrets

The VPS only needs one secret:

```bash
PUSH_API_TOKEN=<server-to-server token>
```

Recommended env file:

```bash
sudo mkdir -p /etc/fi
sudo nano /etc/fi/push.env
```

Put this in `/etc/fi/push.env`:

```bash
PUSH_API_TOKEN=replace_with_real_push_api_token
FI_PUSH_SEND_URL=https://fi-web.gisketch.com/push-api/send
```

Lock the file:

```bash
sudo chmod 600 /etc/fi/push.env
```

Do not commit this env file. Do not expose `PUSH_API_TOKEN` to browser code.

## Quick Send

```bash
set -a
. /etc/fi/push.env
set +a

curl -sS -X POST "$FI_PUSH_SEND_URL" \
  -H "Authorization: Bearer $PUSH_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fi",
    "body": "Task complete.",
    "url": "/",
    "tag": "fi-vps-task"
  }'
```

Expected response shape:

```json
{
  "ok": true,
  "sent": 1,
  "removed": 0,
  "failed": 0,
  "total": 1
}
```

`sent: 0` means no device has enabled notifications yet.

## Install `fi-notify`

Install dependencies:

```bash
sudo apt update
sudo apt install -y curl jq
```

Create the command:

```bash
sudo nano /usr/local/bin/fi-notify
```

Paste:

```bash
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${FI_PUSH_ENV:-/etc/fi/push.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

TITLE="${1:-Fi}"
BODY="${2:-Task complete.}"
URL="${3:-/}"
TAG="${4:-fi-vps-push}"

curl -sS -X POST "$FI_PUSH_SEND_URL" \
  -H "Authorization: Bearer $PUSH_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg title "$TITLE" \
    --arg body "$BODY" \
    --arg url "$URL" \
    --arg tag "$TAG" \
    '{title:$title, body:$body, url:$url, tag:$tag}')"
```

Make it executable:

```bash
sudo chmod +x /usr/local/bin/fi-notify
```

Send:

```bash
fi-notify "Fi" "Backup finished." "/" "backup-finished"
```

## Payload

Request body:

```json
{
  "title": "Fi",
  "body": "Message text",
  "url": "/",
  "tag": "stable-notification-tag",
  "icon": "/icons/fi-icon-192.png",
  "badge": "/icons/fi-icon-192.png",
  "data": {
    "kind": "job",
    "jobId": "abc123"
  }
}
```

Fields:

- `title`: notification title.
- `body`: notification body.
- Do not prefix the title or body with `from Fi`; Fi strips that redundant sender text before delivery. iOS may still render its own `from <app name>` attribution line.
- `url`: path opened when the notification is tapped.
- `tag`: browser grouping/replacement key.
- `icon`: optional icon path.
- `badge`: optional badge path.
- `data`: optional JSON metadata.

## Examples

Backup complete:

```bash
fi-notify "Fi" "VPS backup finished." "/" "vps-backup"
```

Job failed:

```bash
fi-notify "Fi Error" "Worker failed on the VPS." "/?alert=worker" "vps-worker-error"
```

Cloudflare task:

```bash
fi-notify "Cloudflare" "DNS update finished." "/?tool=cloudflare" "cloudflare-dns"
```

## Cron

Open cron:

```bash
crontab -e
```

Example:

```cron
0 9 * * * /usr/local/bin/fi-notify "Fi" "Daily VPS check complete." "/" "daily-vps-check" >/tmp/fi-notify.log 2>&1
```

## Node

```js
const res = await fetch(process.env.FI_PUSH_SEND_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.PUSH_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Fi',
    body: 'Task complete.',
    url: '/',
    tag: 'node-task-complete',
  }),
});

console.log(await res.json());
```

## Python

```python
import os
import requests

res = requests.post(
    os.environ["FI_PUSH_SEND_URL"],
    headers={
        "Authorization": f"Bearer {os.environ['PUSH_API_TOKEN']}",
        "Content-Type": "application/json",
    },
    json={
        "title": "Fi",
        "body": "Task complete.",
        "url": "/",
        "tag": "python-task-complete",
    },
    timeout=15,
)

print(res.status_code, res.json())
```

## Troubleshooting

`401 Unauthorized`:

```txt
PUSH_API_TOKEN is missing or wrong.
```

`sent: 0`:

```txt
No installed PWA/device has enabled notifications yet.
```

`removed` increases:

```txt
Expired browser push subscriptions were cleaned up.
```

`failed` increases:

```txt
Check the Netlify function logs for push-send.
```

## Device Requirement

The target device must enable notifications first.

For iPhone/iPad:

1. Open `https://fi-web.gisketch.com` in Safari.
2. Add to Home Screen.
3. Open Fi from the Home Screen icon.
4. Enable notifications in Fi.
5. Accept the permission prompt.

iOS requires iOS/iPadOS 16.4+.
