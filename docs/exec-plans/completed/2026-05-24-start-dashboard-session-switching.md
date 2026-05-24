# Start Dashboard Session Switching

## Goal

Launch Fi into a dashboard after unlock instead of auto-resuming the last Hermes session.

## Acceptance Criteria

- App connects to Hermes and loads recent sessions on launch.
- Last opened session is highlighted but not resumed until selected.
- Recent rows show title, preview, updated time, message count, and running/idle/unknown status.
- New starts a blank local draft and does not close the previous remote session.
- Opening a session resumes history and checks `session.status`.
- Session-scoped live events only update the active chat.

## Context Links

- `src/App.tsx`
- `src/hooks/useHermes.ts`
- `src/state/hermesEventReducer.ts`
- `src/components/dialogs/SessionsDialog.tsx`

## Steps

- [x] Add dashboard and shared session row view model.
- [x] Remove auto-resume from Hermes hook startup.
- [x] Add blank draft action without remote close.
- [x] Add status-aware resume and focused event filtering.
- [x] Wire session refresh on boot/focus and dashboard actions.
- [x] Run validation checks.

## Validation

- Passed: `bun scripts/check-hermes-events.ts`
- Passed: `bun run build`
- Passed: `./scripts/check-sonata.sh`

## Decision Log

- Keep server session API contracts unchanged. Add local UI-only row fields.
- Keep v1 focused: one live chat rendered at a time; background sessions refresh via list/status.
- Use localStorage `hermes_active_session_id` only as last-opened pointer.
- Follow-up UX: remove dashboard quick actions; the composer creates a new session lazily from blank state.
- Follow-up UX: hide idle/unknown status text; show status only for confirmed running sessions.

## Progress Log

- 2026-05-24: Implemented dashboard-first startup and focused session switching.
- 2026-05-24: Validation passed.
- 2026-05-24: Compact dashboard rows, restored empty prompt copy, and scoped scrolling to recent sessions.
- 2026-05-24: Follow-up validation passed.
