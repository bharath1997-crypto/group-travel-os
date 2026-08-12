"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Globe2,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import type { FlightPlaceSuggestion } from "@/lib/flight-places-api";
import {
  fetchAirportCities,
  fetchAirportCountries,
  fetchAirportRegions,
  fetchAirportsForCity,
  formatExploreLocationLine,
  formatPlaceDetail,
  placeTypeLabel,
} from "@/lib/flight-places-api";

type ExploreStep =
  | { kind: "countries" }
  | { kind: "regions"; country: { code: string; name: string } }
  | { kind: "cities"; country: { code: string; name: string }; region?: { code: string; name: string } }
  | {
      kind: "airports";
      country: { code: string; name: string };
      region?: { code: string; name: string };
      city: { name: string };
    };

type Props = {
  onSelect: (item: FlightPlaceSuggestion) => void;
  onClose: () => void;
};

function CornerBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-700">
      {label}
    </span>
  );
}

export default function FlightExploreAirports({ onSelect, onClose }: Props) {
  const [step, setStep] = useState<ExploreStep>({ kind: "countries" });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Awaited<ReturnType<typeof fetchAirportCountries>>>([]);
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchAirportRegions>>>([]);
  const [cities, setCities] = useState<Awaited<ReturnType<typeof fetchAirportCities>>>([]);
  const [airports, setAirports] = useState<FlightPlaceSuggestion[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  }, []);

  const breadcrumbs = useMemo(() => {
    const crumbs: string[] = ["Explore airports"];
    if (step.kind === "regions") crumbs.push(step.country.name);
    if (step.kind === "cities") {
      crumbs.push(step.country.name);
      if (step.region) crumbs.push(step.region.name);
    }
    if (step.kind === "airports") {
      crumbs.push(step.country.name);
      if (step.region) crumbs.push(step.region.name);
      crumbs.push(step.city.name);
    }
    return crumbs;
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (step.kind === "countries") {
          setCountries(await fetchAirportCountries());
        } else if (step.kind === "regions") {
          const rows = await fetchAirportRegions(step.country.code);
          if (cancelled) return;
          if (rows.length === 0) {
            setStep({ kind: "cities", country: step.country });
            return;
          }
          setRegions(rows);
        } else if (step.kind === "cities") {
          setCities(
            await fetchAirportCities(step.country.code, step.region?.code),
          );
        } else if (step.kind === "airports") {
          setAirports(
            await fetchAirportsForCity(
              step.country.code,
              step.city.name,
              step.region?.code,
              50,
              userCoords ?? undefined,
            ),
          );
        }
      } catch {
        if (!cancelled) setError("Could not load airports. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [step, userCoords]);

  const goBack = useCallback(() => {
    if (step.kind === "countries") {
      onClose();
      return;
    }
    if (step.kind === "regions") {
      setStep({ kind: "countries" });
      return;
    }
    if (step.kind === "cities") {
      if (step.region) {
        setStep({ kind: "regions", country: step.country });
      } else {
        setStep({ kind: "countries" });
      }
      return;
    }
    if (step.kind === "airports") {
      setStep({
        kind: "cities",
        country: step.country,
        region: step.region,
      });
    }
  }, [onClose, step]);

  const filterText = filter.trim().toLowerCase();

  return (
    <div className="flex max-h-80 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-500">{breadcrumbs.join(" › ")}</p>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter list…"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            Loading…
          </div>
        ) : null}
        {error ? <p className="px-3 py-2 text-sm text-amber-800">{error}</p> : null}

        {!loading && step.kind === "countries"
          ? countries
              .filter(
                (row) =>
                  !filterText ||
                  row.name.toLowerCase().includes(filterText) ||
                  row.code.toLowerCase().includes(filterText),
              )
              .slice(0, 80)
              .map((row) => (
                <button
                  key={row.code}
                  type="button"
                  onClick={() => setStep({ kind: "regions", country: { code: row.code, name: row.name } })}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Globe2 className="h-4 w-4 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.name}</span>
                    <span className="block text-xs text-slate-500">{row.airport_count} airports</span>
                  </span>
                  <CornerBadge label={row.code} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))
          : null}

        {!loading && step.kind === "regions"
          ? regions
              .filter(
                (row) =>
                  !filterText ||
                  row.name.toLowerCase().includes(filterText) ||
                  row.region_code?.toLowerCase().includes(filterText) ||
                  row.sample_cities?.toLowerCase().includes(filterText) ||
                  row.code.toLowerCase().includes(filterText),
              )
              .map((row) => (
                <button
                  key={row.code}
                  type="button"
                  onClick={() =>
                    setStep({
                      kind: "cities",
                      country: step.country,
                      region: { code: row.code, name: row.name },
                    })
                  }
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {row.subtitle || `${row.sample_cities || ""} · ${row.airport_count} airports`}
                    </span>
                  </span>
                  {row.region_code && row.region_code !== row.name ? (
                    <CornerBadge label={row.region_code} />
                  ) : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))
          : null}

        {!loading && step.kind === "cities"
          ? cities
              .filter(
                (row) =>
                  !filterText ||
                  row.name.toLowerCase().includes(filterText) ||
                  row.region_name?.toLowerCase().includes(filterText),
              )
              .slice(0, 100)
              .map((row) => (
                <button
                  key={row.name}
                  type="button"
                  onClick={() =>
                    setStep({
                      kind: "airports",
                      country: step.country,
                      region: step.region,
                      city: { name: row.name },
                    })
                  }
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[row.region_name, `${row.airport_count} airport${row.airport_count === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))
          : null}

        {!loading && step.kind === "airports"
          ? airports
              .filter(
                (row) =>
                  !filterText ||
                  row.label.toLowerCase().includes(filterText) ||
                  row.iata.toLowerCase().includes(filterText) ||
                  row.city?.toLowerCase().includes(filterText),
              )
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect(row)}
                  className="flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-teal-50/60"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.label}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {formatExploreLocationLine(row) || formatPlaceDetail(row)} · {placeTypeLabel(row.place_type)}
                    </span>
                  </span>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {row.distance_km != null ? (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {Math.round(row.distance_km)} km
                      </span>
                    ) : null}
                    <CornerBadge label={row.iata} />
                  </div>
                </button>
              ))
          : null}
      </div>
    </div>
  );
}
