#!/usr/bin/env bash
# Typecheck + unit tests (local pre-merge check).
#
# Usage:
#   npm run check
#   bash scripts/dev/verify-local.sh

set -euo pipefail

cd "$(dirname "$0")/../.."

echo "🔍 Type checking (frontend)..."
# Incremental cache (tsconfig.tsbuildinfo) lists .next/types files from the last
# Next build. After those files disappear, tsc reports TS6053 even when sources
# are fine.
npx tsc --noEmit --incremental false

echo ""
echo "🔍 Type checking (Amplify / Lambda)..."
npx tsc --noEmit -p amplify/tsconfig.json

echo ""
echo "🧪 Unit tests..."
npm test

echo ""
echo "✅ Local checks passed (typecheck + test)."
