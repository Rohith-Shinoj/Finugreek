#!/usr/bin/env python3
import os
import sys
import time
import socket
import subprocess
import select
import tty
import termios
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "logs")
PID_DIR = os.path.join(BASE_DIR, ".pids")
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PID_DIR, exist_ok=True)

# Service Log Paths
UVICORN_LOG = os.path.join(LOG_DIR, "uvicorn.log")
CLOUDFLARED_LOG = os.path.join(LOG_DIR, "cloudflared.log")
KDB_LOG = os.path.join(LOG_DIR, "kdb.log")
UPDATE_LOG = os.path.join(LOG_DIR, "update_pipeline.log")

# PID Paths
UVICORN_PID = os.path.join(PID_DIR, "uvicorn.pid")
CLOUDFLARED_PID = os.path.join(PID_DIR, "cloudflared.pid")
KDB_TP_PID = os.path.join(PID_DIR, "kdb_tp.pid")
KDB_RDB_PID = os.path.join(PID_DIR, "kdb_rdb.pid")
FEED_PID = os.path.join(PID_DIR, "feed.pid")

def get_key():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
        if ch == '\x1b':
            ch2 = sys.stdin.read(1)
            if ch2 == '[':
                ch3 = sys.stdin.read(1)
                if ch3 == 'A':
                    return 'UP'
                elif ch3 == 'B':
                    return 'DOWN'
        elif ch in ('\n', '\r'):
            return 'ENTER'
        elif ch in ('q', 'Q'):
            return 'QUIT'
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

def is_port_open(port, host="127.0.0.1"):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    try:
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False

def get_pid(pid_file):
    if os.path.isfile(pid_file):
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)
            return pid
        except Exception:
            return None
    return None

def stop_pid(pid_file):
    pid = get_pid(pid_file)
    if pid:
        try:
            os.kill(pid, 15)
            time.sleep(0.3)
        except Exception:
            pass
    if os.path.isfile(pid_file):
        try:
            os.remove(pid_file)
        except Exception:
            pass

def detect_active_dataset():
    active_link = os.path.join(DATASETS_DIR, "active")
    if not os.path.exists(active_link):
        return "UNKNOWN (No active symlink)", "N/A", "0 MB"
    
    try:
        real_path = os.path.realpath(active_link)
        folder_name = os.path.basename(real_path)
        
        # Parse timestamp from folder name run_YYYYMMDD_HHMMSS
        last_updated = "Unknown"
        if "run_" in folder_name:
            ts_str = folder_name.replace("run_", "")
            try:
                dt = datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
                last_updated = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
            except Exception:
                last_updated = ts_str

        # Check market_data.parquet size
        parquet_path = os.path.join(real_path, "market_data.parquet")
        size_str = "0 MB"
        if os.path.isfile(parquet_path):
            size_mb = os.path.getsize(parquet_path) / (1024 * 1024)
            size_str = f"{size_mb:.2f} MB"
            if last_updated == "Unknown":
                mtime = os.path.getmtime(parquet_path)
                last_updated = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S Local")

        return folder_name, last_updated, size_str
    except Exception as e:
        return "ERROR reading dataset", f"Error: {str(e)}", "0 MB"

def start_daemon_services():
    # 1. Start Uvicorn if not running
    if not is_port_open(8080):
        backend_dir = os.path.join(BASE_DIR, "backend")
        venv_uvicorn = os.path.join(BASE_DIR, ".venv", "bin", "uvicorn")
        uvicorn_bin = venv_uvicorn if os.path.isfile(venv_uvicorn) else "uvicorn"
        
        with open(UVICORN_LOG, "a") as logf:
            p = subprocess.Popen(
                [uvicorn_bin, "main:app", "--host", "0.0.0.0", "--port", "8080"],
                cwd=backend_dir,
                stdout=logf,
                stderr=logf
            )
            with open(UVICORN_PID, "w") as pf:
                pf.write(str(p.pid))

    # 2. Start Cloudflared if token is provided or installed as service
    cloudflared_token = os.getenv("CLOUDFLARED_TOKEN", "")
    if cloudflared_token and not get_pid(CLOUDFLARED_PID):
        with open(CLOUDFLARED_LOG, "a") as logf:
            p = subprocess.Popen(
                ["cloudflared", "tunnel", "run", "--token", cloudflared_token],
                cwd=BASE_DIR,
                stdout=logf,
                stderr=logf
            )
            with open(CLOUDFLARED_PID, "w") as pf:
                pf.write(str(p.pid))

    # 3. Start kdb+ if q binary exists
    q_bin = subprocess.run(["which", "q"], capture_output=True, text=True).stdout.strip()
    if q_bin and not is_port_open(5010):
        tick_dir = os.path.join(BASE_DIR, "tickdb")
        with open(KDB_LOG, "a") as logf:
            # Tickerplant
            p_tp = subprocess.Popen([q_bin, "tick.q", "-p", "5010"], cwd=tick_dir, stdout=logf, stderr=logf)
            with open(KDB_TP_PID, "w") as pf:
                pf.write(str(p_tp.pid))
            time.sleep(1)
            # RDB
            p_rdb = subprocess.Popen([q_bin, "r.q", "-p", "5011"], cwd=tick_dir, stdout=logf, stderr=logf)
            with open(KDB_RDB_PID, "w") as pf:
                pf.write(str(p_rdb.pid))
            # Feed Handler
            feed_py = os.path.join(tick_dir, "feed.py")
            if os.path.isfile(feed_py):
                p_feed = subprocess.Popen([sys.executable, feed_py], cwd=BASE_DIR, stdout=logf, stderr=logf)
                with open(FEED_PID, "w") as pf:
                    pf.write(str(p_feed.pid))

def get_log_last_errors(log_file, lines=5):
    if not os.path.isfile(log_file):
        return []
    try:
        with open(log_file, "r", errors="ignore") as f:
            all_lines = f.readlines()
        error_lines = [l.strip() for l in all_lines if "ERROR" in l or "Error" in l or "Traceback" in l or "CRITICAL" in l]
        return error_lines[-lines:]
    except Exception:
        return []

def view_logs(log_file, title):
    os.system("clear")
    print("=" * 80)
    print(f" LOG VIEWER: {title} ({log_file})")
    print("=" * 80)
    if os.path.isfile(log_file):
        os.system(f"tail -n 40 '{log_file}'")
    else:
        print(" [INFO] Log file does not exist yet.")
    print("\n" + "=" * 80)
    input(" Press [Enter] to return to main menu...")

def run_update_pipeline():
    os.system("clear")
    print("=" * 80)
    print(" EXECUTING DATA UPDATE PIPELINE (--force)")
    print("=" * 80)
    update_script = os.path.join(BASE_DIR, "scripts", "update_data.sh")
    if os.path.isfile(update_script):
        cmd = f"bash '{update_script}' --force"
        proc = subprocess.Popen(cmd, shell=True, cwd=BASE_DIR)
        proc.wait()
    else:
        print(f" [ERROR] Script not found: {update_script}")
    print("\n" + "=" * 80)
    input(" Press [Enter] to return to main menu...")

def open_interactive_terminal():
    os.system("clear")
    print("=" * 80)
    print(" INTERACTIVE SUB-SHELL")
    print(" Type 'exit' and press Enter to return to the Finugreek Dashboard.")
    print("=" * 80)
    shell = os.getenv("SHELL", "/bin/bash")
    subprocess.run([shell], cwd=BASE_DIR)

def draw_menu(selected_idx, menu_items):
    os.system("clear")
    dataset_name, last_updated, size_mb = detect_active_dataset()
    
    # Check daemon health status
    uvicorn_status = "[ONLINE]" if is_port_open(8080) else "[OFFLINE]"
    kdb_status = "[ONLINE]" if is_port_open(5010) else "[OFFLINE]"
    cloudflared_active = get_pid(CLOUDFLARED_PID) or is_port_open(443)
    cloudflared_status = "[ONLINE]" if cloudflared_active else "[INACTIVE/SYSTEMD]"

    print("+" + "-" * 78 + "+")
    print("| FINUGREEK QUANT & ANALYTICS — SYSTEM CONTROL DASHBOARD".ljust(79) + "|")
    print("+" + "-" * 78 + "+")
    print(f"| ACTIVE DATASET : {dataset_name}".ljust(79) + "|")
    print(f"| LAST UPDATED   : {last_updated} (Size: {size_mb})".ljust(79) + "|")
    print("+" + "-" * 78 + "+")
    print(f"| SERVICE STATUS : Uvicorn: {uvicorn_status} | Cloudflared: {cloudflared_status} | kdb+: {kdb_status}".ljust(79) + "|")
    print("+" + "-" * 78 + "+")

    # Check for active errors across daemons
    uv_errs = get_log_last_errors(UVICORN_LOG, lines=1)
    cf_errs = get_log_last_errors(CLOUDFLARED_LOG, lines=1)
    kdb_errs = get_log_last_errors(KDB_LOG, lines=1)

    if uv_errs or cf_errs or kdb_errs:
        print("| ALERT - RECENT DAEMON ERRORS DETECTED:".ljust(79) + "|")
        if uv_errs:
            print(f"|   [Uvicorn]    : {uv_errs[0][:60]}".ljust(79) + "|")
        if cf_errs:
            print(f"|   [Cloudflared]: {cf_errs[0][:60]}".ljust(79) + "|")
        if kdb_errs:
            print(f"|   [kdb+]       : {kdb_errs[0][:60]}".ljust(79) + "|")
        print("+" + "-" * 78 + "+")

    print("| SELECT ACTION:".ljust(79) + "|")
    for i, item in enumerate(menu_items):
        prefix = " > " if i == selected_idx else "   "
        line = f"{prefix}{item}"
        print(f"| {line}".ljust(79) + "|")
    print("+" + "-" * 78 + "+")
    print("| Up/Down Arrow: Navigate | Enter: Select | Q: Exit".ljust(79) + "|")
    print("+" + "-" * 78 + "+")

def main():
    start_daemon_services()
    
    menu_items = [
        "Main Status & Refresh Health Monitor",
        "Cloudflared Logs",
        "Uvicorn API Logs",
        "kdb+ / Feed Logs",
        "Run Data Update Pipeline (--force)",
        "Open Interactive Terminal",
        "Stop All Background Services & Exit",
        "Exit Dashboard (Keep Services Running)"
    ]
    
    selected_idx = 0

    while True:
        draw_menu(selected_idx, menu_items)
        key = get_key()

        if key == 'UP':
            selected_idx = (selected_idx - 1) % len(menu_items)
        elif key == 'DOWN':
            selected_idx = (selected_idx + 1) % len(menu_items)
        elif key == 'ENTER':
            choice = menu_items[selected_idx]
            if "Main Status" in choice:
                start_daemon_services()
            elif "Cloudflared Logs" in choice:
                view_logs(CLOUDFLARED_LOG, "Cloudflared Tunnel")
            elif "Uvicorn API Logs" in choice:
                view_logs(UVICORN_LOG, "Uvicorn FastAPI")
            elif "kdb+" in choice:
                view_logs(KDB_LOG, "kdb+ Tickerplant & RDB")
            elif "Run Data Update" in choice:
                run_update_pipeline()
            elif "Open Interactive Terminal" in choice:
                open_interactive_terminal()
            elif "Stop All Background Services" in choice:
                stop_pid(UVICORN_PID)
                stop_pid(CLOUDFLARED_PID)
                stop_pid(KDB_TP_PID)
                stop_pid(KDB_RDB_PID)
                stop_pid(FEED_PID)
                print("\nAll background services stopped.")
                sys.exit(0)
            elif "Exit Dashboard" in choice:
                print("\nExiting dashboard control. Background services remain running.")
                sys.exit(0)
        elif key == 'QUIT':
            sys.exit(0)

if __name__ == "__main__":
    main()
