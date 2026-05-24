# Source

Vite React application source.

Current stack: Vite SPA with React 18, TypeScript, TailwindCSS v4, Framer Motion, and vite-plugin-pwa.

## Current Boundaries

- `config/`: browser-visible Hermes and usage env values.
- `types/`: Hermes Web API contracts.
- `services/`: WebSocket JSON-RPC, REST/SSE fallback, Hermes facade, terminal gateway client, notifications, and deprecated legacy API compatibility.
- `state/`: pure Hermes event reducer.
- `hooks/`: React facade for app state and session actions.
- `components/`: chat rendering, virtualization, legacy widgets, and focused dialog sheets.

Primary chat path: `App.tsx` -> `useHermes` -> `HermesGateway` -> `hermesTransport`.

Terminal path: `App.tsx` -> lazy `TerminalDialog` -> `terminalGateway` -> separate terminal gateway WebSocket.
