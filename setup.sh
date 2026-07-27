#!/bin/bash
# ============================================================
# Finugreek Quant & Analytics — Unified Setup & Master Control
# ============================================================

set -e

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# Ensure venv python is prioritized if available
if [ -f "$BASE_DIR/.venv/bin/python3" ]; then
    PYTHON_BIN="$BASE_DIR/.venv/bin/python3"
else
    PYTHON_BIN="python3"
fi

# Make scripts executable
chmod +x "$BASE_DIR/scripts/master_control.py" 2>/dev/null || true
chmod +x "$BASE_DIR/scripts/update_data.sh" 2>/dev/null || true

# Run Master Control TUI
exec "$PYTHON_BIN" "$BASE_DIR/scripts/master_control.py" "$@"
