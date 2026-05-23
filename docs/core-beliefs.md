# Core Beliefs

## Agent Legibility First

Agents can only use what they can inspect. Keep decisions, boundaries, commands, and lessons in repo-local files.

## Cheap Tokens, Strong Direction

Default chat should be terse. Durable context should be explicit, indexed, and local.

## Small Files, Clear Boundaries

Prefer small, focused files an agent can inspect in one pass. Aim for 100-200 lines when practical. Treat 500+ line files as a design smell unless they are generated, framework-required, data-heavy, or clearer as one file. Split by feature, responsibility, or interface boundary.

## Plans Are Artifacts

Complex work gets an execution plan. Plans include acceptance criteria, progress, validation, and decision logs.

## Checks Beat Reminders

When a rule must stay true, enforce it with a script, test, lint, or generated fixture when possible.

## Improve The Harness When Work Hurts

Repeated agent confusion means missing context or missing tooling. Fix the harness, then continue.
