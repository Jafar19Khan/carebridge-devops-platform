#!/usr/bin/env bash
set -euo pipefail

: "${S3_BUCKET:?Set S3_BUCKET}"
: "${VITE_API_URL:?Set VITE_API_URL}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/frontend/dist"

cd "$ROOT_DIR/frontend"
VITE_API_URL="$VITE_API_URL" npm run build
aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" --delete
printf 'Frontend deployed to s3://%s\n' "$S3_BUCKET"
