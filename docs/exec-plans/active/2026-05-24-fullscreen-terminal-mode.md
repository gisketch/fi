# Fullscreen Terminal Mode

## Goal

Move terminal from composer dialog to persistent fullscreen app mode.

## Acceptance Criteria

- Hamburger menu opens Terminal.
- Composer toolbar has no terminal button.
- Terminal fills viewport with header, gear settings, and xterm only.
- Back returns to Fi without disconnecting SSH.
- Reopening Terminal preserves mounted xterm/session.
- Mobile visual viewport resize fits xterm and sends terminal resize.

## Context Links

- `src/App.tsx`
- `src/components/terminal/TerminalScreen.tsx`
- `src/services/terminalGateway.ts`
- `docs/quality.md`

## Steps

- [x] Read current app shell and terminal dialog.
- [x] Create fullscreen terminal screen.
- [x] Update AppShell navigation and persistent mount state.
- [x] Remove composer terminal button.
- [x] Update docs for terminal path.
- [x] Run required checks.

## Validation

- `bun scripts/check-hermes-events.ts`
- `bun run build`

## Decision Log

- Keep gateway protocol and localStorage keys unchanged.
- Keep terminal connection state inside the terminal component.

## Progress Log

- 2026-05-24: Started fullscreen terminal mode implementation.
- 2026-05-24: Added `TerminalScreen`, menu entry, persistent mount state, and source map update.
- 2026-05-24: `bun scripts/check-hermes-events.ts` and `bun run build` passed. Browser smoke reached app PIN gate; Terminal menu could not be clicked without credentials.
