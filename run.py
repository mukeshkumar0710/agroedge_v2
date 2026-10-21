"""
Unified Runner Script for the Full-Stack Edge PWA & Geospatial Command Hub.
Supports development auto-reload and production multi-worker execution.
"""
import sys
import uvicorn
from backend.config import HOST, PORT, WORKERS, RELOAD, LOG_LEVEL, APP_ENV

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    print("=" * 70)
    print("  * AGROEDGE TELEMETRY & COMMAND PLATFORM")
    print("=" * 70)
    print(f"  * Environment:                 {APP_ENV.upper()}")
    print(f"  * Mobile PWA Field Client:     http://localhost:{PORT}/")
    print(f"  * Government Command Center:   http://localhost:{PORT}/dashboard")
    print(f"  * REST & SSE API Swagger Docs: http://localhost:{PORT}/docs")
    print(f"  * Workers:                     {WORKERS if not RELOAD else '1 (reload mode)'}")
    print(f"  * Auto-Reload:                 {RELOAD}")
    print("=" * 70)

    # Note: Uvicorn requires workers=1 when reload=True
    if RELOAD:
        uvicorn.run("backend.app:app", host=HOST, port=PORT, reload=True, log_level=LOG_LEVEL, proxy_headers=True, forwarded_allow_ips="*")
    else:
        uvicorn.run("backend.app:app", host=HOST, port=PORT, reload=False, workers=WORKERS, log_level=LOG_LEVEL, proxy_headers=True, forwarded_allow_ips="*")


