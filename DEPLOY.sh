#!/bin/bash
# SHINE Frontend Deploy Script
# Run this on your LOCAL MACHINE — it packages & pushes to VPS
# Usage: bash DEPLOY.sh
# ──────────────────────────────────────────────────────────────

VPS_HOST="187.77.133.26"
VPS_USER="root"                  # ← set your VPS user
VPS_PATH="/var/www/2c-ai/shine"
# Canonical package: Downloads/2c-ai-site/shine (run this script from that folder)
LOCAL_DIR="$(dirname "$0")"

echo "📦 Packing frontend files..."
TARBALL="/tmp/shine_frontend_$(date +%Y%m%d_%H%M%S).tar.gz"
cd "$LOCAL_DIR"
tar -czf "$TARBALL" --exclude='DEPLOY.sh' --exclude='*.tar.gz' .
echo "   Created: $TARBALL"

echo ""
echo "🚀 Uploading to VPS $VPS_HOST ..."
scp "$TARBALL" "${VPS_USER}@${VPS_HOST}:/tmp/shine_latest.tar.gz"

echo ""
echo "🔧 Deploying on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
  set -e
  echo "  Clearing old files..."
  rm -rf ${VPS_PATH}
  mkdir -p ${VPS_PATH}
  echo "  Extracting new files..."
  tar -xzf /tmp/shine_latest.tar.gz -C ${VPS_PATH}
  echo "  Setting permissions..."
  chown -R www-data:www-data ${VPS_PATH}
  chmod -R 755 ${VPS_PATH}
  echo "  Reloading nginx..."
  nginx -s reload
  echo "  Verifying..."
  ls -la ${VPS_PATH}/
  grep -l "scanBtn" ${VPS_PATH}/index.html && echo "  ✅ scanBtn present"
  grep -l "updateMissionStatus" ${VPS_PATH}/index.html && echo "  ✅ updateMissionStatus present"
  echo ""
  echo "✅ Deploy complete!"
REMOTE

rm -f "$TARBALL"
echo ""
echo "✅ Done. Hard-refresh the site (Ctrl+Shift+R) to clear cache."
