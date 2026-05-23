# Fi API Reference

Base URL: `https://fi.gisketch.com`
Auth: `Authorization: Bearer fi-gisketch-dashboard`

---

## Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/v1/models` | List available models |
| `POST` | `/v1/chat/completions` | Chat (OpenAI-compatible) |
| `POST` | `/v1/runs` | Start a stateful run |
| `GET` | `/v1/runs/{run_id}` | Get run status |
| `GET` | `/v1/runs/{run_id}/events` | SSE event stream |
| `POST` | `/v1/runs/{run_id}/stop` | Interrupt a run |
| `GET` | `/v1/capabilities` | API capabilities |

---

## Authentication

All endpoints except `/health` require a Bearer token:

```
Authorization: Bearer fi-gisketch-dashboard
```

Invalid keys return `401`:
```json
{"error": {"message": "Invalid API key", "code": "invalid_api_key"}}
```

---

## Models

### `GET /v1/models`

Returns the single model available through the gateway:

```json
{
  "object": "list",
  "data": [
    {"id": "hermes-agent", "object": "model"}
  ]
}
```

> The `model` field in requests is passed directly to the agent. You can use any model identifier your provider supports (e.g. `deepseek-v4-flash`, `deepseek-reasoner`). Setting it to a model the provider doesn't know will fail at inference time.

---

## Chat Completions

### `POST /v1/chat/completions`

OpenAI Chat Completions-compatible endpoint. Streams tool progress and text deltas.

#### Request

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {"role": "system", "content": "You are Fi."},
    {"role": "user", "content": "Check disk usage"}
  ],
  "stream": true,
  "max_tokens": 1000
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | gateway default | Model identifier |
| `messages` | array | required | OpenAI message array |
| `stream` | bool | `false` | SSE streaming |
| `max_tokens` | int | — | Max tokens in response |
| `temperature` | float | — | Sampling temperature |

#### Response (non-streaming)

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1779511216,
  "model": "deepseek-v4-flash",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "The disk is 48% full."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 18062,
    "completion_tokens": 44,
    "total_tokens": 18106
  }
}
```

#### Response (streaming — SSE)

When `stream: true`, the response is a Server-Sent Events stream with the following event types:

**Tool progress events:**

```
data: {"event": "tool.started",   "tool": "terminal", "preview": "df -h"}

data: {"event": "tool.completed", "tool": "terminal", "duration": 0.109}
```

| Field | Description |
|-------|-------------|
| `event` | `"tool.started"` or `"tool.completed"` |
| `tool` | Tool name: `terminal`, `read_file`, `write_file`, `web_search`, etc. |
| `preview` | What the tool is doing (only on `.started`) |
| `duration` | Seconds the tool took (only on `.completed`) |
| `error` | Boolean, `true` if the tool failed (only on `.completed`) |

**Text streaming events:**

```
data: {"event": "message.delta", "delta": "The disk is"}
data: {"event": "message.delta", "delta": " 48% full."}
```

Each `delta` is a chunk of the assistant's response text. Concatenate them in order.

**End of stream:**

The SSE stream ends when the agent finishes. Detect completion by the stream closing (the `data: [DONE]` convention is also supported).

---

## Runs (Stateful)

The Runs API gives you structured, real-time visibility into what the agent is doing — including tool calls, progress, and streaming text.

### `POST /v1/runs`

Start a run. Returns immediately with a `run_id`.

#### Request

```json
{
  "input": "Check disk usage and summarize",
  "model": "deepseek-v4-flash",
  "max_tokens": 1000
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input` | string | required | The user message |
| `model` | string | gateway default | Model identifier |
| `max_tokens` | int | — | Max response tokens |
| `instructions` | string | — | System instructions (overrides default) |

#### Response

```json
{
  "run_id": "run_96686e38a4824b4ca7da87dc577257ad",
  "status": "started"
}
```

---

### `GET /v1/runs/{run_id}`

Get the current status of a run.

```json
{
  "run_id": "run_96686e38a4824b4ca7da87dc577257ad",
  "status": "running",
  "model": "deepseek-v4-flash"
}
```

Status values: `queued` → `running` → `completed` | `failed`

---

### `GET /v1/runs/{run_id}/events` (SSE)

The core endpoint for building a real-time UI. Opens a Server-Sent Events stream that emits structured events as the agent works.

#### Event Types

**Lifecycle:**

```
data: {"event": "run.created",  "run_id": "run_xxx"}
data: {"event": "run.started",  "run_id": "run_xxx"}
data: {"event": "run.completed", "run_id": "run_xxx", "response": "..."}
data: {"event": "run.failed",    "run_id": "run_xxx", "error": "..."}
```

**Tool progress (render these in your UI as an activity feed):**

```
data: {"event": "tool.started",   "tool": "terminal",    "preview": "df -h"}
data: {"event": "tool.started",   "tool": "read_file",   "preview": "/etc/config.yaml"}
data: {"event": "tool.started",   "tool": "write_file",  "preview": "output.txt"}
data: {"event": "tool.started",   "tool": "web_search",  "preview": "latest news"}
data: {"event": "tool.started",   "tool": "terminal",    "preview": "docker ps"}
data: {"event": "tool.completed", "tool": "terminal",    "duration": 0.1,  "error": false}
data: {"event": "tool.completed", "tool": "read_file",   "duration": 0.02, "error": false}
```

| Field | Description |
|-------|-------------|
| `event` | Event type |
| `tool` | Tool name: `terminal`, `read_file`, `write_file`, `web_search`, `search_files`, `patch`, etc. |
| `preview` | One-line summary of what the tool is doing |
| `duration` | Execution time in seconds |
| `error` | `true` if the call failed |

**Text deltas (the assistant's response, streamed token by token):**

```
data: {"event": "message.delta", "delta": "The "}
data: {"event": "message.delta", "delta": "filesystem"}
data: {"event": "message.delta", "delta": " is "}
data: {"event": "message.delta", "delta": "48% full."}
```

Concatenate all `delta` values to reconstruct the full response.

**Complete SSE flow for a typical request:**

```
event: run.created
event: run.started
event: tool.started     tool=terminal     preview="df -h"
event: tool.completed   tool=terminal     duration=0.1
event: tool.started     tool=terminal     preview="docker ps"
event: tool.completed   tool=terminal     duration=0.3
event: message.delta    delta="The "
event: message.delta    delta="disk "
event: message.delta    delta="is "
event: message.delta    delta="48% full."
event: run.completed    response="The disk is 48% full."
```

---

### `POST /v1/runs/{run_id}/stop`

Interrupt a running agent mid-execution. Returns `202 Accepted`.

```json
{"status": "stopping"}
```

---

## Frontend Integration Guide

### Building a terminal-chat UI

The most natural way to render Fi's responses is:

**1. Start a run:**

```javascript
const res = await fetch('https://fi.gisketch.com/v1/runs', {
  method: 'POST',
  headers: {'Authorization': 'Bearer fi-gisketch-dashboard', 'Content-Type': 'application/json'},
  body: JSON.stringify({input: "Check disk usage"})
});
const { run_id } = await res.json();
```

**2. Connect to the event stream:**

```javascript
const events = new EventSource(`https://fi.gisketch.com/v1/runs/${run_id}/events`, {
  headers: {'Authorization': 'Bearer fi-gisketch-dashboard'}
});

events.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);

  if (data.event === 'tool.started') {
    // Show: "┊ ⚡ Running: df -h"
    addActivityLine(`┊ ⚡ ${data.preview}`);
  }

  if (data.event === 'tool.completed') {
    // Show: "┊ ✓ Done (0.1s)"
    addActivityLine(`┊ ✓ Done (${data.duration}s)`);
  }

  if (data.event === 'message.delta') {
    // Append text to response
    responseText += data.delta;
    renderResponse(responseText);
  }

  if (data.event === 'run.completed') {
    // Mark complete
    setComplete();
  }
});
```

**3. Or use chat completions with SSE** (simpler, OpenAI-compatible):

```javascript
const res = await fetch('https://fi.gisketch.com/v1/chat/completions', {
  method: 'POST',
  headers: {'Authorization': 'Bearer fi-gisketch-dashboard', 'Content-Type': 'application/json'},
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: [{role: 'user', content: 'Check disk usage'}],
    stream: true
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  for (const line of chunk.split('\n')) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));

      if (data.event === 'tool.started') {
        addActivityLine(`┊ ⚡ ${data.preview}`);
      } else if (data.event === 'message.delta') {
        responseText += data.delta;
        renderResponse(responseText);
      }
    }
  }
}
```

### Usage data

Current DeepSeek balance and Codex usage:

```
GET http://167.254.240.228:8088/usage.json
```

```json
{
  "ts": "2026-05-23T04:01:58Z",
  "deepseek": {"total": 1.57, "currency": "USD"},
  "codex": {
    "plan": "prolite",
    "5hour": {"used_percent": 5},
    "weekly": {"used_percent": 50}
  }
}
```

### Tool Emoji Reference

```
terminal   → ⚡  (command execution)
read_file  → 📖  (reading files)
write_file → ✏️  (writing files)
patch      → 🔧  (editing files)
search_files → 🔍  (searching files or content)
web_search → 🌐  (web search)
browser_*  → 🖥️  (browser automation)
memory     → 🧠  (memory operations)
cronjob    → ⏰  (scheduled tasks)
delegate_task → 🧩  (subagent tasks)
clarify    → ❓  (asking for clarification)
```

---

## Rate Limits

No rate limits currently configured. The endpoint is for personal use.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-23 | Model switching via `model` field in requests |
| 2026-05-23 | Runs API with SSE tool progress events |
| 2026-05-23 | API exposed at `fi.gisketch.com` |

