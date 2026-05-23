#!/usr/bin/env bash
set -euo pipefail

missing=0

if ! command -v serena >/dev/null 2>&1; then
  echo "missing command: serena"
  missing=1
fi

if ! command -v pi >/dev/null 2>&1; then
  echo "missing command: pi"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "context tools not fully installed"
  exit 1
fi

echo "context tools ok"
