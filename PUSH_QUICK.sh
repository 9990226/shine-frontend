#!/bin/bash
# Fast push: SCP key files only (no full tar, no npm install)
set -euo pipefail
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$LOCAL_DIR/lib/vps-common.sh"
load_vps_env "$LOCAL_DIR"
require_vps_password

VPS_PATH="${SHINE_VPS_PATH:-/var/www/2c-ai/shine}"
VPS_BACKEND="${SHINE_VPS_BACKEND:-/var/www/2c-ai/shine-backend}"

echo "📤 Frontend → ${VPS_PATH}"
run_expect_scp "$LOCAL_DIR/index.html" "${VPS_PATH}/index.html"
run_expect_scp "$LOCAL_DIR/shine-motion.js" "${VPS_PATH}/shine-motion.js"
run_expect_scp "$LOCAL_DIR/assets/shine-app.js" "${VPS_PATH}/assets/shine-app.js"
run_expect_scp "$LOCAL_DIR/access-passwords.txt" "${VPS_BACKEND}/access-passwords.txt"

echo "📤 Backend → ${VPS_BACKEND}"
run_expect_scp "$LOCAL_DIR/backend/send-only-server.js" "${VPS_BACKEND}/send-only-server.js"
run_expect_scp "$LOCAL_DIR/backend/services/jobBoardScan.js" "${VPS_BACKEND}/services/jobBoardScan.js"
run_expect_scp "$LOCAL_DIR/backend/accessControl.js" "${VPS_BACKEND}/accessControl.js"
run_expect_scp "$LOCAL_DIR/backend/db/index.js" "${VPS_BACKEND}/db/index.js"
run_expect_scp "$LOCAL_DIR/backend/routes/automation.js" "${VPS_BACKEND}/routes/automation.js"
run_expect_scp "$LOCAL_DIR/backend/services/sendQuota.js" "${VPS_BACKEND}/services/sendQuota.js"
run_expect_scp "$LOCAL_DIR/backend/services/monthlyQuota.js" "${VPS_BACKEND}/services/monthlyQuota.js"
run_expect_scp "$LOCAL_DIR/backend/services/trialQuota.js" "${VPS_BACKEND}/services/trialQuota.js"
run_expect_scp "$LOCAL_DIR/backend/services/automationEngine.js" "${VPS_BACKEND}/services/automationEngine.js"
run_expect_scp "$LOCAL_DIR/backend/services/dedupKey.js" "${VPS_BACKEND}/services/dedupKey.js"
run_expect_scp "$LOCAL_DIR/backend/services/senderBinding.js" "${VPS_BACKEND}/services/senderBinding.js"
run_expect_scp "$LOCAL_DIR/backend/services/mailCredentials.js" "${VPS_BACKEND}/services/mailCredentials.js"

echo "🔄 Restart backend..."
run_expect_remote_script /tmp/shine_quick_restart.sh <<'REMOTE'
systemctl restart shine-backend.service 2>/dev/null && echo "systemd restart ok" || echo "systemd restart skipped"
grep -q openTrialLogin /var/www/2c-ai/shine/index.html && echo "frontend: openTrialLogin ok"
grep -q "立即免費試用" /var/www/2c-ai/shine/index.html && echo "frontend: cta ok"
grep -q testshine /var/www/2c-ai/shine-backend/access-passwords.txt && echo "backend: testshine ok"
curl -sf http://127.0.0.1:3001/api/health && echo "health ok"
REMOTE

echo "✅ Quick push done. Hard-refresh https://2c-ai.com/shine/"