#!/usr/bin/env bash
# Update Cloud Run ALLOWED_ORIGINS (comma-separated URLs) without shell escaping issues.
# Requires: gcloud auth and correct GCP project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud run services update group-travel-os-api \
  --region asia-south1 \
  --flags-file="${SCRIPT_DIR}/cors_flags.yaml"
