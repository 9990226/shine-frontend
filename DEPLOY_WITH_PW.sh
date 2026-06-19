#!/bin/bash
# SHINE deploy via password SSH (expect). Does NOT store password in repo.
# Usage:
#   export SHINE_VPS_PASSWORD='your-vps-root-password'
#   bash DEPLOY_WITH_PW.sh
# Optional:
#   SHINE_VPS_HOST=187.77.133.26 SHINE_VPS_USER=root bash DEPLOY_WITH_PW.sh

set -euo pipefail

VPS_HOST="${SHINE_VPS_HOST:-187.77.133.26}"
VPS_USER="${SHINE_VPS_USER:-root}"
VPS_PATH="${SHINE_VPS_PATH:-/var/www/2c-ai/shine}"
VPS_BACKEND="${SHINE_VPS_BACKEND:-/var/www/2c-ai/shine/backend}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$LOCAL_DIR/.vps.env" ]]; then
  # shellcheck disable=SC1091
  source "$LOCAL_DIR/.vps.env"
fi
PW="${SHINE_VPS_PASSWORD:-}"

if [[ -z "$PW" ]]; then
  echo "❌ Set SHINE_VPS_PASSWORD (VPS SSH root password), not SHINE_ENCRYPTION_KEY."
  echo "   Copy .vps.env.example → .vps.env or: export SHINE_VPS_PASSWORD='...' && bash DEPLOY_WITH_PW.sh"
  exit 1
fi

if ! command -v expect >/dev/null 2>&1; then
  echo "❌ expect is required (macOS: pre-installed)"
  exit 1
fi

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

run_expect_scp() {
  local src="$1" dest="$2"
  expect <<EOF
set timeout 120
set pw "$PW"
spawn scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no "$src" ${VPS_USER}@${VPS_HOST}:"$dest"
expect {
  -re "(?i)password:" { send "\$pw\r"; exp_continue }
  timeout { exit 2 }
  eof
}
EOF
}

run_expect_ssh() {
  local cmd="$1"
  expect <<EOF
set timeout 180
set pw "$PW"
spawn ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no ${VPS_USER}@${VPS_HOST} $cmd
expect {
  -re "(?i)password:" { send "\$pw\r"; exp_continue }
  timeout { exit 2 }
  eof
}
EOF
}

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