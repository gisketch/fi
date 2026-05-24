# Terminal Gateway Client

## Goal

Wire Fi PWA to the separate private terminal gateway before adding broader terminal workflows.

## Acceptance

- User can unlock terminal access with gateway PIN and keep the returned gateway token in browser storage.
- User can save SSH host, port, user, and password locally.
- Composer has a terminal button that opens an embedded xterm session.
- Terminal connects to the gateway WebSocket and streams input/output.
- Gateway URL is env-configurable for Netlify.
- Production build passes.

## Plan

- [x] Build terminal gateway repo in `refs/fi-terminal-gateway`.
- [x] Add browser terminal gateway service and local storage helpers.
- [x] Add terminal dialog with PIN/profile/connect flow.
- [x] Mount terminal button near prompt actions.
- [x] Code-split xterm so chat main bundle stays light.
- [x] Update env docs and validate build.

## Notes

- Browser cannot open SSH directly. It connects to the gateway over HTTPS/WebSocket.
- SSH password remains browser-local by this implementation. It is not sent to Hermes or Netlify.
- Gateway token is scoped to terminal gateway only.
