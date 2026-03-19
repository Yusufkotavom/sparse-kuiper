from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import sys
import os
import signal
import psutil
from backend.core.config import BASE_DIR
from backend.core.logger import logger
import socket
from typing import Dict, Any

router = APIRouter(prefix="/api/v1/services", tags=["services"])

# Track processes by name
running_processes: Dict[str, int] = {}

class ServiceRequest(BaseModel):
    name: str

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(('localhost', port)) == 0

def get_service_config(name: str) -> Dict[str, Any] | None:
    if name == "autocrop":
        return {
            "cmd": [sys.executable, "-m", "streamlit", "run", "run.py", "--server.port", "8501", "--server.address", "localhost"],
            "cwd": BASE_DIR / "services" / "autocrop",
            "port": 8501
        }
    elif name == "kokoro":
        # Kokoro uses its own local python
        kokoro_dir = BASE_DIR / "services" / "kokoro_NVIDIA GPU ONLY"
        return {
            "cmd": [str(kokoro_dir / "python" / "python.exe"), "scripts/gradio_v5/gradio_inf.py"],
            "cwd": kokoro_dir,
            "port": 7860
        }
    elif name == "creator-studio":
        return {
            "cmd": [sys.executable, "-m", "streamlit", "run", "app.py", "--server.port", "8502", "--server.address", "localhost"],
            "cwd": BASE_DIR / "services" / "Creator Studio",
            "port": 8502
        }
    elif name == "grok2api-studio":
        return {
            "cmd": [sys.executable, "app.py"],
            "cwd": BASE_DIR / "grok2api" / "gradio",
            "port": 7861
        }
    elif name == "studio-test":
        return {
            "cmd": [sys.executable, "-m", "streamlit", "run", "app.py", "--server.port", "8503", "--server.address", "localhost"],
            "cwd": BASE_DIR / "services" / "studio-test",
            "port": 8503
        }
    return None

@router.get("/status/{name}")
async def get_service_status(name: str):
    config = get_service_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Service not found")
    
    port = int(config["port"])
    is_running = is_port_in_use(port)
    return {"name": name, "status": "running" if is_running else "stopped", "port": port}

@router.post("/start")
async def start_service(req: ServiceRequest):
    name = req.name
    config = get_service_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Service not found")
    
    port = int(config["port"])
    if is_port_in_use(port):
        return {"status": "success", "message": f"Service {name} is already running", "port": port}

    try:
        # Detach process on Windows
        kwargs: Dict[str, Any] = {}
        if os.name == 'nt':
            # Use literal values if attributes are missing in some environments
            CREATE_NEW_PROCESS_GROUP = 0x00000200
            DETACHED_PROCESS = 0x00000008
            kwargs['creationflags'] = CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
            
        process = subprocess.Popen(
            config["cmd"],
            cwd=str(config["cwd"]),
            **kwargs
        )
        
        running_processes[name] = process.pid
        logger.info(f"[Services API] Started {name} (PID {process.pid})")
        return {"status": "success", "message": f"Service {name} started", "pid": process.pid}
    except Exception as e:
        logger.error(f"[Services API] Failed to start {name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_service(req: ServiceRequest):
    name = req.name
    config = get_service_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Service not found")
    
    port = int(config["port"])
    # Try to find and kill the process using the port
    killed = False
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            connections = proc.connections(kind='inet')
            for conn in connections:
                if conn.laddr.port == port:
                    proc.send_signal(signal.SIGTERM)
                    killed = True
                    logger.info(f"[Services API] Killed process {proc.pid} using port {port}")
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
            
    if killed:
        return {"status": "success", "message": f"Service {name} stopped"}
    else:
        return {"status": "success", "message": f"Service {name} was not running"}
