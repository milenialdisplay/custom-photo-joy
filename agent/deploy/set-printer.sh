#!/usr/bin/env bash
# Set the CUPS printer queue name in agent/config.json and restart the agent.
#   sudo dpoto-set-printer HP_LaserJet_400_color_M451nw
# Find the queue name with: lpstat -p
set -e

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <cups-queue-name>"
  echo "Available queues:"
  lpstat -p 2>/dev/null || echo "  (none — add a printer via CUPS first)"
  exit 1
fi

# Resolve config.json: prefer the repo next to this script, fall back to ~elenajaya/agent.
HERE="$(cd "$(dirname "$0")" && pwd)"
CFG="$HERE/../config.json"
[[ -f "$CFG" ]] || CFG="/home/elenajaya/agent/config.json"
if [[ ! -f "$CFG" ]]; then
  echo "ERROR: config.json not found (tried $HERE/../config.json and /home/elenajaya/agent/config.json)"
  exit 1
fi

python3 - "$CFG" "$NAME" <<'PY'
import json, sys
p, name = sys.argv[1], sys.argv[2]
c = json.load(open(p))
c["printer_name"] = name
open(p, "w").write(json.dumps(c, indent=2) + "\n")
print(f"Set printer_name={name} in {p}")
PY

if systemctl list-unit-files dpoto-agent.service >/dev/null 2>&1; then
  systemctl restart dpoto-agent.service
  sleep 1
  curl -s http://localhost:8080/health || true
  echo
fi
