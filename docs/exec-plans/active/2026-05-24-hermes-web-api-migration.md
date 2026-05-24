# Hermes Web API Migration

## Goal

Migrate Fi UI from the deprecated Fi Gateway run/thread API to the new Hermes Web API while preserving the current black/glass/serif iOS PWA aesthetic and making the full Hermes TUI gateway feature set reachable from the app.

## Owner Decisions And Deployment Context

Resolved owner inputs for implementation + integration testing:

1. **Hermes Web API base URLs**
   - Current API URL: `https://fi.gisketch.com`.
   - The API has no root route; `https://fi.gisketch.com/` returning 404 is expected.
   - API must serve `GET /health`, `WS /api/ws`, `GET /v1/events`, and `REST /v1/*`.

2. **Regular client token**
   - Regular `HERMES_WEB_TOKEN` exists in the server-side `hermes-web-pwa/.env`.
   - The token value is intentionally **not recorded in this repo or plan**.
   - For browser calls, provide the regular token through local/deploy env or a proxy path; never commit it.
   - Because the token was shared in chat, rotate it before final production cutover if this app is exposed beyond the owner’s private devices.

3. **Admin capability decision**
   - Decision: use the recommended private admin proxy.
   - Browser/PWA must never ship `HERMES_WEB_ADMIN_TOKEN`.
   - Admin-only features (`POST /v1/config`, `model.save_key`, provider disconnect/key writes, and any future admin write) route through a small private server/proxy.
   - Until proxy exists, admin-only UI can be present but disabled with a clear “admin proxy required” note.

4. **CORS origin**
   - Current server setting during migration: `HERMES_WEB_CORS_ORIGINS=*`.
   - Acceptable for testing/private deployment.
   - Before public production, tighten to the final Fi UI origin(s), including `https://fi.gisketch.com` if the UI and API share that domain/path setup.

5. **Dangerous feature policy**
   - Owner approved exposing dangerous/full-control features.
   - Add warning/confirmation dialogs for risky actions: `shell.exec`, `cli.exec`, `process.stop`, `rollback.restore`, `reload.env`, `reload.mcp`, `sudo.respond`, `secret.respond`, `model.save_key`, browser automation, cron mutations, and background task controls.
   - Prefer typed confirmation for irreversible or host-level actions.

6. **Usage widget policy**
   - Keep legacy DeepSeek/Codex usage source working.
   - Continue using `/usage-api/usage.json` or a configurable `VITE_USAGE_URL` for the existing compact usage pill.
   - New Hermes `session.usage` and `insights.get` can be added as extra session/status detail, not as a replacement yet.

7. **File/image attach policy**
   - Defer browser file/image attachment for now.
   - Keep `image.attach` documented as server-path-only.
   - Add browser upload support later only if a backend upload route is introduced.

Already available:

- GitHub access is working. Repo cloned into `refs/hermes-web-pwa`.
- API docs read from `refs/hermes-web-pwa/API.md` and `refs/hermes-web-pwa/AUTH.md`.

## Non-Negotiables

- Keep current Fi aesthetic: black void shell, glass cards, serif/italic assistant voice, compact bottom composer, iOS safe-area behavior, blur/fade motion, minimalist menu.
- Do not rewrite into a generic admin dashboard.
- Full feature access must be layered into the existing design through sheets, command palette, inline prompts, and compact detail dialogs.
- Keep secrets out of git.
- Prefer WebSocket JSON-RPC as the primary transport because it exposes the full API. Use REST for convenience/fallback only.
- Preserve unknown API fields in types and state for forward compatibility.

## Acceptance Criteria

Functional:

- App connects to Hermes Web API via configured base URL + bearer token.
- App can create, resume, branch, close, delete, title, save, compress, and inspect sessions.
- App can attach to old/persisted sessions from `session.list` using `session.resume`.
- App can send prompts and stream `message.*`, `thinking.*`, `status.update`, and `tool.*` events live.
- App can interrupt, steer, undo, background prompt, resize terminal cols, and run slash/command dispatch flows.
- App exposes models, config, skills, toolsets/tools, commands, completions, voice, approvals, clarify, sudo, secrets, rollback, browser, delegation/subagents, spawn trees, agents, cron, insights, plugins, shell/CLI/process/reload/setup/paste features.
- App handles blocking prompts in UI: approval, clarify, sudo, secret.
- App handles reconnect/resume after refresh/network drop without losing current session context.
- App keeps old design system and interaction feel.

Quality:

- `bun run build` passes.
- `./scripts/check-sonata.sh` passes.
- New service/hook code has fixture-backed tests or deterministic smoke scripts for event mapping and RPC envelopes.
- Docs updated for env vars, security/admin-token decision, and new architecture.

## Context Links

Project:

- [Project brief](../../project-brief.md)
- [Architecture](../../architecture/index.md)
- [Quality](../../quality.md)
- [Legacy usage/API compatibility service](../../../src/services/api.ts)
- [Current Hermes hook](../../../src/hooks/useHermes.ts)
- [Current app shell](../../../src/App.tsx)
- [Current stabilization plan](./2026-05-23-fi-ui-pwa-stabilization.md)

New API reference:

- [Hermes Web README](../../../refs/hermes-web-pwa/README.md)
- [Hermes Web AUTH](../../../refs/hermes-web-pwa/AUTH.md)
- [Hermes Web API](../../../refs/hermes-web-pwa/API.md)
- [Reference TS client](../../../refs/hermes-web-pwa/client/src/client.ts)
- [Reference TS types](../../../refs/hermes-web-pwa/client/src/types.ts)
- [Reference events](../../../refs/hermes-web-pwa/client/src/events.ts)
- [Reference REST routes](../../../refs/hermes-web-pwa/server/rest_routes.py)
- [Reference WS handler](../../../refs/hermes-web-pwa/server/ws_handler.py)
- [Reference SSE handler](../../../refs/hermes-web-pwa/server/sse_handler.py)

## Current Code Snapshot

- Implemented Hermes Web API foundation now exists:
  - `src/config/hermes.ts` reads `VITE_HERMES_API_URL`, `VITE_HERMES_WEB_TOKEN`, `VITE_HERMES_ADMIN_MODE`, `VITE_USAGE_URL`, and legacy aliases.
  - `src/types/hermes.ts` defines sessions, messages, usage, JSON-RPC, gateway events, and common payloads with unknown-field preservation.
  - `src/services/hermesTransport.ts` opens `/api/ws` via derived WS URL, uses query-token auth, parses newline-delimited JSON-RPC frames, tracks pending requests, emits events, and reconnects with backoff.
  - `src/services/hermesRest.ts` covers health, sessions, common REST actions, blocking response endpoints, config/model/tool/skill lists, terminal resize, slash exec, and SSE fallback parsing.
  - `src/services/hermesGateway.ts` exposes RPC wrappers for the documented Hermes Web API breadth.
  - `src/state/hermesEventReducer.ts` maps gateway/session/message/thinking/tool/blocking/voice/browser/background/error events into app state.
  - `src/hooks/useHermes.ts` is a compatibility facade that auto-connects, resumes stored sessions, sends prompts with `session.create` + `prompt.submit`, interrupts with `session.interrupt`, and keeps old UI-facing names.
  - `src/components/dialogs/` contains sessions, control center, and blocking prompt dialogs mounted by `App.tsx`.
  - `scripts/check-hermes-events.ts` smoke-tests event reducer behavior with fixtures.
- `src/App.tsx` has been partially migrated:
  - imports `HermesGateway` for sessions, branching, title, and delete actions.
  - shows WebSocket connection status.
  - mounts `SessionsDialog`, `ControlCenterDialog`, and `BlockingPromptsDialog`.
  - still imports `getUsageData`/`UsageData` from deprecated `src/services/api.ts` for the legacy usage pill.
- `src/services/api.ts` still targets old Fi Gateway endpoints:
  - `/v1/runs`
  - `/v1/runs/{id}`
  - `/v1/runs/{id}/events`
  - `/v1/runs/{id}/stop`
  - `/v1/threads`
  - `/v1/threads/{id}`
  - `/usage-api/usage.json`
- `src/hooks/useHermes.ts` still exposes old UI-facing concepts as compatibility aliases:
  - return names such as `currentThreadId`, `currentThreadTitle`, `loadThread`, `connectRun`, and `reconnectRun` remain as compatibility aliases.
  - `ChatMessage` still has optional `runId`/`threadId` fields for UI compatibility, but active state uses `activeSessionId`.
- `src/App.tsx` still has desirable UX primitives:
  - current Fi header and menu
  - sessions dialog shell
  - tool trace dialog
  - streaming message timeline
  - virtualized old messages
  - compact bottom prompt pill
  - error panel
  - notification sheet
- Existing UI should stay. API/service/hook layer changes underneath, then new feature sheets mount into menu.

## New API Shape

Primary transports:

- **WebSocket**: `/api/ws` newline-delimited JSON-RPC 2.0. Full feature coverage.
- **REST**: `/v1/*` thin wrappers for common calls.
- **SSE**: `/v1/events` broadcasts gateway events. Useful fallback or passive stream.

Auth:

- Regular token: `Authorization: Bearer <token>` or `?token=` for WS.
- Admin token: required for `POST /v1/config` when auth enabled.
- Regular token may be used by the private PWA client during migration, but must stay out of git.
- Admin token must stay server-only; admin writes go through the planned private admin proxy.

Important event normalization differences:

- Old event payloads were direct objects: `{ event: 'message.delta', delta: '...' }`.
- New events arrive as JSON-RPC notifications:
  - `{ jsonrpc:'2.0', method:'event', params:{ type, session_id, payload } }`
- New message delta field is `payload.text`, not `delta`.
- Tool events use `tool.start`, `tool.progress`, `tool.complete`, `tool.generating`.
- Completion uses `message.complete`, not `run.completed`.

## API Feature Coverage Checklist

Each row must end as either **UI**, **hook/service**, **command palette**, or **documented unavailable due API limitation**.

### REST convenience endpoints

| API | Target app surface |
| --- | --- |
| `GET /health` | connection health in settings/control sheet |
| `GET /v1/sessions` | sessions sheet list |
| `POST /v1/sessions` | new chat/session |
| `GET /v1/sessions/{id}` | session inspect/history refresh |
| `DELETE /v1/sessions/{id}` | close active or delete persisted session |
| `POST /v1/sessions/{id}/messages` | prompt submit fallback |
| `POST /v1/sessions/{id}/interrupt` | stop button |
| `POST /v1/sessions/{id}/steer` | steer overlay while busy |
| `POST /v1/sessions/{id}/undo` | undo last turn action |
| `POST /v1/clarify` | clarify response dialog |
| `POST /v1/approval` | approval dialog |
| `POST /v1/sudo` | sudo password dialog |
| `POST /v1/secret` | secret input dialog |
| `GET /v1/commands` | command palette data |
| `GET /v1/models` | model picker |
| `GET /v1/skills` | skills sheet |
| `GET /v1/toolsets` | toolsets sheet |
| `GET /v1/config?key=full` | settings/control center |
| `POST /v1/config` | admin-gated config writes |
| `GET /v1/events` | SSE fallback event stream |
| `POST /v1/slash` | slash command executor |
| `POST /v1/terminal/resize` | visual viewport/terminal width sync |
| `POST /v1/voice/start` | voice record button |
| `POST /v1/voice/stop` | voice stop button |

### Full WebSocket RPC methods

Session:

- `session.create`
- `session.list`
- `session.resume`
- `session.delete`
- `session.title`
- `session.usage`
- `session.status`
- `session.history`
- `session.undo`
- `session.compress`
- `session.save`
- `session.close`
- `session.branch`
- `session.interrupt`
- `session.steer`
- `session.most_recent`

Prompt/input:

- `prompt.submit`
- `prompt.background`
- `clipboard.paste`
- `image.attach`
- `input.detect_drop`

Commands/completion:

- `command.dispatch`
- `command.resolve`
- `commands.catalog`
- `slash.exec`
- `complete.path`
- `complete.slash`

Config:

- `config.get`
- `config.set`
- `config.show`

Tools/toolsets:

- `tools.list`
- `tools.show`
- `tools.configure`
- `toolsets.list`

Skills:

- `skills.manage` actions: `list`, `search`, `install`, `browse`, `inspect`
- `skills.reload`

Voice:

- `voice.record`
- `voice.toggle`
- `voice.tts`

Delegation:

- `delegation.status`
- `delegation.pause`
- `subagent.interrupt`

Browser:

- `browser.manage`

Shell/CLI:

- `shell.exec`
- `cli.exec`
- `terminal.resize`

Setup/process/reload:

- `setup.status`
- `process.stop`
- `reload.env`
- `reload.mcp`

Rollback:

- `rollback.diff`
- `rollback.list`
- `rollback.restore`

Spawn tree:

- `spawn_tree.list`
- `spawn_tree.load`
- `spawn_tree.save`

Agents/cron/insights/model/plugins/paste:

- `agents.list`
- `cron.manage` actions: `list`, `add`, `remove`, `pause`, `resume`
- `insights.get`
- `model.options`
- `model.save_key`
- `model.disconnect`
- `plugins.list`
- `paste.collapse`

Approvals/blocking prompts:

- `approval.respond`
- `clarify.respond`
- `sudo.respond`
- `secret.respond`

Events:

- `gateway.ready`
- `session.info`
- `message.start`
- `message.delta`
- `message.complete`
- `status.update`
- `thinking.delta`
- `reasoning.available`
- `tool.start`
- `tool.progress`
- `tool.complete`
- `tool.generating`
- `approval.request`
- `clarify.request`
- `sudo.request`
- `secret.request`
- `voice.status`
- `voice.transcript`
- `skin.changed`
- `browser.progress`
- `background.complete`
- `error`

## Target Architecture

Keep the public app hook shape simple, but replace old run/thread internals.

```text
src/config/hermes.ts
  reads VITE_HERMES_API_URL, VITE_HERMES_WEB_TOKEN, optional admin/proxy flags

src/types/hermes.ts
  JSON-RPC, sessions, events, messages, tools, config, models, skills, generic payload maps

src/services/hermesTransport.ts
  WebSocket lifecycle, request id tracking, reconnect, event subscriptions, timeout handling

src/services/hermesRest.ts
  REST convenience/fallback client, health check, SSE fallback consumer

src/services/hermesGateway.ts
  typed RPC wrappers for every documented method

src/state/hermesEventReducer.ts
  pure event-to-chat/session/resource reducer with fixtures

src/hooks/useHermes.ts
  compatibility facade consumed by App.tsx; exposes current chat + actions

src/hooks/useHermesSessions.ts
  session list/resume/branch/delete/title/save/compress/usage/status/history

src/hooks/useHermesResources.ts
  models/config/skills/tools/commands/plugins/insights/delegation/cron/etc.

src/components/*
  preserve current visual primitives; add feature sheets/dialogs as small focused components
```

Layer direction stays:

```text
types -> config -> services -> reducers -> hooks -> interface
```

## Phase 0 — Preflight Decisions And Safety

1. Confirmed owner inputs.
   - Current API URL: `https://fi.gisketch.com`.
   - Root URL returns 404 by design; validate with `/health`, `/v1/...`, or `/api/ws`.
   - Regular token exists in server `hermes-web-pwa/.env`; do not write token value into repo docs/source.
   - Admin path: private server/proxy, no browser admin token.
   - Dangerous features allowed with warning/confirmation dialogs.
   - Usage widget keeps legacy `/usage-api/usage.json` path/source for now.
   - Browser file/image attach deferred.

2. Verify deployed API manually.
   - `GET /health` without token.
   - `GET /v1/sessions` with regular bearer token.
   - WebSocket `/api/ws?token=` receives `gateway.ready`.
   - CORS allows local dev origin and production origin.

3. Add env contract.
   - `VITE_HERMES_API_URL=https://fi.gisketch.com`.
   - `VITE_HERMES_WEB_TOKEN` for the regular client token when direct browser auth is used; never commit value.
   - `VITE_HERMES_ADMIN_MODE=proxy`.
   - `VITE_HERMES_ADMIN_PROXY_URL` for admin-only writes once proxy exists.
   - `VITE_USAGE_URL=/usage-api/usage.json` or equivalent legacy usage endpoint.

4. Security notes before coding.
   - Document that Vite env values are browser-visible.
   - Keep `.env` ignored.
   - Never commit tokens.
   - Do not record the provided regular token value in docs, code, fixtures, logs, screenshots, or tests.
   - Rotate the regular token before final production cutover if exposure risk matters.
   - Keep `HERMES_WEB_ADMIN_TOKEN` server-only behind private proxy.
   - Risk-gate dangerous methods with confirm dialogs.

## Phase 1 — Typed API Foundation

1. Create `src/types/hermes.ts`. **Done, with room to add more exact payload types as real responses demand.**
   - `JsonRpcRequest`.
   - `JsonRpcResponse<T>`.
   - `JsonRpcError`.
   - `GatewayEvent<T>`.
   - `HermesEventType` union.
   - `StoredSession`.
   - `SessionInfo`.
   - `HermesMessage`.
   - `Usage`.
   - `ToolCallPayload`.
   - `ApprovalRequestPayload`.
   - `ClarifyRequestPayload`.
   - `SudoRequestPayload`.
   - `SecretRequestPayload`.
   - `ModelOptionsPayload`.
   - `SkillsPayload`.
   - `ToolsetsPayload`.
   - `ConfigPayload`.
   - Generic `[key: string]: unknown` on external payloads.

2. Create `src/config/hermes.ts`. **Done.**
   - Read base URL and token.
   - Strip trailing slash.
   - Derive WS URL from HTTP URL.
   - Validate missing URL/token with useful runtime error.
   - Keep dev fallback only if explicitly accepted. Prefer no production fallback.

3. Create `src/services/hermesTransport.ts`. **Done for baseline WS JSON-RPC, pending request tracking, subscriptions, and reconnect.**
   - `connect()` opens WS.
   - Add `?token=` query because browser WS auth headers are not portable.
   - Parse JSON frames.
   - Track pending requests by id.
   - Resolve RPC responses.
   - Reject RPC errors.
   - Emit gateway events to subscribers.
   - Support `disconnect()`.
   - Support reconnect with exponential backoff.
   - Support `request(method, params, timeoutMs)`.
   - Support `onEvent(fn)` unsubscribe.
   - Store latest `gateway.ready`.

4. Create `src/services/hermesRest.ts`. **Done for common REST wrappers and SSE fallback parser.**
   - Generic `request(method, path, body, tokenKind)`.
   - Health check.
   - Convenience wrappers for REST endpoints.
   - SSE stream parser for `/v1/events` fallback.
   - Parse `event:` + `data:` fields.
   - Normalize SSE `data` into `GatewayEvent`.

5. Create `src/services/hermesGateway.ts`. **Done as a static RPC facade for the documented method set.**
   - Thin typed wrappers for all RPC methods listed above.
   - One method per RPC, exact RPC name preserved.
   - Use WS transport primary.
   - Use REST fallback only where equivalent exists.

6. Keep old `src/services/api.ts` temporarily. **Still true; it remains for usage JSON and compatibility cleanup.**
   - Add deprecation comment.
   - Do not delete until app fully moved.

## Phase 2 — Event Reducer And Chat Model

1. Define new internal chat types.
   - Keep existing `ChatMessage`, `ToolActivity`, `ChatSegment` names where possible.
   - Replace `runId` with `sessionId` and optional `turnId`/event sequence if needed.
   - Add `thinking` segment type or keep reasoning in assistant metadata.
   - Add `status` field for assistant turn state.
   - Add `eventLog` optional debug metadata for unknown event payloads.

2. Build `src/state/hermesEventReducer.ts`. **Baseline done with fixture smoke coverage. Continue hardening against live payload variants.**
   - Pure function: `(state, event) => nextState`.
   - `gateway.ready`: store server/config/skin.
   - `session.info`: merge session metadata.
   - `message.start`: create/mark running assistant message.
   - `message.delta`: append `payload.text` to current assistant text segment.
   - `message.complete`: finalize assistant message, usage, reasoning, warning.
   - `status.update`: set current status line.
   - `thinking.delta`: append reasoning/thinking segment.
   - `reasoning.available`: store full reasoning.
   - `tool.start`: add tool segment with running status.
   - `tool.progress`: update matching tool progress/preview.
   - `tool.generating`: show generated args status.
   - `tool.complete`: mark tool complete/failed, result, duration.
   - `approval.request`: add blocking prompt state.
   - `clarify.request`: add blocking prompt state.
   - `sudo.request`: add blocking prompt state.
   - `secret.request`: add blocking prompt state.
   - `voice.status`: update voice state.
   - `voice.transcript`: optionally paste transcript into composer or submit, based on UX decision.
   - `skin.changed`: store skin metadata but do not auto-retheme away from Fi aesthetic unless owner asks.
   - `browser.progress`: add browser progress activity.
   - `background.complete`: add background result notice.
   - `error`: set non-fatal error panel.

3. Message history conversion.
   - Convert `session.history` messages into current UI messages.
   - Preserve `rendered` if present.
   - Preserve unknown `content` shapes for future display.
   - Add fallback text extraction:
     - `message.text`
     - string `message.content`
     - array/object content JSON preview if needed.

4. Tool matching.
   - Prefer tool id if payload has one.
   - Else match latest running tool with same name.
   - Else create orphan completed tool to avoid hiding data.

5. State persistence.
   - Store current active `session_id` in `localStorage`.
   - Store last selected model/config UI choices in `localStorage` only if non-secret.
   - On app load, call `session.most_recent` or resume stored session.

## Phase 3 — Replace Hook Internals

1. Rewrite `src/hooks/useHermes.ts` as compatibility facade. **Baseline done.**
   - Keep return names used by `App.tsx` where possible:
     - `messages`
     - `isRunning`
     - `currentThreadTitle` becomes session title but keep alias to reduce UI churn.
     - `error`
     - `sendMessage`
     - `stopActiveRun`
     - `clearChat`
     - `loadThread` becomes wrapper around `resumeSession` but keep alias until UI refactor.
   - Add new actions:
     - `createSession`
     - `resumeSession`
     - `branchSession`
     - `closeSession`
     - `deleteSession`
     - `renameSession`
     - `saveSession`
     - `compressSession`
     - `undoLastTurn`
     - `steerActiveTurn`
     - `submitBackgroundPrompt`

2. Session lifecycle flow.
   - On first prompt:
     - ensure WS connected.
     - call `session.create` with current columns.
     - set title locally from first prompt.
     - call `prompt.submit`.
   - On subsequent prompt:
     - require active `session_id`.
     - call `prompt.submit`.
   - On page refresh:
     - connect WS.
     - call `session.resume` for stored session id if available.
     - load returned `messages`.

3. Busy behavior.
   - `isRunning` true after `message.start` or `prompt.submit` response.
   - false after `message.complete`, `error`, or interrupt completion.
   - If API status says running on resume, stay running and let events update.

4. Stop behavior.
   - Current stop button calls `session.interrupt`.
   - Mark active assistant as interrupted/failed only after response or event.

5. Clear chat behavior.
   - Decide if Fi logo click creates a new session or just clears local view.
   - Prefer: if current session active, `session.close`; then clear local and create fresh on next prompt.

## Phase 4 — Sessions Sheet Migration

1. Replace old thread/run list calls. **Partially done in `App.tsx` with `HermesGateway.listSessions`, `resumeSession`, delete, branch, and title actions.**
   - Remove `listThreads`, `listRuns`, `connectRun`, `reconnectRun` dependencies from `App.tsx`.
   - Use `session.list` for persisted sessions.
   - Use `session.resume` to attach.
   - Use `session.delete` for persisted delete.
   - Use `session.close` for active close.

2. Preserve current sessions dialog look.
   - Same modal shell.
   - Rename visible text from `Threads and reconnectable runs` to `Hermes sessions`.
   - Keep serif title and compact rows.

3. Row data mapping.
   - `id`: `StoredSession.id`.
   - title: `title || preview || id`.
   - preview: `preview`.
   - time: `started_at`.
   - count: `message_count`.
   - source: `source`.

4. Add row actions via long press / small ellipsis.
   - Resume.
   - Branch.
   - Rename.
   - Save.
   - Compress.
   - Delete.

5. Add active session details.
   - Current model.
   - cwd.
   - profile.
   - usage.
   - running status.

## Phase 5 — Composer And Command Controls

1. Keep bottom composer design.
   - Do not add bulky toolbar by default.
   - Add tiny inline affordances only when expanded.

2. Slash command detection.
   - If input starts with `/`, show command completion sheet using `complete.slash` and `commands.catalog`.
   - Submit slash commands through `command.dispatch` first for live-state commands.
   - Use `slash.exec` for worker-backed slash commands where appropriate.

3. Path/drop detection.
   - Call `input.detect_drop` when pasted/dropped text looks path-like.
   - Show detected path chips in composer.
   - For images, call `image.attach` only for server-accessible paths.

4. Paste collapse.
   - For long paste, call `paste.collapse` before submit.
   - Show compact preview with expand option.

5. Background prompt.
   - Add menu action: `Run in background`.
   - Calls `prompt.background`.
   - Show result via `background.complete` event.

6. Steering.
   - While busy, expanded composer sends `session.steer` instead of blocking if user chooses `Steer`.
   - UI: small segmented choice `Message after done` vs `Steer now` if running.

7. Undo.
   - Add menu action `Undo last turn`.
   - Calls `session.undo`.
   - Refresh `session.history` after success.

## Phase 6 — Blocking Prompts And Approvals

1. Approval dialog. **Baseline blocking prompt dialog exists.**
   - Triggered by `approval.request`.
   - Uses current modal aesthetic.
   - Shows tool, args, message, unknown fields as collapsible JSON.
   - Actions:
     - Allow once: `approval.respond { choice:'allow', all:false }`
     - Deny: `approval.respond { choice:'deny' }`
     - Allow all if API request supports all: `all:true`

2. Clarify dialog. **Baseline blocking prompt dialog exists.**
   - Triggered by `clarify.request`.
   - Shows question and choices if payload contains options.
   - Sends `clarify.respond { request_id, answer }`.

3. Sudo dialog. **Baseline blocking prompt dialog exists.**
   - Triggered by `sudo.request`.
   - Password input.
   - Explicit warning.
   - Sends `sudo.respond { request_id, password }`.
   - Never store password.

4. Secret dialog. **Baseline blocking prompt dialog exists.**
   - Triggered by `secret.request`.
   - Secret input.
   - Sends `secret.respond { request_id, value }`.
   - Never store value.

5. Queue handling. **Baseline queue handling exists in reducer/hook.**
   - Multiple blocking prompts can queue.
   - Show topmost prompt.
   - Keep badge in header/menu.

## Phase 7 — Model, Config, Skills, Tools Control Center

1. Add `ControlCenterDialog` opened from existing hamburger menu. **Baseline dialog exists and is mounted. Continue filling exact controls/action gates.**
   - Keep minimalist black/glass styling.
   - Sections as compact rows, not dashboard cards.

2. Models.
   - Load `model.options { session_id }`.
   - Show providers and models.
   - Selecting a model writes via `config.set { key:'model', value, session_id }` if admin path enabled.
   - If admin disabled, show copyable command alternative, e.g. `/model <model>` via `command.dispatch` if supported.
   - `model.save_key` and `model.disconnect` under provider detail, admin/risky gated.

3. Config.
   - Load `config.get { key:'full' }`.
   - Load `config.show` for readable rows.
   - Expose supported keys:
     - `model`
     - `fast`
     - `busy`
     - `verbose`
     - `yolo`
     - `reasoning`
     - `details_mode`
     - `details_mode.<section>`
     - `thinking_mode`
     - `compact`
     - `statusbar`
     - `mouse`
     - `indicator`
     - `prompt`
     - `personality`
     - `skin`
   - Writes use admin path and confirmation.
   - `skin.changed` should not override Fi design; store/show only.

4. Skills.
   - `skills.manage { action:'list' }` in main skills sheet.
   - Search via `action:'search', query`.
   - Browse via `action:'browse', page, page_size`.
   - Inspect via `action:'inspect', query/name`.
   - Install via `action:'install', query/name` with confirmation.
   - Reload via `skills.reload`.

5. Tools/toolsets.
   - Toolsets summary via `toolsets.list`.
   - Full tools via `tools.list` and `tools.show`.
   - Enable/disable via `tools.configure { action, names, session_id }`.
   - Show missing MCP servers and unknown names.

6. Commands.
   - `commands.catalog` loaded into command palette.
   - `command.resolve` for preview.
   - `command.dispatch` for execution.

7. Plugins.
   - `plugins.list` in control center.

## Phase 8 — Advanced TUI Features

1. Voice.
   - Voice row in menu/control center.
   - `voice.toggle { action:'status' }` on load.
   - `voice.toggle { action:'on'|'off'|'tts' }` controls.
   - `voice.record start/stop` buttons.
   - `voice.tts { text }` from assistant message long-press.
   - Handle `voice.status` and `voice.transcript` events.

2. Browser automation.
   - `browser.manage { action:'status' }` surface.
   - Generic action form for supported browser actions because docs allow flexible action payload.
   - Render `browser.progress` as tool/activity segment.

3. Delegation/subagents.
   - `delegation.status` in status/control center.
   - `delegation.pause { paused }` toggle.
   - Show active subagents if payload includes them.
   - `subagent.interrupt { subagent_id }` from subagent row.

4. Spawn trees.
   - `spawn_tree.list { session_id, limit, cross_session }`.
   - `spawn_tree.load { path }`.
   - `spawn_tree.save { session_id, subagents, started_at, finished_at, label }`.
   - UI: advanced sheet, mostly inspect/save/load.

5. Rollback.
   - `rollback.list` shows checkpoints.
   - `rollback.diff` opens diff preview dialog.
   - `rollback.restore` requires strong confirmation.

6. Cron.
   - `cron.manage { action:'list' }`.
   - Add job form: name, schedule, prompt.
   - Pause/resume/remove actions with confirmation.

7. Agents/processes.
   - `agents.list` shows active background processes/sessions.
   - `process.stop` hidden under dangerous actions with confirmation.

8. Insights/setup/reload.
   - `insights.get` in status sheet.
   - `setup.status` in health/setup sheet.
   - `reload.env` and `reload.mcp` under advanced actions.
   - `reload.mcp` can include `session_id` and `confirm:true`.

9. Shell/CLI.
   - `shell.exec` generic command form, dangerous gated.
   - `cli.exec` session-bound Hermes CLI command form.
   - Results display in compact output dialog.

10. Clipboard/image.
   - `clipboard.paste` button if server clipboard is useful.
   - `image.attach` path input only unless backend upload added.

## Phase 9 — UI Preservation Plan

1. App shell.
   - Keep `App.tsx` root layout and class language.
   - Keep `Fi` wordmark behavior, but clarify whether tap starts new session or clears local view.
   - Keep existing motion style and modal backdrop style.

2. Dialog extraction.
   - Split current inline dialogs into focused components without restyling:
     - `components/dialogs/ToolRunDialog.tsx`
     - `components/dialogs/SessionsDialog.tsx`
     - `components/dialogs/NotificationsDialog.tsx`
     - `components/dialogs/ControlCenterDialog.tsx`
     - `components/dialogs/ApprovalDialog.tsx`
     - `components/dialogs/CommandPalette.tsx`
   - Use same rounded, border, neutral colors.

3. Header menu.
   - Current menu items become:
     - Sessions
     - Controls
     - Commands
     - Voice
     - Notifications
     - Advanced
   - Keep menu narrow; deeper content opens sheets.

4. Tool display.
   - Existing inline tool status rows remain.
   - Tool dialog gets richer payload display but same styling.

5. Composer.
   - Existing compact pill remains default.
   - Expanded composer may add tiny chips for model/session/command mode, but no heavy toolbar.

6. Reasoning/thinking.
   - Show as collapsible italic “Thinking” line inside assistant message.
   - Default collapsed if verbose.

7. Unknown payloads.
   - Show as compact “Details” JSON preview in advanced dialogs only.
   - Do not clutter main chat.

## Phase 10 — Resilience And Transport Behavior

1. WS first.
   - Connect once at app boot.
   - Use all RPC over WS.
   - On disconnect, show subtle sync issue.
   - Reconnect with backoff.

2. Rehydration.
   - After reconnect:
     - call `session.status` for active session.
     - call `session.history`.
     - if persisted session id differs, call `session.resume`.
   - Avoid duplicate messages by replacing history baseline then applying new live events.

3. SSE fallback.
   - If WS cannot connect but REST works, use REST for calls and `/v1/events` for events.
   - Note: WS is still needed for full generic RPC unless REST wrappers cover the method.

4. Request timeouts.
   - Default 30s for normal RPC.
   - Longer for commands that can legitimately run.
   - Surface timeout errors in current error panel.

5. Event dedupe.
   - No documented `seq`; dedupe by local generated event key if payload includes id.
   - Avoid double-appending history after reconnect.

6. Terminal width.
   - Compute columns from viewport/message width.
   - Call `terminal.resize` on session create and visual viewport resize, throttled.

## Phase 11 — Tests And Fixtures

1. Add fixtures under `tests/fixtures/hermes-events/`. **Partially done: gateway-ready, message-stream, tool-lifecycle, approval-request, clarify-request.**
   - `gateway-ready.json`.
   - `message-stream.jsonl`.
   - `tool-lifecycle.jsonl`.
   - `approval-request.json`.
   - `clarify-request.json`.
   - `voice-transcript.json`.
   - `background-complete.json`.
   - `session-history.json`.

2. Add pure reducer tests if test runner is added.
   - Message delta appends text.
   - Tool start/progress/complete updates latest tool.
   - Message complete finalizes status.
   - Clarify/approval/sudo/secret queue blocking prompt.
   - History conversion preserves user/assistant roles.

3. Add a no-runner smoke script if avoiding test dependency. **Done: `scripts/check-hermes-events.ts`.**
   - `scripts/check-hermes-events.ts` or `scripts/check-hermes-events.mjs`.
   - Import reducer, load fixtures, assert JSON snapshots.
   - Wire to `bun`.

4. Build check.
   - `bun run build`.

5. Harness check.
   - `./scripts/check-sonata.sh`.

6. Optional live smoke.
   - `scripts/smoke-hermes-api.mjs`:
     - health.
     - WS connect.
     - session.create.
     - prompt.submit with harmless prompt.
     - interrupt if needed.
     - session.close.
   - Requires env token and should never print token.

## Phase 12 — Docs And Deployment

1. Update `docs/architecture/index.md`. **Done on 2026-05-24 for current Hermes Web API foundation and compatibility leftovers.**
   - Current architecture describes Hermes Web API WS/REST/SSE layers.
   - Full TUI gateway control surfaces are represented through gateway/service/dialog boundaries.

2. Update `docs/project-brief.md` only if product intent changes.
   - Keep intent: iOS PWA personal assistant client for Hermes agent.

3. Update `docs/quality.md`. **Done on 2026-05-24 with `bun scripts/check-hermes-events.ts` and `bun run build`.**
   - Add real build command already in package.
   - Add any new smoke/test command.

4. Add `config/README.md` env example or update existing. **Done on 2026-05-24.**
   - New Vite vars.
   - Security note about browser-visible tokens.
   - CORS production notes.

5. Add `API-REF.md` pointer update. **Done on 2026-05-24.**
   - Link local `refs/hermes-web-pwa/API.md` and upstream GitHub docs.

6. Keep plan active until implementation validated.
   - Move to `docs/exec-plans/completed/` only after acceptance criteria are met.

## Phase 13 — Cutover And Cleanup

1. Remove old API calls.
   - Delete/replace old run/thread service exports after App no longer imports them.
   - Remove old `RunSummary`, `ThreadSummary`, old `HermesEvent` names or move to archived comment if needed.

2. Remove old assumptions.
   - No `deepseek-v4-flash` hard-coded default unless returned by new API/config.
   - No `/v1/runs` or `/v1/threads` references.
   - No `runId` UI labels; use session/turn language.

3. Keep or adapt usage.
   - If old usage retained, isolate into `src/services/usage.ts`.
   - If replaced, use `session.usage` and `insights.get`.

4. Final live verification.
   - New session.
   - Resume old session.
   - Switch model/config path.
   - Skill list/search/install/reload path.
   - Toolset enable/disable path.
   - Approval/clarify prompt path.
   - Interrupt/steer/undo path.
   - Advanced sheets load without crashing.

## Implementation Order Summary

1. Env/config + typed WS transport.
2. Generic RPC wrappers for all API methods.
3. Event reducer with fixtures.
4. Rewrite `useHermes` internals around sessions.
5. Migrate existing chat send/stream/stop path.
6. Migrate sessions sheet to `session.list/resume`.
7. Add blocking prompt dialogs.
8. Add command/model/config/skills/tools control center.
9. Add advanced feature sheets.
10. Add resilience/reconnect/SSE fallback.
11. Update docs and validation scripts.
12. Remove deprecated run/thread code.

## Risk Register

- **Admin token in browser**: high risk. Decision is proxy-only; admin UI stays disabled until proxy exists.
- **Regular token exposure**: Vite/browser env is visible to the client. Keep app private, avoid committing token, and rotate before final public cutover if needed.
- **Full API breadth can bloat UI**: mitigate with command palette + advanced sheets, not always-visible controls.
- **Unknown payload shapes**: use permissive types and preserve unknown fields.
- **WS auth headers in browser**: use query token as documented; prefer final HTTPS URL to avoid token exposure in plaintext/logs.
- **CORS wildcard**: `HERMES_WEB_CORS_ORIGINS=*` is okay for testing/private migration; tighten before public production.
- **CORS mismatch**: must be fixed server-side before PWA can connect.
- **Dangerous actions**: owner allows them, but every host-level/destructive action needs warning or typed confirmation.
- **File upload mismatch**: browser upload is deferred; API path-based attach is not browser upload.
- **Legacy usage dependency**: usage pill still depends on old `/usage-api/usage.json`; keep isolated so it can be swapped later.
- **Skin/config conflicts**: API can change skin, but Fi design should not auto-retheme unless explicitly enabled.

## Validation

Required after plan creation:

```bash
./scripts/check-sonata.sh
```

Required after implementation:

```bash
bun run build
./scripts/check-sonata.sh
```

Recommended after implementation:

```bash
bun run lint
bun scripts/smoke-hermes-api.mjs
```

`bun run lint` may need ESLint config/dependencies verification before becoming mandatory.

## Decision Log

- 2026-05-24: Use WebSocket JSON-RPC as primary client transport because REST wrappers do not cover every RPC method.
- 2026-05-24: Preserve Fi UI aesthetic by adding API power through sheets/dialogs/command palette, not a dashboard redesign.
- 2026-05-24: Treat admin-token browser exposure as an owner decision/blocker for config writes and provider key management.
- 2026-05-24: Owner selected recommended admin path: private proxy only; no browser-shipped admin token.
- 2026-05-24: Cut Hermes API base over to `https://fi.gisketch.com`; root route 404 is expected, validate with `/health`, `/v1/...`, or `/api/ws`.
- 2026-05-24: Keep legacy usage widget source for now.
- 2026-05-24: Defer browser file/image attachment.
- 2026-05-24: Dangerous/full-control features are allowed with warning/confirmation dialogs.
- 2026-05-24: Keep old run/thread API code temporarily during migration, then remove after cutover.
- 2026-05-24: Current implementation has the Hermes WS/RPC foundation, event reducer, sessions/control/blocking dialogs, and reducer smoke script in place; remaining work is cleanup, full UI feature coverage, resilience, and live validation.

## Progress Log

- 2026-05-24: Read project docs, current architecture, quality rules, and execution-plan rules.
- 2026-05-24: Cloned `git@github.com:gisketch/hermes-web-pwa.git` into `refs/hermes-web-pwa`.
- 2026-05-24: Read `README.md`, `AUTH.md`, `API.md`, reference TS client/types/events, and FastAPI REST/WS/SSE/auth code.
- 2026-05-24: Read current `src/services/api.ts`, `src/hooks/useHermes.ts`, `src/App.tsx`, and package scripts.
- 2026-05-24: Created this migration plan.
- 2026-05-24: Validated plan docs with `./scripts/check-sonata.sh` (`sonata ok`).
- 2026-05-24: Added owner deployment context: test API IP URL, final `https://fi.gisketch.com` cutover URL, server-side regular token presence without recording secret value, CORS wildcard during migration, admin proxy decision, dangerous-action confirmations, legacy usage retention, and deferred browser attachments.
- 2026-05-24: Verified the provided token value was not written to the plan and re-ran `./scripts/check-sonata.sh` (`sonata ok`).
- 2026-05-24: Synced Sonata docs with current code: architecture, project brief, quality gates, config env contract, tests README, source README, API reference pointer, and this implementation progress snapshot.
- 2026-05-24: Added composer slash command support backed by Hermes `commands.catalog`, local fuzzy ranking, Space/Tab completion, and `slash.exec` execution.
- 2026-05-24: Added composer `@`/path context completion through Hermes WS `complete.path` with `{ word }`, matching TUI-style context insertion.
