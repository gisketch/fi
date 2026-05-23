# Fi UI PWA Stabilization

## Goal

Turn the current Hermes iOS PWA prototype into the first useful, shippable Fi UI client while preserving the Sonata harness docs and current touch-first design direction.

## Acceptance Criteria

- User can send prompts to the Hermes gateway and see streamed assistant responses.
- User can see tool activity blocks, expand/collapse them, and understand running/completed/failed state.
- User can interrupt an active run.
- User can view DeepSeek balance and Codex quota status from the intended production path.
- iOS standalone behavior stays locked: safe areas, no viewport zoom, no unwanted body scroll, usable native prompt input.
- Secrets and endpoint config are documented and not hard-coded as production-only assumptions.
- `bun run build` passes.
- `./scripts/check-sonata.sh` passes.

## Context Links

- [Project brief](../../project-brief.md)
- [Architecture](../../architecture/index.md)
- [Quality](../../quality.md)
- [Source README](../../../src/README.md)
- [API reference pointer](../../../API-REF.md)
- [Vite config](../../../vite.config.ts)
- [Hermes API service](../../../src/services/api.ts)
- [Hermes hook](../../../src/hooks/useHermes.ts)
- [App shell](../../../src/App.tsx)

## Current Codebase Snapshot

- Stack: Vite SPA with React 18, TypeScript, TailwindCSS v4, Framer Motion, vite-plugin-pwa.
- Entry: `src/main.tsx` mounts `src/App.tsx`.
- API layer: `src/services/api.ts` starts/stops runs, consumes SSE with `fetch`, and fetches usage JSON.
- State layer: `src/hooks/useHermes.ts` owns chat messages, current run, stream lifecycle, run interruption, and error state.
- UI shell: `src/App.tsx` renders the Fi header, message timeline, collapsible VPS execution rows, running tool chip, error panel, native textarea prompt composer, and compact usage pill.
- Extra components: `SettingsModal` and `UsageWidget` exist, but the current `App.tsx` does not render them.
- PWA config: `vite.config.ts` enables auto-updating service worker, standalone portrait manifest, favicon assets, and dev proxies for `/api` and `/usage-api`.
- iOS viewport: `index.html`, `src/index.css`, and `App.tsx` lock scaling, safe areas, fixed body, visual viewport height, and scroll reset.
- Tests: `tests/README.md` is placeholder only. No test runner is configured.

## Known Gaps / Risks

- `SettingsModal` is disconnected, so model selection is currently hard-coded to `deepseek-v4-flash`.
- `UsageWidget` is disconnected; the collapsed composer only shows balance when `App.tsx` silently fetches usage.
- `API_URL` and `API_TOKEN` have client-side fallback values. Decide whether this is acceptable for a PWA or move auth behind a safer gateway pattern.
- Usage fetch uses `/usage-api/usage.json`; dev proxy exists, but production routing/CORS behavior needs verification.
- Tool completion maps every running tool with the same name, not just the latest matching activity. Repeated same-name tools may update incorrectly.
- SSE parsing ignores non-`data:` event fields and malformed final chunks. Good enough for current contract, but needs fixture tests.
- Serena project config lists only `bash`, so TypeScript symbol navigation is currently unavailable.

## Steps

1. Wire missing product surfaces
   - Decide whether settings/model picker belongs in current minimalist shell.
   - Render or remove `SettingsModal` and `UsageWidget` to avoid dead component drift.
   - Keep visual language aligned with the current black/glass/serif Fi shell.

2. Harden gateway config
   - Document required `.env` keys.
   - Remove unsafe fallbacks if production should require env configuration.
   - Verify production usage endpoint path and CORS behavior.

3. Stabilize stream and tool lifecycle
   - Add fixtures or tests for run creation, message deltas, tool start/complete, run failure, and stop.
   - Fix repeated same-name tool completion if real Hermes can emit parallel/repeated tools.

4. Validate iOS PWA behavior
   - Smoke test standalone viewport, native input, safe area, no zoom, no body scroll, and prompt send/stop controls.
   - Verify generated manifest and service worker assets.

5. Update docs
   - Refresh `docs/architecture/index.md` if components are connected or removed.
   - Add real build/test commands to `docs/quality.md` once test tooling exists.
   - Move this plan to `completed/` only after validation passes.

## Validation

Current verified checks on 2026-05-23:

```bash
./scripts/check-sonata.sh
bun run build
```

Result: both passed.

Required before completion:

```bash
./scripts/check-sonata.sh
bun run build
```

Recommended later checks:

```bash
bun run lint
```

Note: `bun run lint` is declared, but ESLint dependencies/config have not been verified in this pass.

## Decision Log

- 2026-05-23: Keep execution plan broad enough to cover stabilization, not new feature expansion.
- 2026-05-23: Keep the prompt path native to iOS Safari for typing speed and reliability.

## Progress Log

- 2026-05-23: Read docs index, project brief, architecture, quality rules, exec plan rules, package scripts, Vite config, app entry, API service, Hermes hook, main app shell, settings, usage widget, styles, config/test placeholders.
- 2026-05-23: Verified `bun run build` passes against current working tree.
- 2026-05-23: Created this active execution plan from current codebase state.
- 2026-05-23: Verified `./scripts/check-sonata.sh` and `bun run build` pass after creating the plan.
- 2026-05-23: Cleaned compact prompt pill to show only DeepSeek balance and weekly Codex limit with icons.
- 2026-05-23: Restored native textarea input behavior.
- 2026-05-23: Updated textarea to wrap/autosize with native Return inserting new lines, and subtly increased UI font sizes.
- 2026-05-23: Guarded usage rendering against missing Codex weekly fields to prevent app crashes from partial usage payloads.
- 2026-05-23: Revamped chat rendering: user messages are right-aligned and non-italic; assistant tool history is replaced with one inline latest tool status using a Solar icon and action label.
- 2026-05-23: Simplified tool status to vague pulsing labels with no preview/details, summarizes after five tool calls, and added lightweight Markdown rendering for bold, italic, inline code, and code blocks without changing base font sizes.
- 2026-05-23: Replaced inline Markdown renderer with `src/components/MarkdownMessage.tsx`, adding cleaner wrapping, smaller code blocks, headings, lists, quotes, links, strikethrough, and table rendering.
- 2026-05-23: Changed code blocks and tables to compact “See code block” / “See table” cards so chat width stays stable; tapping opens a styled preview dialog with scrollable full content.
- 2026-05-23: Restyled tool status lines to match assistant serif/italic typography and use completed labels instead of active-sounding text after a tool finishes.
- 2026-05-23: Added platform-aware composer keys: desktop Enter sends, Shift+Enter/newline and mobile Enter keep native newlines; added extra bottom padding to pill/prompt area.
- 2026-05-23: Added blur/fade chat entrances, per-character blur/fade text reveal, agentic active tool labels with staggered per-character pulse glow, and pressable tool status lines that open a full work-trace dialog with all tool calls, previews, durations, and statuses.
- 2026-05-23: Read updated Fi API reference from `http://167.254.240.228:8088/api.md`; implemented Threads API usage, run/session listing, SSE `seq`/`since` reconnect support, hamburger Sessions menu, thread loading, run connect/reconnect, and chronological assistant text/tool segments for audit-friendly inline tool history.
- 2026-05-23: Fixed tool status whitespace, changed labels back to concrete readable actions (`Reading file…`, `Searching files…`, `Writing file…`), and added an immediate pending tool line while waiting for first streamed tool event.
- 2026-05-23: Added viewport virtualization for older completed chat messages via `VirtualMessage`, preserving measured height while unmounting offscreen message bodies and keeping recent/running messages always rendered.
- 2026-05-23: Fixed composer typing lag caused by App-level input state rerendering expensive chat trees by memoizing message, markdown, animated text, and tool-line renderers.
- 2026-05-23: Removed extra mobile bottom padding for the prompt/pill while preserving larger desktop safe-area spacing.
- 2026-05-23: Replaced favicon/PWA icon with a black square Fi wordmark using Fraunces/serif typography and renamed manifest/app title to Fi.
- 2026-05-23: Researched PWA notifications; added Notifications menu with support detection, permission request, service-worker-ready local notification test, HTTPS/service-worker checks, and iOS installed-PWA guidance.
