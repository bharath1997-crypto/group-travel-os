#!/usr/bin/env bash
# Same request as: https://resend.com/docs/send-with-curl
#
# On Windows PowerShell, use resend-hello-curl.ps1 instead of this file (no bash required):
#   $env:RESEND_API_KEY = "re_..."; $env:TEST_RESEND_TO = "you@example.com"; .\scripts\resend-hello-curl.ps1
#
# Bash/Git Bash: export RESEND_API_KEY=...  export TEST_RESEND_TO=...
set -euo pipefail
# Never commit a real key here — use: export RESEND_API_KEY="re_..."
RESEND_API_KEY="${RESEND_API_KEY:-re_xxxxxxxxx}"
TO="${TEST_RESEND_TO:-}"

if [[ -z "$TO" ]]; then
  echo "Set TEST_RESEND_TO to the recipient email address." >&2
  exit 1
fi
if [[ -z "$RESEND_API_KEY" || "$RESEND_API_KEY" == "re_xxxxxxxxx" ]]; then
  echo "Export RESEND_API_KEY with your real key (not the placeholder re_xxxxxxxxx)." >&2
  exit 1
fi

# JSON body (no extra deps — if the address has quotes, set TEST_RESEND_TO in .env and export)
curl -sS -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(printf '%s' "{\"from\":\"onboarding@resend.dev\",\"to\":\"${TO}\",\"subject\":\"Hello World\",\"html\":\"<p>Congrats on sending your <strong>first email</strong>!</p>\"}")"

echo
