#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT_DIR/deploy/ec2/nginx-carebridge.conf"

sudo install -m 0644 "$CONFIG" /etc/nginx/conf.d/carebridge.conf
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "Nginx is configured for the CareBridge API."
