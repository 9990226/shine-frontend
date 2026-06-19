#!/bin/bash
# SHINE deploy via password SSH (expect). Does NOT store password in repo.
# Usage:
#   bash DEPLOY_WITH_PW.sh
# Optional:
#   SHINE_VPS_HOST=187.77.133.26 SHINE_VPS_USER=root bash DEPLOY_WITH_PW.sh

set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$LOCAL_DIR/lib/vps-common.sh"
load_vps_env "$LOCAL_DIR"
require_vps_password

VPS_PATH="${SHINE_VPS_PATH:-/var/www/2c-ai/shine}"
VPS_BACKEND="${SHINE_VPS_BACKEND:-/var/www/2c-ai/shine/backend}"

TARBALL="/tmp/shine_frontend_$(date +%Y%m%d_%H%M%S).tar.gz"
BACKEND_TAR="/tmp/shine_backend_$(date +%Y%m%d_%H%M%S).tar.gz"

echo "📦 Packing frontend..."
cd "$LOCAL_DIR"
tar -czf "$TARBALL" \
  --exclude='DEPLOY.sh' --exclude='DEPLOY_WITH_PW.sh' --exclude='*.tar.gz' \
  --exclude='backend/node_modules' --exclude='backend/.git' \
  --exclude='backend/*.db' --exclude='backend/*.db-*' .

echo "📦 Packing backend (no secrets)..."
tar -czf "$BACKEND_TAR" -C "$LOCAL_DIR/backend" \
  --exclude='node_modules' --exclude='.git' --exclude='*.db' --exclude='*.db-*' \
  --exclude='access-passwords.txt' --exclude='access-log.txt' --exclude='.env' .

echo "🚀 Uploading frontend..."
run_expect_scp "$TARBALL" "/tmp/shine_latest.tar.gz"
echo "🚀 Uploading backend..."
run_expect_scp "$BACKEND_TAR" "/tmp/shine_backend_latest.tar.gz"

echo "🔧 Remote deploy..."
run_expect_ssh "bash -s" <<REMOTE
set -e
rm -rf ${VPS_PATH}
mkdir -p ${VPS_PATH} ${VPS_BACKEND}
tar -xzf /tmp/shine_latest.tar.gz -C ${VPS_PATH}
tar -xzf /tmp/shine_backend_latest.tar.gz -C ${VPS_BACKEND}
chown -R www-data:www-data ${VPS_PATH}
chmod -R 755 ${VPS_PATH}
if command -v pm2 >/dev/null 2>&1; then
  for name in shine-send shine-api shine-send-only send-only; do
    if pm2 describe "\$name" >/dev/null 2>&1; then
      pm2 restart "\$name"
      echo "pm2 restart \$name"
      break
    fi
  done
fi
nginx -s reload 2>/dev/null || true
grep -q dailyAutoEnabled ${VPS_PATH}/index.html && echo "✅ automation UI present"
REMOTE

rm -f "$TARBALL" "$BACKEND_TAR"
echo "✅ Deploy finished. Hard-refresh https://2c-ai.com/shine/"