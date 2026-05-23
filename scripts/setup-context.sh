#!/usr/bin/env bash
set -euo pipefail

echo "Sonata context setup"

if ! command -v serena >/dev/null 2>&1; then
  echo "serena not found"
  echo "Install: uv tool install -p 3.13 serena-agent@latest --prerelease=allow"
else
  serena init || true
  serena setup codex || true
  echo "Codex app sessions may need: Activate the current dir as project using serena"
fi

if command -v pi >/dev/null 2>&1; then
  echo "Pi detected"
  echo "Project Pi skills and prompts live under .pi/"
  echo "Optional after review: pi install -l npm:pi-serena-tools"
else
  echo "Pi selected, but pi command was not found."
fi
