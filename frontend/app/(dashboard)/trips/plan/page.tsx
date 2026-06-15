"use client";

import dynamic from "next/dynamic";
import L from "leaflet";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, MapPin, X } from "lucide-react";

import { Stepper } from "@/components/trips";
import { apiFetch, apiFetchWithStatus } from "@/lib/api";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const FitBounds = dynamic(
  () =>
    Promise.all([import("react-leaflet"), import("react")]).then(
      ([leaf, React]) => {
        function Inner({ points }: { points: [number, number][] }) {
          const map = leaf.useMap();
          React.useEffect(() => {
            if (points.length === 0) return;
            const b = L.latLngBounds(points);
            map.fitBounds(b, { padding: [50, 50] });
          }, [map, points]);
          return null;
        }
        return Inner;
      },
    ),
  { ssr: false },
);

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";
const BG = "#F8F9FA";

type TripType = "business" | "leisure";
type TransportMode = "car" | "train" | "flight" | "bus";

type PlannerLocation = {
  id: string;
  place_name: string;
  full_address: string;
  lat: number;
  lng: number;
  place_id: string;
  arrival_date: string | null;
};

type PlaceSuggestion = {
  place_id: string;
  place_name: string;
  full_address: string;
  lat?: number;
  lng?: number;
};

const MAX_STOPS = 7;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

type Leg = {
  from: string;
  to: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  distanceKm: number;
};

type GroupRow = { id: string; name: string };

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function suggestTransport(d: number): TransportMode {
  if (d < 150) return "car";
  if (d < 500) return "train";
  return "flight";
}

function estCostForLeg(d: number, mode: TransportMode): number {
  switch (mode) {
    case "car":
      return Math.round(d * 8);
    case "bus":
      return Math.round(d * 0.6);
    case "train":
      return Math.round(d * 1.5);
    case "flight":
      return 4000;
    default:
      return Math.round(d * 8);
  }
}

function formatArrivalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ArrivalDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative mt-1 max-w-xs">
      <button
        type="button"
        onClick={openPicker}
        aria-label="Select arrival date from calendar"
        className="flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:border-[#0F766E]/40 hover:bg-[#F8FAFC]"
        style={{ borderColor: BORDER, color: "#2C3E50" }}
      >
        <Calendar size={16} className="shrink-0 text-[#0F766E]" strokeWidth={2} />
        <span className={value ? "text-[#2C3E50]" : "text-[#94A3B8]"}>
          {value ? formatArrivalDate(value) : "Select from calendar"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

function hasValidCoords(lat: number, lng: number): boolean {
  return lat !== 0 && lng !== 0 && !Number.isNaN(lat) && !Number.isNaN(lng);
}

function buildLegs(locs: PlannerLocation[]): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < locs.length; i++) {
    const prev = locs[i - 1];
    const cur = locs[i];
    const distanceKm = Math.round(haversineKm(prev.lat, prev.lng, cur.lat, cur.lng));
    out.push({
      from: prev.place_name,
      to: cur.place_name,
      fromLat: prev.lat,
      fromLng: prev.lng,
      toLat: cur.lat,
      toLng: cur.lng,
      distanceKm,
    });
  }
  return out;
}

type NominatimRow = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  place_id?: number;
  osm_id?: number;
};

function mapNominatimRows(rows: NominatimRow[]): PlaceSuggestion[] {
  return rows.slice(0, 5).map((r) => ({
    place_id: String(r.place_id ?? r.osm_id ?? `${r.lat},${r.lon}`),
    place_name: r.name || r.display_name.split(",")[0],
    full_address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

async function nominatimSearch(q: string): Promise<PlaceSuggestion[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  try {
    const rows = await apiFetch<NominatimRow[]>(
      `/geocoding/search?q=${encodeURIComponent(query)}`,
    );
    if (!Array.isArray(rows)) return [];
    return mapNominatimRows(rows);
  } catch {
    return [];
  }
}

type GooglePredictionsResult = {
  hits: PlaceSuggestion[];
  blocked: boolean;
};

function googlePlacesPredictions(query: string): Promise<GooglePredictionsResult> {
  return new Promise((resolve) => {
    const g = (window as { google?: { maps?: { places?: unknown } } }).google;
    const places = g?.maps?.places as
      | {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string },
              cb: (
                predictions: Array<{
                  place_id: string;
                  description: string;
                  structured_formatting?: {
                    main_text: string;
                    secondary_text?: string;
                  };
                }> | null,
                status: string,
              ) => void,
            ) => void;
          };
          PlacesServiceStatus: { OK: string; ZERO_RESULTS: string };
        }
      | undefined;
    if (!places?.AutocompleteService) {
      resolve({ hits: [], blocked: false });
      return;
    }
    const svc = new places.AutocompleteService();
    svc.getPlacePredictions({ input: query }, (predictions, status) => {
      if (status === "REQUEST_DENIED") {
        resolve({ hits: [], blocked: true });
        return;
      }
      if (
        status !== places.PlacesServiceStatus.OK ||
        !predictions?.length
      ) {
        resolve({ hits: [], blocked: false });
        return;
      }
      resolve({
        blocked: false,
        hits: predictions.slice(0, 5).map((p) => ({
          place_id: p.place_id,
          place_name:
            p.structured_formatting?.main_text ||
            p.description.split(",")[0] ||
            p.description,
          full_address: p.structured_formatting?.secondary_text
            ? `${p.structured_formatting.main_text}, ${p.structured_formatting.secondary_text}`
            : p.description,
        })),
      });
    });
  });
}

function googlePlaceDetails(placeId: string): Promise<{
  lat: number;
  lng: number;
  place_name: string;
  full_address: string;
} | null> {
  return new Promise((resolve) => {
    const g = (window as { google?: { maps?: { places?: unknown } } }).google;
    const places = g?.maps?.places as
      | {
          PlacesService: new (el: HTMLElement) => {
            getDetails: (
              req: { placeId: string; fields: string[] },
              cb: (
                result: {
                  name?: string;
                  formatted_address?: string;
                  geometry?: { location?: { lat: () => number; lng: () => number } };
                } | null,
                status: string,
              ) => void,
            ) => void;
          };
          PlacesServiceStatus: { OK: string };
        }
      | undefined;
    if (!places?.PlacesService) {
      resolve(null);
      return;
    }
    const host = document.createElement("div");
    const svc = new places.PlacesService(host);
    svc.getDetails(
      { placeId, fields: ["geometry", "name", "formatted_address"] },
      (result, status) => {
        if (status !== places.PlacesServiceStatus.OK || !result?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve({
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
          place_name: result.name || "",
          full_address: result.formatted_address || result.name || "",
        });
      },
    );
  });
}

function buildDescriptionPayload(
  tripType: TripType,
  locations: PlannerLocation[],
  legs: Leg[],
  transport: TransportMode[],
  totalDistance: number,
  totalCost: number,
): string {
  const payload = {
    v: 1,
    type: tripType,
    locations: locations.map((l) => ({
      id: l.id,
      place_name: l.place_name,
      full_address: l.full_address,
      lat: Math.round(l.lat * 1e5) / 1e5,
      lng: Math.round(l.lng * 1e5) / 1e5,
      place_id: l.place_id,
      arrival_date: l.arrival_date,
    })),
    legs: legs.map((g, i) => ({
      f: g.from,
      t: g.to,
      d: g.distanceKm,
      tr: transport[i] ?? suggestTransport(g.distanceKm),
    })),
    td: Math.round(totalDistance),
    ec: Math.round(totalCost),
  };
  let s = JSON.stringify(payload);
  if (s.length <= 1000) return s;
  return s.slice(0, 1000);
}

const STEPS = ["Type", "Locations", "Route", "Transport", "Review"];

export default function PlanTripPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [tripName, setTripName] = useState("");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState("");
  const [isGroupTrip, setIsGroupTrip] = useState<boolean | null>(null);
  const [groupTripError, setGroupTripError] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [locations, setLocations] = useState<PlannerLocation[]>([]);
  const [transport, setTransport] = useState<TransportMode[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchHits, setSearchHits] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [loadGoogleScript, setLoadGoogleScript] = useState(false);
  const [googlePlacesBlocked, setGooglePlacesBlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("gt_google_places_blocked") === "1";
    } catch {
      return false;
    }
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const legs = useMemo(() => buildLegs(locations), [locations]);

  const validLocations = useMemo(
    () => locations.filter((l) => hasValidCoords(l.lat, l.lng)),
    [locations],
  );

  const mapPoints: [number, number][] = useMemo(
    () => validLocations.map((l) => [l.lat, l.lng] as [number, number]),
    [validLocations],
  );

  const totalDistance = useMemo(() => {
    let sum = 0;
    for (let i = 1; i < locations.length; i++) {
      const a = locations[i - 1];
      const b = locations[i];
      sum += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
    return sum;
  }, [locations]);

  const totalEstCost = useMemo(() => {
    if (legs.length === 0) return 0;
    return legs.reduce((s, g, i) => {
      const m = transport[i] ?? suggestTransport(g.distanceKm);
      return s + estCostForLeg(g.distanceKm, m);
    }, 0);
  }, [legs, transport]);

  useEffect(() => {
    setTransport((prev) => {
      const n = legs.length;
      const next: TransportMode[] = [];
      for (let i = 0; i < n; i++) {
        next[i] = prev[i] ?? suggestTransport(legs[i].distanceKm);
      }
      return next;
    });
  }, [legs]);

  const disableGooglePlaces = useCallback(() => {
    setGooglePlacesBlocked(true);
    setGoogleReady(false);
    try {
      sessionStorage.setItem("gt_google_places_blocked", "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as { gm_authFailure?: () => void }).gm_authFailure = () => {
      disableGooglePlaces();
    };
    return () => {
      delete (window as { gm_authFailure?: () => void }).gm_authFailure;
    };
  }, [disableGooglePlaces]);

  useEffect(() => {
    void (async () => {
      const { data, status } = await apiFetchWithStatus<GroupRow[]>("/groups");
      if (status === 401) {
        router.push("/login");
        return;
      }
      const list = data ?? [];
      setGroups(list.map((g) => ({ id: g.id, name: g.name })));
      setInitLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchText.trim();
    if (!q || q.length < 3 || locations.length >= MAX_STOPS) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const hits = await nominatimSearch(q);
        setSearchHits(hits);
      } catch {
        setSearchHits([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText, locations.length]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const addStopImmediate = useCallback((hit: PlaceSuggestion) => {
    const lat = hit.lat;
    const lng = hit.lng;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      showToast("Could not resolve place coordinates.");
      return;
    }
    setLocations((prev) => {
      if (prev.length >= MAX_STOPS) return prev;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          place_name: hit.place_name,
          full_address: hit.full_address,
          lat,
          lng,
          place_id: hit.place_id,
          arrival_date: null,
        },
      ];
    });
    setSearchText("");
    setSearchHits([]);
  }, [showToast]);

  const addStopWithoutCoords = useCallback(
    (placeName: string) => {
      setLocations((prev) => {
        if (prev.length >= MAX_STOPS) return prev;
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            place_name: placeName,
            full_address: placeName,
            lat: 0,
            lng: 0,
            place_id: `manual:${crypto.randomUUID()}`,
            arrival_date: null,
          },
        ];
      });
      setSearchText("");
      setSearchHits([]);
      showToast(
        "Location added without coordinates — you can update later",
      );
    },
    [showToast],
  );

  const handleAddFirst = useCallback(async () => {
    const q = searchText.trim();
    if (q.length < 3) {
      showToast("Type at least 3 characters to search.");
      return;
    }
    if (locations.length >= MAX_STOPS) return;
    let hits = searchHits;
    if (!hits.length) {
      setSearchLoading(true);
      try {
        hits = await nominatimSearch(q);
        setSearchHits(hits);
      } finally {
        setSearchLoading(false);
      }
    }
    if (hits[0]) {
      addStopImmediate(hits[0]);
      return;
    }
    addStopWithoutCoords(q);
  }, [
    searchText,
    searchHits,
    locations.length,
    addStopImmediate,
    addStopWithoutCoords,
    showToast,
  ]);

  const move = (idx: number, dir: -1 | 1) => {
    setLocations((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const c = [...prev];
      [c[idx], c[j]] = [c[j], c[idx]];
      return c;
    });
  };

  const setLegMode = (i: number, mode: TransportMode) => {
    setTransport((prev) => {
      const c = [...prev];
      c[i] = mode;
      return c;
    });
  };

  const nextDisabled = useMemo(() => {
    if (step === 1) {
      if (!tripType || tripName.trim().length < 2) return true;
      if (isGroupTrip === null) return true;
      if (isGroupTrip === true && !groupId) return true;
      return false;
    }
    if (step === 2) return locations.length < 1;
    return false;
  }, [step, tripType, tripName, isGroupTrip, groupId, locations.length]);

  const handleNext = () => {
    if (step === 1 && isGroupTrip === null) {
      setGroupTripError(true);
      return;
    }
    setGroupTripError(false);
    if (nextDisabled) return;
    setStep((s) => Math.min(5, s + 1));
  };

  const saveTrip = async () => {
    if (tripName.trim().length < 2 || locations.length < 1) {
      showToast("Add a name and at least one location.");
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const withDates = locations.map((l) => ({
        ...l,
        arrival_date: l.arrival_date || today,
      }));
      const startD = withDates[0]?.arrival_date ?? today;
      const endD = withDates[withDates.length - 1]?.arrival_date ?? startD;
      const desc = buildDescriptionPayload(
        tripType ?? "leisure",
        withDates,
        buildLegs(withDates),
        transport,
        totalDistance,
        totalEstCost,
      );
      const tripPayload = {
        title: tripName.trim(),
        description: desc,
        start_date: startD,
        end_date: endD,
      };

      if (isGroupTrip === false) {
        const { data, status } = await apiFetchWithStatus<{ id: string }>(
          "/trips",
          {
            method: "POST",
            body: JSON.stringify({
              ...tripPayload,
              group_id: null,
            }),
          },
        );
        if (status === 401) {
          router.push("/login");
          return;
        }
        if (!data?.id) {
          showToast("Could not create trip");
          return;
        }
        router.push("/trips");
        return;
      }

      let gid = groupId;
      if (gid === "__new__") {
        gid = "";
      }
      if (!gid) {
        const { data: g, status: gSt } = await apiFetchWithStatus<
          GroupRow & { id: string }
        >("/groups", {
          method: "POST",
          body: JSON.stringify({
            name: tripName.trim().slice(0, 120) || "My trip",
            description: null,
          }),
        });
        if (gSt === 401) {
          router.push("/login");
          return;
        }
        if (!g?.id) {
          showToast("Could not create group");
          return;
        }
        gid = g.id;
      }
      const { data, status } = await apiFetchWithStatus<{ id: string }>(
        `/groups/${gid}/trips`,
        {
          method: "POST",
          body: JSON.stringify(tripPayload),
        },
      );
      if (status === 401) {
        router.push("/login");
        return;
      }
      if (!data?.id) {
        showToast("Could not create trip");
        return;
      }
      router.push("/trips");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (initLoading) {
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6"
        style={{ background: BG }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
        <p className="text-sm text-[#6C757D]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-0" style={{ background: BG, paddingBottom: 100 }}>
      {GOOGLE_MAPS_KEY && loadGoogleScript && !googlePlacesBlocked ? (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`}
          strategy="lazyOnload"
          onLoad={() => setGoogleReady(true)}
          onError={() => disableGooglePlaces()}
        />
      ) : null}
      {toast ? (
        <div className="fixed right-4 top-4 z-[200] max-w-sm rounded-lg bg-[#2C3E50] px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <div className="border-b bg-white px-4 py-4" style={{ borderColor: BORDER }}>
        <h1 className="text-xl font-bold" style={{ color: NAVY }}>
          Plan a trip
        </h1>
        <Stepper steps={STEPS} currentStep={step} />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {step === 1 ? (
          <div className="space-y-6">
            <p className="text-sm text-[#6C757D]">Step 1 — Trip type</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { k: "business" as const, t: "Business", em: "💼" },
                  { k: "leisure" as const, t: "Leisure", em: "🏖️" },
                ] as const
              ).map((c) => (
                <button
                  key={c.k}
                  type="button"
                  onClick={() => setTripType(c.k)}
                  className={`rounded-2xl border-2 p-5 text-left transition ${
                    tripType === c.k
                      ? "border-[#E94560] bg-white shadow-sm"
                      : "border-[#E9ECEF] bg-white"
                  }`}
                  style={{ borderColor: tripType === c.k ? CORAL : BORDER }}
                >
                  <span className="text-4xl">{c.em}</span>
                  <p className="mt-2 text-lg font-bold" style={{ color: NAVY }}>
                    {c.t}
                  </p>
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-semibold text-[#2C3E50]">
                Trip name
              </label>
              <input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g. Coast weekend"
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E94560]/30"
                style={{ borderColor: BORDER, color: "#2C3E50" }}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#2C3E50]">
                Is this a group trip?
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsGroupTrip(false);
                    setGroupId("");
                    setGroupTripError(false);
                  }}
                  className="text-[13px] font-medium transition-colors"
                  style={{
                    padding: "10px 32px",
                    borderRadius: 8,
                    border: `0.5px solid ${BORDER}`,
                    backgroundColor: isGroupTrip === false ? "#0F766E" : "#F8FAFC",
                    color: isGroupTrip === false ? "#FFFFFF" : "#64748B",
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGroupTrip(true);
                    setGroupId("");
                    setGroupTripError(false);
                  }}
                  className="text-[13px] font-medium transition-colors"
                  style={{
                    padding: "10px 32px",
                    borderRadius: 8,
                    border: `0.5px solid ${BORDER}`,
                    backgroundColor: isGroupTrip === true ? "#0F766E" : "#F8FAFC",
                    color: isGroupTrip === true ? "#FFFFFF" : "#64748B",
                  }}
                >
                  Yes
                </button>
              </div>
              {groupTripError && isGroupTrip === null ? (
                <p className="mt-2 text-[11px] text-[#EF4444]">
                  Please confirm if this is a group trip to continue
                </p>
              ) : null}
              {isGroupTrip === true ? (
                <div className="mt-4">
                  <label className="text-sm font-semibold text-[#2C3E50]">
                    Group
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
                    style={{ borderColor: BORDER, color: "#2C3E50" }}
                  >
                    <option value="" disabled>
                      Select or create a group
                    </option>
                    <option value="__new__">Create new group on save</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6C757D]">Step 2 — Locations</p>

            {locations.length < MAX_STOPS ? (
              <div>
                <label className="text-sm font-semibold text-[#2C3E50]">
                  Add a stop
                </label>
                <div className="relative mt-2">
                  <div className="flex gap-2">
                    <input
                      ref={searchInputRef}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAddFirst();
                        }
                      }}
                      placeholder="Search any address, landmark, factory, area..."
                      className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0F766E]/25"
                      style={{ borderColor: BORDER, color: "#2C3E50" }}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddFirst()}
                      disabled={searchLoading || searchText.trim().length < 3}
                      className="shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: "#0F766E" }}
                    >
                      Add
                    </button>
                  </div>
                  {searchLoading ? (
                    <p className="mt-2 text-xs text-[#94A3B8]">Searching…</p>
                  ) : null}
                  {searchHits.length > 0 ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[240px] overflow-y-auto rounded-lg border bg-white"
                      style={{
                        borderWidth: "0.5px",
                        borderColor: BORDER,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    >
                      {searchHits.map((h) => (
                        <li key={`${h.place_id}-${h.full_address}`}>
                          <button
                            type="button"
                            className="flex h-12 w-full cursor-pointer items-center gap-2.5 px-3 text-left transition hover:bg-[#F8FAFC]"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addStopImmediate(h);
                            }}
                          >
                            <MapPin
                              size={14}
                              className="shrink-0 text-[#0F766E]"
                              strokeWidth={2}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-[#0F172A]">
                                {h.place_name}
                              </span>
                              <span className="block truncate text-[11px] text-[#64748B]">
                                {h.full_address}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : searchText.trim().length >= 3 && !searchLoading ? (
                    <p className="mt-2 text-xs text-[#94A3B8]">
                      No results — try a different search or paste the full address and click Add.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                Maximum 7 stops reached
              </p>
            )}

            <p className="text-sm font-semibold text-[#2C3E50]">
              Stops ({locations.length}/{MAX_STOPS})
            </p>
            {locations.length === 0 ? (
              <p className="text-sm text-[#6C757D]">No stops yet. Search above to add your first stop.</p>
            ) : (
              <ul className="space-y-3">
                {locations.map((loc, idx) => (
                  <li
                    key={loc.id}
                    className="rounded-xl border bg-white p-4"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: "#0F766E" }}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#0F172A]">
                          {loc.place_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">
                          {loc.full_address}
                        </p>
                        <label className="mt-3 block text-xs font-semibold text-[#64748B]">
                          Arrival date
                        </label>
                        <ArrivalDatePicker
                          value={loc.arrival_date}
                          onChange={(arrival_date) =>
                            setLocations((p) =>
                              p.map((x) =>
                                x.id === loc.id ? { ...x, arrival_date } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            style={{ borderColor: BORDER, color: NAVY }}
                            onClick={() => move(idx, -1)}
                            disabled={idx === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            style={{ borderColor: BORDER, color: NAVY }}
                            onClick={() => move(idx, 1)}
                            disabled={idx === locations.length - 1}
                          >
                            Down
                          </button>
                        </div>
                        <button
                          type="button"
                          className="flex items-center justify-center rounded border border-red-200 p-1.5 text-red-500 transition hover:bg-red-50"
                          aria-label="Remove stop"
                          onClick={() =>
                            setLocations((p) => p.filter((x) => x.id !== loc.id))
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {locations.length > 0 && locations.length < MAX_STOPS ? (
              <button
                type="button"
                onClick={() => {
                  searchInputRef.current?.focus();
                  searchInputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                className="w-full rounded-xl border border-dashed py-3 text-sm font-semibold text-[#0F766E] transition hover:bg-[#F0FDF9]"
                style={{ borderColor: "#0F766E" }}
              >
                + Add another stop
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6C757D]">Step 3 — Route map</p>
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: BORDER }}>
              <div className="relative h-[min(50vh,420px)] w-full min-h-[240px]">
                <MapContainer
                  center={mapPoints.length > 0 ? mapPoints[0] : [20, 78]}
                  zoom={mapPoints.length > 0 ? 5 : 4}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {mapPoints.length > 0 ? (
                    <>
                      <FitBounds points={mapPoints} />
                      {validLocations.map((loc) => {
                        const stopNum =
                          locations.findIndex((x) => x.id === loc.id) + 1;
                        return (
                          <Marker
                            key={loc.id}
                            position={[loc.lat, loc.lng]}
                            icon={L.divIcon({
                              className: "",
                              html: `<div style="width:30px;height:30px;border-radius:50%;background:${CORAL};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${stopNum}</div>`,
                              iconSize: [30, 30],
                            })}
                          />
                        );
                      })}
                      {mapPoints.length > 1 ? (
                        <Polyline
                          positions={mapPoints}
                          pathOptions={{ color: CORAL, weight: 3 }}
                        />
                      ) : null}
                    </>
                  ) : null}
                </MapContainer>
                {mapPoints.length === 0 ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 px-6 text-center text-sm font-medium text-[#64748B]">
                    {locations.length === 0
                      ? "Add locations in the previous step."
                      : "Add stops with valid addresses to see route"}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: BORDER }}
              >
                <p className="text-xs font-bold uppercase text-[#ADB5BD]">
                  Total distance
                </p>
                <p className="text-lg font-bold" style={{ color: NAVY }}>
                  {Math.round(totalDistance).toLocaleString("en-IN")} km
                </p>
              </div>
              <div
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: BORDER }}
              >
                <p className="text-xs font-bold uppercase text-[#ADB5BD]">
                  Estimated cost
                </p>
                <p className="text-lg font-bold" style={{ color: NAVY }}>
                  ₹{totalEstCost.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-[#6C757D]">
                  Based on default transport mix
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6C757D]">Step 4 — Transport</p>
            {legs.length === 0 ? (
              <p className="text-sm text-[#6C757D]">
                Add at least two locations to define legs, or continue to
                review with a single stop.
              </p>
            ) : (
              legs.map((leg, i) => {
                const cur = transport[i] ?? suggestTransport(leg.distanceKm);
                const sug = suggestTransport(leg.distanceKm);
                return (
                  <div
                    key={`${leg.from}-${leg.to}`}
                    className="rounded-xl border bg-white p-4"
                    style={{ borderColor: BORDER }}
                  >
                    <p className="font-semibold" style={{ color: NAVY }}>
                      {leg.from} → {leg.to}
                    </p>
                    <p className="text-xs text-[#6C757D]">
                      {leg.distanceKm} km
                    </p>
                    <label className="mt-2 block text-xs font-semibold text-[#6C757D]">
                      Mode
                    </label>
                    <select
                      value={cur}
                      onChange={(e) =>
                        setLegMode(i, e.target.value as TransportMode)
                      }
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      style={{ borderColor: BORDER, color: "#2C3E50" }}
                    >
                      {(
                        [
                          "car",
                          "train",
                          "flight",
                          "bus",
                        ] as TransportMode[]
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-[#6C757D]">
                      Suggestion:{" "}
                      <span className="font-semibold" style={{ color: CORAL }}>
                        {sug}
                      </span>{" "}
                      (&lt;150km car · &lt;500km train · else flight)
                    </p>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-6">
            <p className="text-sm text-[#6C757D]">Step 5 — Review</p>
            <div
              className="rounded-2xl border bg-white p-4"
              style={{ borderColor: BORDER }}
            >
              <p
                className="text-xs font-bold uppercase text-[#ADB5BD] mb-1"
                style={{ color: "#ADB5BD" }}
              >
                {tripName || "Trip"}
              </p>
              <p className="text-sm" style={{ color: NAVY }}>
                Type: {tripType === "business" ? "Business 💼" : "Leisure 🏖️"}
              </p>
            </div>
            <div
              className="space-y-3 border-l-4 pl-4"
              style={{ borderColor: CORAL }}
            >
              {locations.map((l) => (
                <div key={l.id}>
                  <p className="text-sm font-semibold text-[#2C3E50]">
                    {l.arrival_date || "—"} — {l.place_name}
                  </p>
                  <p className="text-xs text-[#94A3B8]">{l.full_address}</p>
                </div>
              ))}
            </div>
            <ul className="space-y-2 text-sm text-[#2C3E50]">
              <li>
                <span className="text-[#6C757D]">Total locations: </span>
                {locations.length}
              </li>
              <li>
                <span className="text-[#6C757D]">Total distance: </span>
                {Math.round(totalDistance)} km
              </li>
              <li>
                <span className="text-[#6C757D]">Transport summary: </span>
                {legs.length === 0
                  ? "—"
                  : legs
                      .map(
                        (g, i) =>
                          `${g.from}→${g.to}: ${transport[i] ?? suggestTransport(g.distanceKm)}`,
                      )
                      .join(" · ")}
              </li>
              <li>
                <span className="text-[#6C757D]">Est. cost: </span>₹
                {totalEstCost.toLocaleString("en-IN")}
              </li>
            </ul>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTrip()}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: CORAL }}
            >
              {saving ? "Saving…" : "Save trip"}
            </button>
          </div>
        ) : null}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-between gap-3 border-t bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:left-[var(--sidebar-width,0px)]"
        style={{ borderColor: BORDER }}
      >
        <button
          type="button"
          className="text-sm font-semibold text-[#6C757D]"
          onClick={() =>
            step > 1 ? setStep((s) => s - 1) : router.push("/trips")
          }
        >
          ← Back
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl px-6 py-2.5 text-sm font-bold"
            style={{
              background: nextDisabled ? "#E9ECEF" : CORAL,
              color: nextDisabled ? "#94A3B8" : "#FFFFFF",
              cursor: nextDisabled ? "not-allowed" : "pointer",
            }}
            title={
              step === 1 && isGroupTrip === null
                ? "Please select if this is a group trip"
                : undefined
            }
          >
            Next →
          </button>
        ) : null}
      </div>
    </div>
  );
}
