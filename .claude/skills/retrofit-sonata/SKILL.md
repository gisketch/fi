---
name: retrofit-sonata
description: "Use when: /retrofit-sonata, retrofitting an existing project into Sonata harness standard, reorganizing docs, understanding a codebase, migrating scattered markdown, or making a project harness-engineering ready. Always preserve harness engineering and caveman style."
argument-hint: "Optional retrofit focus, constraints, or target agent setup"
---

# Retrofit Sonata

Turn existing project into Sonata-compatible harness.

Rules:

- Inventory before edits.
- Preserve useful docs by moving, linking, or summarizing into `docs/`.
- Keep `AGENTS.md` short.
- Keep Codex first unless user requests otherwise.
- Put verified commands in `docs/quality.md`.
- Put broad/risky work in `docs/exec-plans/active/`.
- Flag oversized 500+ line source files as design smells; plan modular slices instead of broad rewrites.
- Run `./scripts/check-sonata.sh`.
- Caveman-terse output unless safety or confusion requires normal prose.

Do not change app behavior unless explicitly requested.
