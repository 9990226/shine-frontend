#!/bin/bash
# Deploy 2c-ai.com MAIN site (root pages + assets) — does NOT delete /shine
# Run from 2c-ai-site root: bash shine/deploy-root/DEPLOY_SITE_WITH_PW.sh

set -euo pipefail

SITE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SHINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$SHINE_DIR/lib/vps-common.sh"
load_vps_env "$SITE_ROOT"
require_vps_password

VPS_ROOT="${VPS_SITE_PATH:-/var/www/2c-ai}"
TARBALL="/tmp/2c-ai-site_main_$(date +%Y%m%d_%H%M%S).tar.gz"

echo "📦 Packing main site (excludes shine/)..."
cd "$SITE_ROOT"
tar -czf "$TARBALL" \
  --exclude='./shine' \
  --exclude='./Archive.zip' \
  --exclude='./.DS_Store' \
  --exclude='./.vps.env' \
  --exclude='./DEPLOY*.sh' \
  --exclude='./lib' \
  --exclude='./*.tar.gz' \
  .

echo "🚀 Uploading to ${VPS_USER}@${VPS_HOST}..."
run_expect_scp "$TARBALL" "/tmp/2c-ai-site_main_latest.tar.gz"

echo "🔧 Deploying main site → ${VPS_ROOT} (shine/ preserved)..."
run_expect_ssh "bash -s" <<REMOTE
set -e
mkdir -p ${VPS_ROOT}
tar -xzf /tmp/2c-ai-site_main_latest.tar.gz -C ${VPS_ROOT}
chown -R www-data:www-data ${VPS_ROOT} 2>/dev/null || chown -R root:root ${VPS_ROOT}
chmod -R 755 ${VPS_ROOT}
nginx -s reload 2>/dev/null || true
echo "=== Main site verify ==="
test -f ${VPS_ROOT}/index.html && echo "✅ index.html"
test -d ${VPS_ROOT}/assets && echo "✅ assets/"
test -d ${VPS_ROOT}/shine && echo "✅ shine/ untouched"
grep -q '2C' ${VPS_ROOT}/index.html && echo "✅ homepage content"
REMOTE

rm -f "$TARBALL"
echo "✅ Main site deploy done. Hard-refresh https://2c-ai.com/"