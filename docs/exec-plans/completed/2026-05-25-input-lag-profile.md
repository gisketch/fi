# Input Lag Profile

## Goal

Find and fix prompt typing lag when the chat has several turns and many collapsed tool calls.

## Acceptance Criteria

- Reproduce or approximate the lag with a seeded heavy transcript.
- Identify the render or state bottleneck causing composer input delay.
- Keep prompt typing responsive with older messages and tool calls present.
- Production build passes.

## Context Links

- [docs/project-brief.md](../../project-brief.md)
- [docs/architecture/index.md](../../architecture/index.md)
- [docs/quality.md](../../quality.md)
- [src/App.tsx](../../../src/App.tsx)
- [src/components/VirtualMessage.tsx](../../../src/components/VirtualMessage.tsx)
- [src/components/MarkdownMessage.tsx](../../../src/components/MarkdownMessage.tsx)

## Steps

- [x] Map chat render path and composer state.
- [x] Run local app and profile a real resumed session.
- [x] Profile typing latency and render churn.
- [x] Patch focused bottleneck.
- [x] Validate with build and browser smoke.

## Validation

- `bun run build` failed under local default Node 16 with `crypto.getRandomValues` unavailable in Vite.
- `unset NPM_CONFIG_PREFIX && source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && bun run build` passed.
- `./scripts/check-sonata.sh` passed.
- Local browser smoke with `playwright-cli` passed.

## Decision Log

- Root cause: completed chat text rendered one `motion.span` per character. A small resumed session with 1,589 visible text chars produced 1,397 timeline nodes, 1,289 spans, and 1,301 styled nodes. Composer input measured p50 24.8 ms, p95 27.5 ms.
- Fix: render completed text as normal text while keeping message-level motion; memoize parsed Markdown blocks; stop virtualized messages from remeasuring on every composer render by using a stable `measureKey`.
- After fix: same session produced 121 timeline nodes, 13 spans, and 25 styled nodes. Composer input measured p50 8.3 ms, p95 9.2 ms.

## Progress Log

- 2026-05-25: Started investigation.
- 2026-05-25: Patched message text rendering and virtualized measurement churn.
