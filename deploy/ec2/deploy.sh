#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/carebridge"
REPO_URL="${REPO_URL:?Set REPO_URL}"
BRANCH="${BRANCH:-main}"

sudo mkdir -p "$APP_DIR"
sudo chown -R "${USER}:${USER}" "$APP_DIR"

# Preserve a pre-created production .env when the repository is first cloned.
if [[ ! -d "$APP_DIR/.git" ]]; then
  TMP_DIR="$(mktemp -d)"
  cleanup() { rm -rf "$TMP_DIR"; }
  trap cleanup EXIT
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$TMP_DIR/repo"
  cp -a "$TMP_DIR/repo/." "$APP_DIR/"
else
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env. Create the production environment file before deployment." >&2
  exit 1
fi

# Do not publish PostgreSQL; Compose binds it only to the private network.
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --build db backend
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps
curl --fail --silent --show-error http://127.0.0.1:4000/health
printf '
Backend deployment is healthy.
'
