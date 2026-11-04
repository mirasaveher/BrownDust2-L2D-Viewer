#!/usr/bin/env bash
set -eu
cd "$(git rev-parse --show-toplevel)"

# Start Vite automatically when the Codespace starts.
if ! pgrep -f '[n]ode.*vite' >/dev/null 2>&1; then
  nohup npm run dev > /tmp/browndust2-l2d-viewer-vite.log 2>&1 < /dev/null &
fi
