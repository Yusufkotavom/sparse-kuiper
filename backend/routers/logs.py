import os
from fastapi import APIRouter, HTTPException
from backend.core.logger import logger

router = APIRouter()

@router.get("/")
async def get_logs(lines: int = 200):
    """Fetch the latest lines from the application log file."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_file = os.path.join(base_dir, "data", "logs", "app.log")
    
    if not os.path.exists(log_file):
        return {"logs": ["Log file not found or empty."]}
        
    try:
        # Read the last N lines efficiently
        with open(log_file, "rb") as f:
            # We move to the end and read backwards, but for simplicity we can just readlines and slice if the file isn't huge.
            # To handle large files better without reading all to memory:
            f.seek(0, 2)
            filesize = f.tell()
            buffer_size = 8192
            blocks = []
            lines_found = 0
            position = filesize
            
            while position > 0 and lines_found < lines:
                read_size = min(buffer_size, position)
                position -= read_size
                f.seek(position)
                block = f.read(read_size)
                blocks.append(block)
                lines_found += block.count(b'\n')
                
            data = b''.join(reversed(blocks))
            # Decode and split by lines, then take the last N lines
            all_lines = data.decode('utf-8', errors='replace').split('\n')
            last_lines = all_lines[-lines:] if len(all_lines) >= lines else all_lines
            
            # Remove trailing empty strings if any
            if last_lines and last_lines[-1] == "":
                last_lines.pop()
                
            return {"logs": last_lines}
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        raise HTTPException(status_code=500, detail="Could not read log file.")
