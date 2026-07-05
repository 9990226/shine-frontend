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
# systemd shine-backend.service runs from this path (not shine/backend)
VPS_BACKEND="${SHINE_VPS_BACKEND:-/var/www/2c-ai/shine-backend}"

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

ENV_SRC="${LOCAL_DIR}/backend/.env.vps"
if [[ ! -f "$ENV_SRC" && -f "${LOCAL_DIR}/backend/.env" ]]; then
  ENV_SRC="${LOCAL_DIR}/backend/.env"
fi
if [[ -f "$ENV_SRC" ]]; then
  echo "🔐 Uploading VPS .env (encryption keys)..."
  run_expect_scp "$ENV_SRC" "/tmp/shine_backend.env"
else
  echo "⚠️  No backend/.env.vps or backend/.env — skip env upload (automation encrypt will fail)"
fi

echo "🔧 Remote deploy..."
run_expect_remote_script /tmp/deploy_shine.sh <<REMOTE
set -e
rm -rf ${VPS_PATH}
mkdir -p ${VPS_PATH} ${VPS_BACKEND}
tar -xzf /tmp/shine_latest.tar.gz -C ${VPS_PATH}
tar -xzf /tmp/shine_backend_latest.tar.gz -C ${VPS_BACKEND}
if [[ -f /tmp/shine_backend.env ]]; then
  install -m 600 /tmp/shine_backend.env ${VPS_BACKEND}/.env
  rm -f /tmp/shine_backend.env
  echo "✅ ${VPS_BACKEND}/.env installed"
fi
if [[ ! -f ${VPS_BACKEND}/.env && -f /var/www/2c-ai/shine/backend/.env ]]; then
  cp /var/www/2c-ai/shine/backend/.env ${VPS_BACKEND}/.env
  chmod 600 ${VPS_BACKEND}/.env
  sed -i 's|SQLITE_PATH=.*|SQLITE_PATH=/var/www/2c-ai/shine-backend/shine-automation.db|' ${VPS_BACKEND}/.env || true
  echo "✅ migrated .env from legacy shine/backend path"
fi
UNIT=/etc/systemd/system/shine-backend.service
if [[ -f "\$UNIT" ]] && ! grep -q EnvironmentFile "\$UNIT"; then
  sed -i '/^Environment=PORT/a EnvironmentFile=-/var/www/2c-ai/shine-backend/.env' "\$UNIT"
  systemctl daemon-reload
  echo "✅ systemd EnvironmentFile added"
fi
chown -R www-data:www-data ${VPS_PATH}
chmod -R 755 ${VPS_PATH}
chown -R root:root ${VPS_BACKEND}
chmod -R 755 ${VPS_BACKEND}
cd ${VPS_BACKEND}
if command -v npm >/dev/null 2>&1; then
  npm install --omit=dev
  echo "✅ npm install in ${VPS_BACKEND}"
fi
if systemctl is-active shine-backend.service >/dev/null 2>&1; then
  systemctl restart shine-backend.service
  echo "✅ systemctl restart shine-backend.service"
elif command -v pm2 >/dev/null 2>&1; then
  for name in shine-send shine-api shine-send-only send-only; do
    if pm2 describe "\$name" >/dev/null 2>&1; then
      pm2 restart "\$name"
      echo "pm2 restart \$name"
      break
    fi
  done
fi
nginx -s reload 2>/dev/null || true
grep -q mountAutomation ${VPS_BACKEND}/send-only-server.js && echo "✅ automation routes in send-only-server"
grep -q dailyAutoEnabled ${VPS_PATH}/index.html && echo "✅ automation UI present"
curl -sf http://127.0.0.1:3001/api/health >/dev/null && echo "✅ shine-api health OK"
REMOTE

rm -f "$TARBALL" "$BACKEND_TAR"
echo "✅ Deploy finished. Hard-refresh https://2c-ai.com/shine/"