"""
run.py — Development server entrypoint

Usage:
    python run.py

This starts uvicorn; reload follows DEBUG in settings.
Do NOT use this in production — use gunicorn or a process manager instead.
"""
import logging

import uvicorn

from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
