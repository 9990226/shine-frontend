#!/bin/bash
# Deploy FULL 2c-ai.com: main site + SHINE subfolder
# Run from 2c-ai-site root: bash shine/deploy-root/DEPLOY_ALL_WITH_PW.sh

set -euo pipefail

SITE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_ROOT="$(cd "$(dirname "$0")" && pwd)"
SHINE_DIR="$(cd "$DEPLOY_ROOT/.." && pwd)"

echo "═══ Step 1/2: Main site (2c-ai.com) ═══"
bash "$DEPLOY_ROOT/DEPLOY_SITE_WITH_PW.sh"

echo ""
echo "═══ Step 2/2: SHINE (/shine) ═══"
bash "$SHINE_DIR/DEPLOY_WITH_PW.sh"

echo ""
echo "✅ Full deploy complete."
echo "   https://2c-ai.com/"
echo "   https://2c-ai.com/shine/"