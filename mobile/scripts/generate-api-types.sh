#!/usr/bin/env bash
# Regenerates mobile/src/api/generated/*.d.ts from every
# specs/*/contracts/openapi.yaml in the repo root. See
# mobile/src/api/generated/README.md.
set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_DIR/.." && pwd)"
OUT_DIR="$MOBILE_DIR/src/api/generated"

mkdir -p "$OUT_DIR"

for f in "$REPO_ROOT"/specs/*/contracts/openapi.yaml; do
  [ -f "$f" ] || continue
  feature="$(basename "$(dirname "$(dirname "$f")")")"
  echo "Generating types for $feature..."
  npx --prefix "$MOBILE_DIR" openapi-typescript "$f" -o "$OUT_DIR/${feature}.d.ts"
done

echo "Done."
