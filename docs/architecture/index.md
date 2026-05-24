# Architecture

## Current Shape

- Kind: pwa for ios
- Stack: vite spa (React, TypeScript, TailwindCSS v4, Framer Motion)
- Runtime target: iOS standalone PWA talking to Hermes Web API.

## Default Layer Direction

```text
types -> config -> services -> reducers -> hooks -> interface
```

Cross-cutting concerns enter through explicit provider interfaces.

## Application Skeleton

- [src](../../src): Application Source Code.
  - [types/hermes.ts](../../src/types/hermes.ts): Hermes Web API JSON-RPC, session, usage, event, and payload contracts with unknown-field preservation.
  - [config/hermes.ts](../../src/config/hermes.ts): Hermes base URL, WebSocket URL, regular token, admin mode, and usage URL env contract.
  - [services/hermesTransport.ts](../../src/services/hermesTransport.ts): WebSocket JSON-RPC transport, request tracking, event subscriptions, and reconnect backoff.
  - [services/hermesGateway.ts](../../src/services/hermesGateway.ts): Typed static RPC facade for sessions, prompts, commands, config, tools, skills, voice, delegation, browser, shell/CLI, reload, rollback, agents, cron, insights, model, plugins, paste, and blocking responses.
  - [services/hermesRest.ts](../../src/services/hermesRest.ts): REST convenience client and SSE event stream fallback.
  - [services/terminalGateway.ts](../../src/services/terminalGateway.ts): Browser client for the separate terminal gateway, including whole-app PIN unlock, token verification, local SSH profile storage, and terminal WebSocket URL construction.
  - [services/pwaUpdates.ts](../../src/services/pwaUpdates.ts): Service worker update registration, manual update checks, and update activation for the installed PWA.
  - [services/api.ts](../../src/services/api.ts): Deprecated legacy Fi Gateway run/thread service kept only for usage JSON and temporary compatibility until cleanup.
  - [state/hermesEventReducer.ts](../../src/state/hermesEventReducer.ts): Pure event reducer for sessions, chat messages, tool lifecycle, thinking/reasoning, blocking prompts, voice, browser progress, and errors.
  - [hooks/useHermes.ts](../../src/hooks/useHermes.ts): Compatibility facade consumed by the app; maps old thread/run names onto Hermes sessions while exposing connection, blocking prompt, and session actions.
  - [components/dialogs](../../src/components/dialogs): Focused Hermes sheets for sessions, control center, blocking prompts, and the lazy-loaded xterm terminal.
  - [components/MarkdownMessage.tsx](../../src/components/MarkdownMessage.tsx): Compact chat Markdown renderer with expandable heavy blocks; supports reduced-motion plain text rendering for long-session phone performance.
  - [components/VirtualMessage.tsx](../../src/components/VirtualMessage.tsx): Viewport virtualization for older chat messages.
  - [components/UsageWidget.tsx](../../src/components/UsageWidget.tsx): Legacy usage status component; current app also fetches usage directly for the compact composer pill.
  - [components/SettingsModal.tsx](../../src/components/SettingsModal.tsx): Legacy settings/model sheet not currently mounted by `App.tsx`.
  - [App.tsx](../../src/App.tsx): Whole-app PIN gate plus primary Fi iOS PWA shell, chat timeline, compact composer, menu, sessions dialog, control center, terminal entry point, PWA update prompt, appearance settings, notifications, blocking prompts, and usage pill.
  - [index.css](../../src/index.css): Design systems & tailwind v4 styles, including Less Animation and Terminal appearance modes.
- [tests](../../tests): Fixture directory for Hermes reducer/event smoke checks.
- [config](../../config): Environment contract and security notes.
- [scripts/check-hermes-events.ts](../../scripts/check-hermes-events.ts): Bun smoke checks for reducer/event fixtures.

## Boundary Rules

- **Browser-visible regular token**: `VITE_HERMES_WEB_TOKEN` is available to browser JavaScript. Keep the PWA private, never commit token values, and prefer HTTPS final cutover.
- **No browser admin token**: Admin writes use a private proxy path. Browser code must not contain `HERMES_WEB_ADMIN_TOKEN`.
- **Whole-app PIN gate**: Fi uses `POST /auth/unlock` and `GET /auth/verify` on the terminal gateway as the app lock. The gateway token is stored locally; the PIN is not.
- **PWA updates**: The service worker uses prompt mode. New builds show an in-app update chip and can also be checked from the menu.
- **Transport priority**: WebSocket JSON-RPC is primary because it covers the full Hermes Web API. REST is convenience/fallback. SSE is passive event fallback.
- **Session model**: New behavior is session-oriented. Old run/thread names may remain only as compatibility aliases while UI migration finishes.
- **Terminal gateway separation**: In-app terminal uses a separate private WebSSH gateway configured by `VITE_TERMINAL_GATEWAY_URL`; it does not reuse Hermes `/api/ws`.
- **Forward compatibility**: External API payloads preserve unknown fields instead of dropping data.
- **Responsive Shell**: Interface viewport limits are strictly locked on iPhone ratios to prevent standalone app bounce.
