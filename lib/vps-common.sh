# Shared VPS auth helpers — source from deploy scripts (never commit .vps.env)
load_vps_env() {
  local script_dir="$1"
  local parent_dir
  parent_dir="$(cd "$script_dir/.." && pwd)"
  if [[ -f "$script_dir/.vps.env" ]]; then
    # shellcheck disable=SC1091
    source "$script_dir/.vps.env"
  elif [[ -f "$parent_dir/.vps.env" ]]; then
    # shellcheck disable=SC1091
    source "$parent_dir/.vps.env"
  fi
  VPS_HOST="${SHINE_VPS_HOST:-187.77.133.26}"
  VPS_USER="${SHINE_VPS_USER:-root}"
  PW="${SHINE_VPS_PASSWORD:-}"
}

run_expect_scp() {
  local src="$1" dest="$2"
  expect <<EOF
set timeout 180
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
set timeout 240
set pw "$PW"
spawn ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no ${VPS_USER}@${VPS_HOST} $cmd
expect {
  -re "(?i)password:" { send "\$pw\r"; exp_continue }
  timeout { exit 2 }
  eof
}
EOF
}

require_vps_password() {
  if [[ -z "$PW" ]]; then
    echo "❌ Missing SHINE_VPS_PASSWORD."
    echo "   Copy .vps.env.example → .vps.env at 2c-ai-site root (or shine/)."
    exit 1
  fi
  if ! command -v expect >/dev/null 2>&1; then
    echo "❌ expect is required (macOS: pre-installed)"
    exit 1
  fi
}