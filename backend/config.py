"""
Configuration settings for the AgroEdge Telemetry & ML Pipeline.
Supports standard environment variables, .env file loading, and production presets.
"""
import os
from pathlib import Path

# Attempt to load .env file from workspace root if python-dotenv is available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Application Environment (development, production, staging, testing)
APP_ENV = os.getenv("APP_ENV", "production").lower()

# Network Binding Settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
WORKERS = int(os.getenv("WORKERS", "1"))
RELOAD = os.getenv("RELOAD", "false").lower() in ("true", "1", "yes")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").lower()

# Cross-Origin Resource Sharing (CORS)
# Supports comma-separated list: "https://agroedge.org,https://command.agroedge.org" or "*"
_cors_raw = os.getenv("CORS_ORIGINS", "*")
if _cors_raw == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [item.strip() for item in _cors_raw.split(",") if item.strip()]

# Geospatial default bounds (centered around India / South Asia, customizable)
DEFAULT_CENTER_LAT = float(os.getenv("DEFAULT_CENTER_LAT", "20.5937"))
DEFAULT_CENTER_LNG = float(os.getenv("DEFAULT_CENTER_LNG", "78.9629"))

# Maximum allowable image payload size (Default: 15MB raw upload cap)
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(15 * 1024 * 1024)))

# Pre-seeded Historical Sample Telemetry (Set to "false" in production for clean database)
SEED_SAMPLE_DATA = os.getenv("SEED_SAMPLE_DATA", "true").lower() in ("true", "1", "yes")



