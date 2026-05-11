"""APScheduler entrypoint for proactive flight-deal scans."""

from app.services.deal_scanner_service import DealScannerService
from app.utils.database import SessionLocal


def run_weekly_scan_job() -> None:
    db = SessionLocal()
    try:
        DealScannerService().run_weekly_scan(db)
    finally:
        db.close()
