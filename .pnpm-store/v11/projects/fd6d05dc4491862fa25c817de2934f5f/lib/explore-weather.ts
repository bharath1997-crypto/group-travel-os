import {
  type DateQuickPreset,
  formatLocalDate,
  getTodayDate,
  getWeekendRange,
} from "@/lib/explore-date-utils";

const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const MAX_FORECAST_DAYS = 16;

export type WeatherDisplay = {
  emoji: string;
  tempF: number;
  condition: string;
};

export function wmoToWeatherDisplay(code: number): { emoji: string; condition: string } {
  if (code === 0) return { emoji: "☀️", condition: "Clear" };
  if (code >= 1 && code <= 3) return { emoji: "⛅", condition: "Partly Cloudy" };
  if (code === 45 || code === 48) return { emoji: "🌫️", condition: "Foggy" };
  if (code >= 51 && code <= 67) return { emoji: "🌧️", condition: "Rainy" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", condition: "Snowy" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", condition: "Showers" };
  if (code === 95 || code === 99) return { emoji: "⛈️", condition: "Thunderstorm" };
  return { emoji: "☀️", condition: "Clear" };
}

export function celsiusToFahrenheit(tempC: number): number {
  return Math.round((tempC * 9) / 5 + 32);
}

/** Map date filter state → ISO date for weather lookup (null = live/current). */
export function resolveWeatherDate(
  selectedDate: string | null,
  preset: DateQuickPreset,
): string | null {
  if (selectedDate) return selectedDate;
  if (preset === "today") return getTodayDate();
  if (preset === "weekend") {
    const { start } = getWeekendRange();
    const friday = new Date(`${start}T00:00:00`);
    const saturday = new Date(friday);
    saturday.setDate(friday.getDate() + 1);
    return formatLocalDate(saturday);
  }
  if (preset === "week") return getTodayDate();
  return null;
}

function daysFromToday(dateStr: string): number {
  const today = new Date(`${getTodayDate()}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatWeatherChip(
  display: WeatherDisplay,
  city: string,
): string {
  return `${display.emoji} ${display.tempF}°F · ${display.condition} · ${city}`;
}

export async function fetchLocationWeather(
  lat: number,
  lng: number,
  targetDate: string | null,
): Promise<WeatherDisplay | null> {
  const today = getTodayDate();
  const useLive = !targetDate || targetDate === today;

  if (useLive) {
    const url = `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current_weather;
    if (!current) return null;
    const { emoji, condition } = wmoToWeatherDisplay(Number(current.weathercode ?? 0));
    return {
      emoji,
      tempF: celsiusToFahrenheit(Number(current.temperature)),
      condition,
    };
  }

  const daysAhead = daysFromToday(targetDate);
  if (daysAhead < 0) {
    return { emoji: "📅", tempF: 0, condition: "Past date" };
  }
  if (daysAhead > MAX_FORECAST_DAYS) {
    return { emoji: "📅", tempF: 0, condition: "Forecast unavailable" };
  }

  const forecastDays = Math.min(daysAhead + 1, MAX_FORECAST_DAYS);
  const url =
    `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&forecast_days=${forecastDays}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const times: string[] = data.daily?.time ?? [];
  const idx = times.indexOf(targetDate);
  if (idx < 0) return null;

  const hi = Number(data.daily.temperature_2m_max[idx]);
  const lo = Number(data.daily.temperature_2m_min[idx]);
  const code = Number(data.daily.weather_code[idx] ?? 0);
  const { emoji, condition } = wmoToWeatherDisplay(code);
  const avgC = (hi + lo) / 2;

  return {
    emoji,
    tempF: celsiusToFahrenheit(avgC),
    condition,
  };
}
