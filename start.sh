#!/bin/bash
# ============================================================
# Finugreek — Unified Backend Launcher
# Starts: kdb+ (Tickerplant + RDB) → Binance Feed Handler → FastAPI
# Usage: ./start.sh [--no-kdb] [--no-feed]
# Logs: ./logs/backend.log (unified)
# ============================================================

set -e

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$BASE_DIR/logs"
PID_DIR="$BASE_DIR/.pids"
mkdir -p "$LOG_DIR" "$PID_DIR" "$BASE_DIR/tickdb/logs" "$BASE_DIR/tickdb/hdb"

# ── Log Rotation ────────────────────────────────────────────
rotate_log() {
  local log_file=$1
  local max_size=$2
  if [ -f "$log_file" ]; then
    local size=$(stat -c%s "$log_file" 2>/dev/null || stat -f%z "$log_file" 2>/dev/null)
    if [ "$size" -ge "$max_size" ]; then
      for i in 2 1; do
        if [ -f "${log_file}.$i" ]; then
          mv "${log_file}.$i" "${log_file}.$((i+1))"
        fi
      done
      mv "$log_file" "${log_file}.1"
    fi
  fi
}

# Rotate backend.log if it exceeds 10MB (10485760 bytes)
rotate_log "$LOG_DIR/backend.log" 10485760

# Ensure KDB-X is in PATH (from the new installer location)
export PATH="$HOME/.kx/bin:$PATH"

# Logging macro: set to 1 to enable by default
LOGGING_MACRO=1

# Parse flags
NO_KDB=false
NO_FEED=false
for arg in "$@"; do
  case $arg in
    --no-kdb)  NO_KDB=true ;;
    --no-feed) NO_FEED=true ;;
    --log)     LOGGING_MACRO=1 ;;
    --help)
      echo "Usage: ./start.sh [--no-kdb] [--no-feed] [--log]"
      echo "  --no-kdb   Skip kdb+ processes (run FastAPI only)"
      echo "  --no-feed  Skip Binance feed handler"
      echo "  --log      Enable console logging output"
      exit 0
      ;;
  esac
done

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { 
  if [ "$LOGGING_MACRO" = "1" ]; then 
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
  fi 
}
warn() { 
  if [ "$LOGGING_MACRO" = "1" ]; then 
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
  fi 
}

# ── Stop any existing processes ─────────────────────────────
stop_existing() {
  for pidfile in "$PID_DIR"/*.pid; do
    if [ -f "$pidfile" ]; then
      pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        log "Stopped process $pid ($(basename "$pidfile" .pid))"
      fi
      rm -f "$pidfile"
    fi
  done
  # Kill any orphan q or feed or uvicorn or ctl processes matching ports 5010, 5011, 8080
  pkill -9 -f "finugreek_ctl.py" 2>/dev/null || true
  pkill -9 -f "5010" 2>/dev/null || true
  pkill -9 -f "5011" 2>/dev/null || true
  pkill -9 -f "8080" 2>/dev/null || true
  pkill -9 -f "tick.q" 2>/dev/null || true
  pkill -9 -f "r.q" 2>/dev/null || true
  pkill -9 -f "feed.py" 2>/dev/null || true
  pkill -9 -f "uvicorn" 2>/dev/null || true
  if command -v fuser &> /dev/null; then
    fuser -k -9 5010/tcp 2>/dev/null || true
    fuser -k -9 5011/tcp 2>/dev/null || true
    fuser -k -9 8080/tcp 2>/dev/null || true
  fi
  sleep 3
}

stop_existing

# ── Start kdb+ Processes ───────────────────────────────────
if [ "$NO_KDB" = false ]; then
  # Check if q is available
  if ! command -v q &> /dev/null; then
    warn "⚠ kdb+ (q) not found in PATH. Skipping kdb+ processes."
    warn "  Install: https://code.kx.com/q/learn/install/"
    warn "  FastAPI will start without kdb+ — crypto endpoints will return 'offline'."
    NO_KDB=true
    NO_FEED=true
  fi
fi

if [ "$NO_KDB" = false ]; then
  cd "$BASE_DIR/tickdb"

  # 1. Tickerplant (5010)
  if python3 -c "import socket; s=socket.socket(); s.connect(('127.0.0.1', 5010)); s.close()" 2>/dev/null; then
    log "Port 5010 already active (Tickerplant running) ✓"
  else
    log "Starting kdb+ Tickerplant on port 5010..."
    q tick.q -p 5010 >> "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/tickerplant.pid"
    sleep 2
  fi

  # 2. RDB (5011)
  if python3 -c "import socket; s=socket.socket(); s.connect(('127.0.0.1', 5011)); s.close()" 2>/dev/null; then
    log "Port 5011 already active (RDB running) ✓"
  else
    log "Starting kdb+ RDB on port 5011..."
    q r.q -p 5011 >> "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/rdb.pid"
    sleep 1
  fi

  log "kdb+ processes ready ✓"
fi

# ── Start Binance Feed Handler ──────────────────────────────
if [ "$NO_FEED" = false ] && [ "$NO_KDB" = false ]; then
  log "Starting Binance Feed Handler..."
  cd "$BASE_DIR"
  python3 tickdb/feed.py >> "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$PID_DIR/feed.pid"
  log "Feed handler started ✓"
fi

# ── Start FastAPI ───────────────────────────────────────────
log "Starting FastAPI on port 8080..."
cd "$BASE_DIR/backend"
uvicorn main:app --host 0.0.0.0 --port 8080 >> "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/uvicorn.pid"

sleep 3

# ── Startup Health Verification ─────────────────────────────
FAILED=false
for pidfile in "$PID_DIR"/*.pid; do
  if [ -f "$pidfile" ]; then
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if ! kill -0 "$pid" 2>/dev/null; then
      echo -e "${RED}[ERROR] Service '$name' (PID $pid) crashed during startup!${NC}"
      FAILED=true
    fi
  fi
done

if [ "$FAILED" = true ]; then
  echo -e "${RED}══════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  STARTUP FAILED — RECENT LOG OUTPUT (${LOG_DIR}/backend.log):${NC}"
  echo -e "${RED}══════════════════════════════════════════════════════${NC}"
  tail -n 35 "$LOG_DIR/backend.log"
  echo -e "${RED}══════════════════════════════════════════════════════${NC}"
  exit 1
fi

log "═══════════════════════════════════════"
log "  Finugreek Backend Started ✓"
log "  API:       http://localhost:8080"
log "  Dashboard: http://localhost:5173"
log "  Crypto:    http://localhost:5173/crypto"
log "  Logs:      $LOG_DIR/backend.log"
log "═══════════════════════════════════════"

# ── Trap SIGINT to stop all processes ───────────────────────
cleanup() {
  echo ""
  log "Shutting down all processes..."
  stop_existing
  log "All processes stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any child to exit
wait
