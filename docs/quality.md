# Quality

## Current Checks

| Check | Command | When To Run |
|---|---|---|
| Sonata structure | `./scripts/check-sonata.sh` | After scaffold, docs, or skill changes |
| Hermes event reducer smoke | `bun scripts/check-hermes-events.ts` | After Hermes event, reducer, fixture, or hook compatibility changes |
| Production build | `bun run build` | Before handoff after source or config changes |

## Retrofit Checks

When `/retrofit-sonata` runs, verify:

- Existing markdown was preserved, moved, linked, or summarized.
- `AGENTS.md` stayed short.
- Project commands in this file are verified or marked unverified.
- Broad migration work has an execution plan.

## Optional / Not Yet Mandatory

| Check | Command | Status |
|---|---|---|
| Dev server | `bun run dev` | Available for local manual PWA testing |
| Preview server | `bun run preview` | Available after build |
| Lint | `bun run lint` | Declared, but ESLint config/dependency completeness is not verified as a required gate |

## Missing Stack Checks

Add or promote commands when the repo has the needed tooling:

- Format.
- Lint, once verified.
- Unit tests, if a test runner is added beyond the current Bun smoke script.
- Integration tests.
- Local run or smoke test.

## Quality Bar

- Acceptance criteria exist before broad implementation.
- Validation is reproducible by another agent.
- New decisions update docs.
- Repeated failures become docs, scripts, tests, or tighter prompts.

<!-- sonata:block=context-checks:start -->
## Context And Agent Checks

| Check | Command | When To Run |
|---|---|---|
| Context setup | `./scripts/setup-context.sh` | After enabling Pi, Serena, Graphify, or lean-ctx |
| Context check | `./scripts/check-context.sh` | Before handoff when selected tools are expected |
| Serena MCP setup | `serena init` | After install or MCP/client setup changes |
<!-- sonata:block=context-checks:end -->
