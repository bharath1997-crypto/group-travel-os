"""
app/routes/weather.py — Weather forecast (OpenWeatherMap)
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.models.user import User
from app.services.weather_service import WeatherService
from app.utils.auth import get_current_user
from app.utils.feature_gate import require_plan

router = APIRouter(prefix="/weather", tags=["weather"])


class WeatherOut(BaseModel):
    temp_c: float
    feels_like_c: float
    description: str
    humidity: int
    wind_kph: float
    cached: bool


def _default_forecast_date() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/forecast", response_model=WeatherOut, summary="Weather for coordinates and date")
def get_weather_forecast(
    lat: float = Query(...),
    lng: float = Query(...),
    day: date = Query(default_factory=_default_forecast_date, alias="date"),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_plan("pass_3day")),
):
    return WeatherService.get_forecast(lat, lng, day)
