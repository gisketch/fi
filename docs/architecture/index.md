# Architecture

## Current Shape

- Kind: pwa for ios
- Stack: vite spa (React, TypeScript, TailwindCSS v4, Framer Motion)

## Default Layer Direction

```text
types -> config -> data -> service -> hook -> interface
```

Cross-cutting concerns enter through explicit provider interfaces.

## Application Skeleton

- [src](../../src): Application Source Code.
  - [services/api.ts](../../src/services/api.ts): Fi Gateway & SSE consumer services.
  - [hooks/useHermes.ts](../../src/hooks/useHermes.ts): Message state & run lifecycle hooks.
  - [components/UsageWidget.tsx](../../src/components/UsageWidget.tsx): Status metrics component.
  - [components/SettingsModal.tsx](../../src/components/SettingsModal.tsx): Slide-up sheets drawer.
  - [App.tsx](../../src/App.tsx): Primary desktop dashboard.
  - [index.css](../../src/index.css): Design systems & tailwind v4 styles.
- [tests](../../tests): Tests and fixtures placeholder.
- [config](../../config): Local config examples placeholder.

## Boundary Rules

- **Zero API leakage**: Secrets should reside strictly inside the environment file (`.env`).
- **Responsive Shell**: Interface viewport limits are strictly locked on iPhone ratios to prevent standalone app bounce.