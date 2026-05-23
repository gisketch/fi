#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

required_files=(
  "AGENTS.md"
  "README.md"
  ".gitignore"
  ".sonata/manifest.json"
  "docs/index.md"
  "docs/core-beliefs.md"
  "docs/agent-targets.md"
  "docs/project-brief.md"
  "docs/quality.md"
  "docs/architecture/index.md"
  "docs/exec-plans/README.md"
  "docs/references/harness-engineering.md"
  "docs/references/caveman.md"
  ".codex/prompts/init-sonata.md"
  ".codex/prompts/caveman-sonata.md"
  ".codex/prompts/retrofit-sonata.md"
  ".codex/skills/init-sonata/SKILL.md"
  ".codex/skills/caveman-sonata/SKILL.md"
  ".codex/skills/retrofit-sonata/SKILL.md"
  ".github/skills/init-sonata/SKILL.md"
  ".github/skills/caveman-sonata/SKILL.md"
  ".github/skills/retrofit-sonata/SKILL.md"
  ".github/prompts/init-sonata.prompt.md"
  ".github/prompts/caveman-sonata.prompt.md"
  ".github/prompts/retrofit-sonata.prompt.md"
  ".github/prompts/review-sonata.prompt.md"
  "src/README.md"
  "tests/README.md"
  "config/README.md"
)

manifest_has() {
  grep -q "\"$1\"" .sonata/manifest.json 2>/dev/null
}

if manifest_has "pi" || [[ -d ".pi" ]]; then
  required_files+=(
    ".pi/settings.json"
    ".pi/skills/init-sonata/SKILL.md"
    ".pi/skills/caveman-sonata/SKILL.md"
    ".pi/skills/retrofit-sonata/SKILL.md"
    ".pi/prompts/init-sonata.md"
    ".pi/prompts/caveman-sonata.md"
    ".pi/prompts/retrofit-sonata.md"
  )
fi

if manifest_has "antigravity" || [[ -d ".agents" ]]; then
  required_files+=(
    ".agents/skills/init-sonata/SKILL.md"
    ".agents/skills/caveman-sonata/SKILL.md"
    ".agents/skills/retrofit-sonata/SKILL.md"
    ".agents/prompts/init-sonata.md"
    ".agents/prompts/caveman-sonata.md"
    ".agents/prompts/retrofit-sonata.md"
  )
fi

if manifest_has "graphify"; then
  required_files+=(
    "docs/context/graphify.md"
    ".graphifyignore"
  )
fi

if manifest_has "serena"; then
  required_files+=("docs/context/serena.md")
fi

if manifest_has "lean-ctx"; then
  required_files+=("docs/context/lean-ctx.md")
fi

if manifest_has "pi" || manifest_has "serena" || manifest_has "graphify" || manifest_has "lean-ctx"; then
  required_files+=(
    "scripts/setup-context.sh"
    "scripts/check-context.sh"
  )
fi

missing=0

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    printf 'missing or empty: %s\n' "$file"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

printf 'sonata ok\n'
