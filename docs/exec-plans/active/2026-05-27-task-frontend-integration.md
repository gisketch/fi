# Task Frontend Integration

## Goal

Add full Fi frontend task integration backed by the VPS `/v1/tasks` API.

## Acceptance Criteria

- Start dashboard shows a compact task focus widget above Recent.
- Menu opens a full task center sheet.
- Task center supports status filters, category filter, search, detail view, edits, Done, Tomorrow, and Cancel.
- Task creation stays AI-based through the existing composer shortcut.
- Task API calls use the existing Hermes regular bearer token only.
- UI handles loading, empty, and API error states without blocking chat or sessions.

## Context Links

- `src/App.tsx`
- `src/components/sessions/StartDashboard.tsx`
- `src/services/hermesRest.ts`
- `docs/architecture/index.md`

## Steps

- [x] Add task contracts and API service.
- [x] Add task widget and task center components.
- [x] Wire dashboard, menu, composer shortcut, and run-complete refresh.
- [x] Update architecture docs.
- [x] Run validation checks.
- [ ] Commit task.

## Validation

- Passed: `bun run build`
- Passed: `bun scripts/check-hermes-events.ts`
- Passed: `./scripts/check-sonata.sh`
- Passed: local Vite smoke on `http://127.0.0.1:5174/` returned HTTP 200 while the dev server was running.

## Decision Log

- Use existing shell dialogs instead of adding routing.
- Keep task creation conversational: `Add with Fi` primes the composer rather than opening a manual create form.
- Use direct REST task actions for Done, Tomorrow, Cancel, and edits.
- Use only subtle red section treatment for overdue; avoid red cards/backgrounds.
- Optimize task center for phone first: list-or-detail on mobile, split pane on larger screens.
- Task Center is the existing task sheet evolved with `/tasks?focus=` deep links, not a duplicate task UI.

## Progress Log

- 2026-05-27: Started full frontend task integration.
- 2026-05-27: Added task API client, dashboard widget, task center, edit panel, menu wiring, composer shortcut, and architecture note.
- 2026-05-27: Validation passed.
- 2026-05-27: Readjusted task UI for mobile density, subtle overdue section treatment, compact widget, and mobile detail flow.
- 2026-05-27: Added Task Center naming, notification/cold-start task deep links, grouped active task sections, and push docs note.
