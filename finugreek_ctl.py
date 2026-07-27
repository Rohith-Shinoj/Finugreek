#!/usr/bin/env python3
import os
import sys
import time
import socket
import signal
import tty
import termios
import subprocess
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
PID_DIR = os.path.join(BASE_DIR, ".pids")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PID_DIR, exist_ok=True)

# Log files
UVICORN_LOG = os.path.join(LOG_DIR, "uvicorn.log")
CLOUDFLARED_LOG = os.path.join(LOG_DIR, "cloudflared.log")
KDB_LOG = os.path.join(LOG_DIR, "kdb.log")
PIPELINE_LOG = os.path.join(LOG_DIR, "update_pipeline.log")

# PID files
UVICORN_PID = os.path.join(PID_DIR, "uvicorn.pid")
CLOUDFLARED_PID = os.path.join(PID_DIR, "cloudflared.pid")
KDB_TP_PID = os.path.join(PID_DIR, "tickerplant.pid")
KDB_RDB_PID = os.path.join(PID_DIR, "rdb.pid")
FEED_PID = os.path.join(PID_DIR, "feed.pid")

# System State
state = {
    "running": True,
    "last_error": None,
    "selected_idx": 0,
    "uvicorn_status": "OFFLINE",
    "cloudflared_status": "OFFLINE",
    "kdb_status": "OFFLINE"
}

MENU_OPTIONS = [
    "Main Status & Health Monitor",
    "Start / Restart All Daemons",
    "Stop All Daemons",
    "Cloudflared Logs",
    "Uvicorn Logs",
    "kdb+ Logs",
    "Run Data Update Pipeline",
    "Open Terminal Shell",
    "Exit"
]

def load_env_token():
    """Parses CLOUDFLARE_TUNNEL_TOKEN or CLOUDFLARE_TOKEN from .env file."""
    env_path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return None
    try:
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or not line or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'").strip('"')
                if k in ["CLOUDFLARE_TUNNEL_TOKEN", "CLOUDFLARE_TOKEN", "TUNNEL_TOKEN"]:
                    return v
    except Exception:
        pass
    return None

def check_port(host, port, timeout=0.5):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def is_pid_running(pid_file):
    if not os.path.exists(pid_file):
        return False
    try:
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)
        return True
    except Exception:
        return False

def kill_pid(pid_file):
    if os.path.exists(pid_file):
        try:
            with open(pid_file, "r") as f:
                pid = int(f.read().strip())
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.3)
            if is_pid_running(pid_file):
                os.kill(pid, signal.SIGKILL)
        except Exception:
            pass
        try:
            os.remove(pid_file)
        except Exception:
            pass

def stop_all_daemons():
    kill_pid(UVICORN_PID)
    kill_pid(CLOUDFLARED_PID)
    kill_pid(KDB_TP_PID)
    kill_pid(KDB_RDB_PID)
    kill_pid(FEED_PID)

def start_uvicorn_daemon():
    if is_pid_running(UVICORN_PID) or check_port("127.0.0.1", 8080):
        return
    backend_dir = os.path.join(BASE_DIR, "backend")
    f_log = open(UVICORN_LOG, "a")
    cmd = ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
    proc = subprocess.Popen(cmd, cwd=backend_dir, stdout=f_log, stderr=f_log, preexec_fn=os.setsid)
    with open(UVICORN_PID, "w") as f:
        f.write(str(proc.pid))

def start_cloudflared_daemon():
    if is_pid_running(CLOUDFLARED_PID):
        return
    token = load_env_token()
    if not token:
        with open(CLOUDFLARED_LOG, "a") as f:
            f.write(f"[{datetime.now()}] ERROR: CLOUDFLARE_TUNNEL_TOKEN not found in .env file\n")
        return
    f_log = open(CLOUDFLARED_LOG, "a")
    cmd = ["cloudflared", "tunnel", "run", "--protocol", "http2", "--token", token]
    proc = subprocess.Popen(cmd, cwd=BASE_DIR, stdout=f_log, stderr=f_log, preexec_fn=os.setsid)
    with open(CLOUDFLARED_PID, "w") as f:
        f.write(str(proc.pid))

def start_kdb_daemons():
    tickdb_dir = os.path.join(BASE_DIR, "tickdb")
    f_log = open(KDB_LOG, "a")
    
    # Check if q is available
    q_bin = subprocess.run(["which", "q"], capture_output=True, text=True)
    if q_bin.returncode != 0:
        f_log.write(f"[{datetime.now()}] WARNING: q (kdb+) binary not found in PATH. Skipping kdb+.\n")
        f_log.close()
        return

    # 1. Tickerplant (5010)
    if not is_pid_running(KDB_TP_PID) and not check_port("127.0.0.1", 5010):
        tp_cmd = ["q", "tick.q", "-p", "5010"]
        proc_tp = subprocess.Popen(tp_cmd, cwd=tickdb_dir, stdout=f_log, stderr=f_log, preexec_fn=os.setsid)
        with open(KDB_TP_PID, "w") as f:
            f.write(str(proc_tp.pid))
        time.sleep(1)

    # 2. RDB (5011)
    if not is_pid_running(KDB_RDB_PID) and not check_port("127.0.0.1", 5011):
        rdb_cmd = ["q", "r.q", "-p", "5011"]
        proc_rdb = subprocess.Popen(rdb_cmd, cwd=tickdb_dir, stdout=f_log, stderr=f_log, preexec_fn=os.setsid)
        with open(KDB_RDB_PID, "w") as f:
            f.write(str(proc_rdb.pid))
        time.sleep(1)

    # 3. Binance Feed Handler
    if not is_pid_running(FEED_PID):
        feed_py = os.path.join(BASE_DIR, "tickdb", "feed.py")
        if os.path.exists(feed_py):
            feed_cmd = [sys.executable, feed_py]
            proc_feed = subprocess.Popen(feed_cmd, cwd=BASE_DIR, stdout=f_log, stderr=f_log, preexec_fn=os.setsid)
            with open(FEED_PID, "w") as f:
                f.write(str(proc_feed.pid))

def start_all_daemons():
    start_uvicorn_daemon()
    start_cloudflared_daemon()
    start_kdb_daemons()

def get_active_dataset_info():
    active_link = os.path.join(BASE_DIR, "datasets", "active")
    if not os.path.exists(active_link):
        return "No active dataset link found", "N/A"
    try:
        target = os.readlink(active_link)
        folder_name = os.path.basename(target)
        if folder_name.startswith("run_"):
            raw_ts = folder_name.replace("run_", "")
            try:
                dt = datetime.strptime(raw_ts, "%Y%m%d_%H%M%S")
                formatted_ts = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                formatted_ts = raw_ts
        else:
            formatted_ts = "Custom Snapshot"
        
        parquet_path = os.path.join(BASE_DIR, "datasets", folder_name, "market_data.parquet")
        if os.path.exists(parquet_path):
            size_mb = os.path.getsize(parquet_path) / (1024 * 1024)
            size_str = f"{size_mb:.1f} MB"
        else:
            size_str = "Missing Parquet"
            
        return folder_name, f"{formatted_ts} ({size_str})"
    except Exception as e:
        return "Error reading dataset", str(e)

def monitor_loop():
    """Background thread to monitor services, ensure daemons are alive, and scan logs for errors."""
    log_files = [UVICORN_LOG, CLOUDFLARED_LOG, KDB_LOG]
    for log_path in log_files:
        if not os.path.exists(log_path):
            open(log_path, 'a').close()
            
    positions = {log_path: os.path.getsize(log_path) for log_path in log_files}
    
    # Auto-start daemons on launcher launch
    start_all_daemons()
    
    while state["running"]:
        # Update Service Statuses
        state["uvicorn_status"] = "ONLINE" if check_port("127.0.0.1", 8080) else "OFFLINE"
        state["cloudflared_status"] = "ONLINE" if is_pid_running(CLOUDFLARED_PID) or subprocess.run(["pgrep", "-f", "cloudflared"], capture_output=True).returncode == 0 else "OFFLINE"
        state["kdb_status"] = "ONLINE" if check_port("127.0.0.1", 5010) else "OFFLINE"
        
        # Scan log files for error lines
        for log_path in log_files:
            try:
                if not os.path.exists(log_path):
                    continue
                curr_size = os.path.getsize(log_path)
                if curr_size > positions[log_path]:
                    with open(log_path, 'r', errors='ignore') as f:
                        f.seek(positions[log_path])
                        new_lines = f.readlines()
                        positions[log_path] = curr_size
                        
                    for line in new_lines:
                        line_lower = line.lower()
                        if "error" in line_lower or "exception" in line_lower or "traceback" in line_lower:
                            service_name = os.path.basename(log_path).replace('.log', '').upper()
                            state["last_error"] = f"[{service_name} ERROR] {line.strip()[:90]}"
            except Exception:
                pass
        time.sleep(1)

def get_key():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == '\x1b':
            ch2 = sys.stdin.read(1)
            ch3 = sys.stdin.read(1)
            if ch2 == '[':
                if ch3 == 'A':
                    return 'UP'
                elif ch3 == 'B':
                    return 'DOWN'
                elif ch3 == 'C':
                    return 'RIGHT'
                elif ch3 == 'D':
                    return 'LEFT'
        elif ch == '\r' or ch == '\n':
            return 'ENTER'
        elif ch == '\x03': # Ctrl+C
            return 'QUIT'
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

def render_ui():
    dataset_name, dataset_ts = get_active_dataset_info()
    all_online = (state["uvicorn_status"] == "ONLINE" and state["cloudflared_status"] == "ONLINE")
    
    buf = []
    buf.append("\033[1;1H") # Cursor home
    buf.append("================================================================================\033[K\n")
    buf.append("                      FINUGREEK SYSTEM MASTER CONTROL                           \033[K\n")
    buf.append("================================================================================\033[K\n")
    buf.append(f" Active Dataset : {dataset_name}\033[K\n")
    buf.append(f" Last Updated   : {dataset_ts}\033[K\n")
    buf.append("--------------------------------------------------------------------------------\033[K\n")
    buf.append(" SERVICE DAEMON COMMANDS & STATUS :\033[K\n")
    buf.append(f"   FastAPI Backend (8080) [uvicorn main:app --reload]      : [{state['uvicorn_status']}]\033[K\n")
    buf.append(f"   Cloudflare Tunnel      [cloudflared tunnel run --token]  : [{state['cloudflared_status']}]\033[K\n")
    buf.append(f"   kdb+ Engine     (5010) [q tick.q -p 5010]                : [{state['kdb_status']}]\033[K\n")
    buf.append("--------------------------------------------------------------------------------\033[K\n")
    
    if state["last_error"]:
        buf.append(f" ALERT: {state['last_error']}\033[K\n")
        buf.append("--------------------------------------------------------------------------------\033[K\n")
    elif not all_online:
        buf.append(" SYSTEM HEALTH : [ATTENTION] 1 or more required daemons are OFFLINE\033[K\n")
        buf.append("--------------------------------------------------------------------------------\033[K\n")
    else:
        buf.append(" SYSTEM HEALTH : All Daemons Operating Normally\033[K\n")
        buf.append("--------------------------------------------------------------------------------\033[K\n")
        
    buf.append("\n SELECT ACTION (Use Up/Down Arrow Keys and press Enter):\033[K\n\n")
    
    for idx, option in enumerate(MENU_OPTIONS):
        if idx == state["selected_idx"]:
            buf.append(f"  > [ {option.upper()} ]\033[K\n")
        else:
            buf.append(f"    {option}\033[K\n")
            
    buf.append("\n================================================================================\033[K\n")
    buf.append(" Press Ctrl+C at any time to exit control script.\033[K\n")
    
    sys.stdout.write("".join(buf))
    sys.stdout.flush()

def view_log_file(log_filename, title):
    sys.stdout.write("\033[H\033[J")
    log_path = os.path.join(LOG_DIR, log_filename)
    print(f"=================== LOG VIEWER: {title} ===================")
    print(f"File: {log_path}")
    print("--------------------------------------------------------------------------------")
    if os.path.exists(log_path):
        with open(log_path, 'r', errors='ignore') as f:
            lines = f.readlines()
            for line in lines[-25:]:
                print(line.rstrip())
    else:
        print("Log file is empty or does not exist yet.")
    print("--------------------------------------------------------------------------------")
    print("\nPress any key to return to main menu...")
    get_key()
    sys.stdout.write("\033[H\033[J")

def run_update_pipeline():
    sys.stdout.write("\033[H\033[J")
    print("=================== DATA UPDATE PIPELINE ===================")
    print("Executing python3 ./scripts/update_pipeline.py --force ...\n")
    script_path = os.path.join(BASE_DIR, "scripts", "update_pipeline.py")
    if not os.path.exists(script_path):
        print(f"Error: {script_path} not found.")
        print("\nPress any key to return...")
        get_key()
        sys.stdout.write("\033[H\033[J")
        return
        
    try:
        proc = subprocess.Popen(
            [sys.executable, script_path, "--force"],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        with open(PIPELINE_LOG, "w") as f_log:
            for line in proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
                f_log.write(line)
        proc.wait()
        print("\n--------------------------------------------------------------------------------")
        print("Pipeline Execution Finished.")
    except Exception as e:
        print(f"\nError running pipeline: {e}")
        
    print("\nPress any key to return to main menu...")
    get_key()
    sys.stdout.write("\033[H\033[J")

def open_subshell():
    sys.stdout.write("\033[H\033[J")
    print("=================== INTERACTIVE SUBSHELL ===================")
    print("Dropping into bash shell. Type 'exit' to return to control menu.\n")
    sys.stdout.flush()
    subprocess.run(["/bin/bash"], cwd=BASE_DIR)
    sys.stdout.write("\033[H\033[J")

def main():
    sys.stdout.write("\033[H\033[J")
    sys.stdout.flush()
    
    # Start background process supervisor & monitor
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()
    
    try:
        while state["running"]:
            render_ui()
            key = get_key()
            if key == 'UP':
                state["selected_idx"] = (state["selected_idx"] - 1) % len(MENU_OPTIONS)
            elif key == 'DOWN':
                state["selected_idx"] = (state["selected_idx"] + 1) % len(MENU_OPTIONS)
            elif key == 'ENTER':
                choice = MENU_OPTIONS[state["selected_idx"]]
                if choice == "Main Status & Health Monitor":
                    state["last_error"] = None
                elif choice == "Start / Restart All Daemons":
                    stop_all_daemons()
                    time.sleep(1)
                    start_all_daemons()
                elif choice == "Stop All Daemons":
                    stop_all_daemons()
                elif choice == "Cloudflared Logs":
                    view_log_file("cloudflared.log", "Cloudflared Tunnel")
                elif choice == "Uvicorn Logs":
                    view_log_file("uvicorn.log", "FastAPI / Uvicorn Backend")
                elif choice == "kdb+ Logs":
                    view_log_file("kdb.log", "kdb+ Time-Series Engine")
                elif choice == "Run Data Update Pipeline":
                    run_update_pipeline()
                elif choice == "Open Terminal Shell":
                    open_subshell()
                elif choice == "Exit":
                    state["running"] = False
            elif key == 'QUIT':
                state["running"] = False
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\033[H\033[J")
        print("Exited Finugreek Master Control.\n")

if __name__ == "__main__":
    main()
