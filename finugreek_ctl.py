#!/usr/bin/env python3
import os
import sys
import time
import socket
import select
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

# Log file paths
UVICORN_LOG = os.path.join(LOG_DIR, "uvicorn.log")
CLOUDFLARED_LOG = os.path.join(LOG_DIR, "cloudflared.log")
KDB_LOG = os.path.join(LOG_DIR, "kdb.log")
PIPELINE_LOG = os.path.join(LOG_DIR, "update_pipeline.log")

# System State
state = {
    "running": True,
    "last_error": None,
    "selected_idx": 0,
    "current_view": "menu"  # "menu", "logs", "pipeline", "terminal"
}

MENU_OPTIONS = [
    "Main Status & Health Monitor",
    "Cloudflared Logs",
    "Uvicorn Logs",
    "kdb+ Logs",
    "Run Data Update Pipeline",
    "Open Terminal Shell",
    "Exit"
]

def check_port(host, port, timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def get_active_dataset_info():
    active_link = os.path.join(BASE_DIR, "datasets", "active")
    if not os.path.exists(active_link):
        return "No active dataset link found", "N/A"
    try:
        target = os.readlink(active_link)
        folder_name = os.path.basename(target)
        # Extract timestamp pattern if present e.g. run_YYYYMMDD_HHMMSS
        if folder_name.startswith("run_"):
            raw_ts = folder_name.replace("run_", "")
            try:
                dt = datetime.strptime(raw_ts, "%Y%m%d_%H%M%S")
                formatted_ts = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                formatted_ts = raw_ts
        else:
            formatted_ts = "Custom Snapshot"
        
        # Check parquet size
        parquet_path = os.path.join(BASE_DIR, "datasets", folder_name, "market_data.parquet")
        if os.path.exists(parquet_path):
            size_mb = os.path.getsize(parquet_path) / (1024 * 1024)
            size_str = f"{size_mb:.1f} MB"
        else:
            size_str = "Missing Parquet"
            
        return folder_name, f"{formatted_ts} ({size_str})"
    except Exception as e:
        return "Error reading dataset", str(e)

def monitor_logs_for_errors():
    """Background thread to monitor daemon logs for explicit errors."""
    log_files = [UVICORN_LOG, CLOUDFLARED_LOG, KDB_LOG]
    for log_path in log_files:
        if not os.path.exists(log_path):
            open(log_path, 'a').close()
            
    # Track file positions
    positions = {log_path: os.path.getsize(log_path) for log_path in log_files}
    
    while state["running"]:
        time.sleep(1)
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
                            # Capture last critical error line
                            service_name = os.path.basename(log_path).replace('.log', '').upper()
                            state["last_error"] = f"[{service_name} ERROR] {line.strip()[:100]}"
            except Exception:
                pass

def get_key():
    """Reads a single keypress without requiring enter."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == '\x1b':
            # Handle arrow keys
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
    sys.stdout.write("\033[H\033[J") # Clear screen
    sys.stdout.flush()
    
    dataset_name, dataset_ts = get_active_dataset_info()
    uvicorn_ok = check_port("127.0.0.1", 8080)
    kdb_ok = check_port("127.0.0.1", 5010)
    
    print("================================================================================")
    print("                      FINUGREEK SYSTEM MASTER CONTROL                           ")
    print("================================================================================")
    print(f" Active Dataset : {dataset_name}")
    print(f" Last Updated   : {dataset_ts}")
    print("--------------------------------------------------------------------------------")
    print(" SERVICE STATUS :")
    print(f"   FastAPI Backend (8080) : [{'ONLINE' if uvicorn_ok else 'OFFLINE'}]")
    print(f"   kdb+ Engine     (5010) : [{'ONLINE' if kdb_ok else 'OFFLINE/SKIPPED'}]")
    print("--------------------------------------------------------------------------------")
    
    if state["last_error"]:
        print(f" ALERT: {state['last_error']}")
        print("--------------------------------------------------------------------------------")
    else:
        print(" SYSTEM HEALTH : All Daemons Operating Normally")
        print("--------------------------------------------------------------------------------")
        
    print("\n SELECT ACTION (Use Up/Down Arrow Keys and press Enter):\n")
    
    for idx, option in enumerate(MENU_OPTIONS):
        if idx == state["selected_idx"]:
            print(f"  > [ {option.upper()} ]")
        else:
            print(f"    {option}")
            
    print("\n================================================================================")
    print(" Press Ctrl+C at any time to exit control script.")
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
            for line in lines[-25:]: # Show last 25 lines
                print(line.rstrip())
    else:
        print("Log file is empty or does not exist yet.")
    print("--------------------------------------------------------------------------------")
    print("\nPress any key to return to main menu...")
    get_key()

def run_update_pipeline():
    sys.stdout.write("\033[H\033[J")
    print("=================== DATA UPDATE PIPELINE ===================")
    print("Executing ./scripts/update_data.sh --force ...\n")
    script_path = os.path.join(BASE_DIR, "scripts", "update_data.sh")
    if not os.path.exists(script_path):
        print(f"Error: {script_path} not found.")
        print("\nPress any key to return...")
        get_key()
        return
        
    try:
        proc = subprocess.Popen(
            [script_path, "--force"],
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

def open_subshell():
    sys.stdout.write("\033[H\033[J")
    print("=================== INTERACTIVE SUBSHELL ===================")
    print("Dropping into bash. Type 'exit' to return to control menu.\n")
    sys.stdout.flush()
    subprocess.run(["/bin/bash"], cwd=BASE_DIR)

def main():
    # Start background error monitoring thread
    monitor_thread = threading.Thread(target=monitor_logs_for_errors, daemon=True)
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
                    state["last_error"] = None # Clear alert
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
