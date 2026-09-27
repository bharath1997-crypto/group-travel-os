"""Live map discovery layer — Overpass bbox proxy."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.services.live_map_layer_service import LiveMapLayerService
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(tags=["Live Map Layer"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.get("/live/layer")
async def get_live_discovery_layer(
    request: Request,
    response: Response,
    south: float = Query(..., ge=-90, le=90),
    west: float = Query(..., ge=-180, le=180),
    north: float = Query(..., gt=-90, le=90),
    east: float = Query(..., ge=-180, le=180),
    cats: str | None = Query(None, description="Comma-separated taxonomy keys"),
    zoom: float | None = Query(None, ge=0, le=22),
    db: Session = Depends(get_db),
):
    if south >= north:
        AppException.bad_request("Invalid bbox")
    cat_list = [c.strip() for c in (cats or "").split(",") if c.strip()] or None
    try:
        points, cached, err = await LiveMapLayerService.fetch_layer_points(
            db,
            south=south,
            west=west,
            north=north,
            east=east,
            cats=cat_list,
            client_ip=_client_ip(request),
            zoom=zoom,
        )
    except HTTPException as exc:
        msg = str(exc.detail)
        if exc.status_code == 400 and ("rate" in msg.lower() or "429" in msg.lower()):
            response.status_code = 429
            return {"points": [], "error": "layer unavailable · try again", "cached": False}
        raise
    except Exception:
        response.status_code = 503
        return {"points": [], "error": "layer unavailable · try again", "cached": False}

    if err:
        response.status_code = 503
        return {"points": [], "error": err, "cached": cached}

    response.headers["Cache-Control"] = "public, max-age=604800"
    return {"points": points, "cached": cached, "error": None}
