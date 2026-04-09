"use client";

import { useCallback, useState } from "react";

import { apiFetch } from "@/lib/api";

type WeatherOut = {
  temp_c: number;
  feels_like_c: number;
  description: string;
  humidity: number;
  wind_kph: number;
  cached: boolean;
};

const PRESETS = [
  { label: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { label: "Paris", lat: 48.8566, lng: 2.3522 },
  { label: "New York", lat: 40.7128, lng: -74.006 },
  { label: "Dubai", lat: 25.2048, lng: 55.2708 },
  { label: "Sydney", lat: -33.8688, lng: 151.2093 },
];

function todayYmd(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isUpgradeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("402") ||
    m.includes("payment") ||
    m.includes("pass_3day") ||
    m.includes("plan or higher")
  );
}

export default function WeatherPage() {
  const [lat, setLat] = useState("40.7128");
  const [lng, setLng] = useState("-74.006");
  const [date, setDate] = useState(todayYmd);
  const [result, setResult] = useState<WeatherOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    setShowUpgrade(false);
    setResult(null);
    setLoading(true);
    try {
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      if (Number.isNaN(latN) || Number.isNaN(lngN)) {
        setError("Please enter valid latitude and longitude.");
        return;
      }
      const qs = new URLSearchParams({
        lat: String(latN),
        lng: String(lngN),
        date,
      });
      const data = await apiFetch<WeatherOut>(`/weather/forecast?${qs}`);
      setResult(data);
    } catch (e) {
      if (isUpgradeError(e)) {
        setShowUpgrade(true);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Request failed");
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lng, date]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Weather</h1>
      <p className="mt-1 text-sm text-gray-600">
        Forecast for coordinates and date (requires pass_3day on your account).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setLat(String(p.lat));
              setLng(String(p.lng));
            }}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        className="mt-6 max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lat"
              className="block text-xs font-medium text-gray-700"
            >
              Latitude
            </label>
            <input
              id="lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="lng"
              className="block text-xs font-medium text-gray-700"
            >
              Longitude
            </label>
            <input
              id="lng"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="wdate"
            className="block text-xs font-medium text-gray-700"
          >
            Date
          </label>
          <input
            id="wdate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Get forecast"}
        </button>
      </form>

      {showUpgrade ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Upgrade required</p>
          <p className="mt-1">
            Weather forecasts need at least the <strong>pass_3day</strong> plan.
            Upgrade your subscription to unlock this feature.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-red-700">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-6 max-w-md rounded-xl border border-sky-100 bg-sky-50/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Forecast</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Temperature</dt>
              <dd className="font-medium text-gray-900">
                {result.temp_c.toFixed(1)} °C
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Feels like</dt>
              <dd className="font-medium text-gray-900">
                {result.feels_like_c.toFixed(1)} °C
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Conditions</dt>
              <dd className="font-medium capitalize text-gray-900">
                {result.description}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Humidity</dt>
              <dd className="font-medium text-gray-900">{result.humidity}%</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Wind</dt>
              <dd className="font-medium text-gray-900">
                {result.wind_kph.toFixed(1)} km/h
              </dd>
            </div>
          </dl>
          {result.cached ? (
            <p className="mt-3 text-xs text-gray-500">Cached response</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
