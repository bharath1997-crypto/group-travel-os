#!/usr/bin/env bash
# Sync Production-main -> main so Vercel deploys rovvy.app
# Run whenever YOU want the live site updated (daily cron also runs at 2 AM UTC).
#
# Usage (from repo root):
#   bash scripts/sync-to-main.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RETURN_BRANCH="$(git branch --show-current)"

echo "Fetching origin/main and origin/Production-main..."
git fetch origin main Production-main

echo "Merging Production-main into main..."
git checkout main
git pull origin main
git merge origin/Production-main -m "chore: sync Production-main to main for Vercel deploy"
git push origin main

if [[ -n "${RETURN_BRANCH}" && "${RETURN_BRANCH}" != "main" ]]; then
  git checkout "${RETURN_BRANCH}"
fi

echo ""
echo "Done. Vercel will build and deploy from main shortly."
echo "Check: Vercel dashboard -> Production deployment -> Ready"
