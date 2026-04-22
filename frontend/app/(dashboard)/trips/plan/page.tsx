"use client";

import dynamic from "next/dynamic";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Stepper } from "@/components/trips";
import { apiFetchWithStatus } from "@/lib/api";

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
            map.fitBounds(b, { padding: [40, 40] });
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
  name: string;
  lat: number;
  lng: number;
  date: string;
};

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

function buildLegs(locs: PlannerLocation[]): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < locs.length; i++) {
    const prev = locs[i - 1];
    const cur = locs[i];
    const distanceKm = Math.round(haversineKm(prev.lat, prev.lng, cur.lat, cur.lng));
    out.push({
      from: prev.name,
      to: cur.name,
      fromLat: prev.lat,
      fromLng: prev.lng,
      toLat: cur.lat,
      toLng: cur.lng,
      distanceKm,
    });
  }
  return out;
}

async function nominatimSearch(q: string): Promise<
  { name: string; lat: number; lng: number; label: string }[]
> {
  const query = q.trim();
  if (!query) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query,
    )}&format=json&limit=6`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      name: string;
    }[];
    return rows.map((r) => ({
      name: r.name || r.display_name.split(",")[0],
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name,
    }));
  } catch {
    return [];
  }
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
      n: l.name,
      la: Math.round(l.lat * 1e5) / 1e5,
      lo: Math.round(l.lng * 1e5) / 1e5,
      d: l.date,
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
  const [initLoading, setInitLoading] = useState(true);
  const [locations, setLocations] = useState<PlannerLocation[]>([]);
  const [transport, setTransport] = useState<TransportMode[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchHits, setSearchHits] = useState<
    { name: string; lat: number; lng: number; label: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const legs = useMemo(() => buildLegs(locations), [locations]);

  const mapPoints: [number, number][] = useMemo(
    () => locations.map((l) => [l.lat, l.lng] as [number, number]),
    [locations],
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

  useEffect(() => {
    void (async () => {
      const { data, status } = await apiFetchWithStatus<GroupRow[]>("/groups");
      if (status === 401) {
        router.push("/login");
        return;
      }
      const list = data ?? [];
      setGroups(list.map((g) => ({ id: g.id, name: g.name })));
      if (list[0]) setGroupId((prev) => prev || list[0].id);
      setInitLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const hits = await nominatimSearch(searchText);
      setSearchHits(hits);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const addLocation = useCallback(
    (hit: { name: string; lat: number; lng: number; label: string }) => {
      setLocations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: hit.label.split(",").slice(0, 2).join(", ") || hit.name,
          lat: hit.lat,
          lng: hit.lng,
          date: "",
        },
      ]);
      setSearchText("");
      setSearchHits([]);
    },
    [],
  );

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
    if (step === 1)
      return !tripType || tripName.trim().length < 2;
    if (step === 2) return locations.length < 1;
    return false;
  }, [step, tripType, tripName, locations.length]);

  const saveTrip = async () => {
    if (tripName.trim().length < 2 || locations.length < 1) {
      showToast("Add a name and at least one location.");
      return;
    }
    setSaving(true);
    try {
      let gid = groupId;
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
      const today = new Date().toISOString().slice(0, 10);
      const withDates = locations.map((l) => ({
        ...l,
        date: l.date || today,
      }));
      const startD = withDates[0]?.date ?? today;
      const endD = withDates[withDates.length - 1]?.date ?? startD;
      const desc = buildDescriptionPayload(
        tripType ?? "leisure",
        withDates,
        buildLegs(withDates),
        transport,
        totalDistance,
        totalEstCost,
      );
      const { data, status } = await apiFetchWithStatus<{ id: string }>(
        `/groups/${gid}/trips`,
        {
          method: "POST",
          body: JSON.stringify({
            title: tripName.trim(),
            description: desc,
            start_date: startD,
            end_date: endD,
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
    <div className="min-h-0 pb-28" style={{ background: BG }}>
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
                Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
                style={{ borderColor: BORDER, color: "#2C3E50" }}
              >
                <option value="">Create new group on save</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6C757D]">Step 2 — Locations</p>
            <div>
              <label className="text-sm font-semibold text-[#2C3E50]">
                City search
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search a city…"
                  className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-sm"
                  style={{ borderColor: BORDER, color: "#2C3E50" }}
                />
                <button
                  type="button"
                  disabled={!searchHits[0]}
                  onClick={() => searchHits[0] && addLocation(searchHits[0])}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: CORAL }}
                >
                  Add first result
                </button>
              </div>
              {searchHits.length > 0 ? (
                <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border bg-white" style={{ borderColor: BORDER }}>
                  {searchHits.map((h) => (
                    <li key={h.label}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-[#2C3E50] hover:bg-[#F8F9FA]"
                        onClick={() => addLocation(h)}
                      >
                        {h.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-[#2C3E50]">Stops</p>
            {locations.length === 0 ? (
              <p className="text-sm text-[#6C757D]">No locations yet.</p>
            ) : (
              <ul className="space-y-3">
                {locations.map((loc, idx) => (
                  <li
                    key={loc.id}
                    className="rounded-xl border bg-white p-3"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 font-semibold text-[#2C3E50]">
                        {idx + 1}. {loc.name}
                      </p>
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
                        <button
                          type="button"
                          className="text-xs text-red-500"
                          onClick={() =>
                            setLocations((p) => p.filter((x) => x.id !== loc.id))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={loc.date}
                      onChange={(e) =>
                        setLocations((p) =>
                          p.map((x) =>
                            x.id === loc.id
                              ? { ...x, date: e.target.value }
                              : x,
                          ),
                        )
                      }
                      className="mt-2 w-full max-w-xs rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: BORDER, color: "#2C3E50" }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6C757D]">Step 3 — Route map</p>
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: BORDER }}>
              <div className="h-[min(50vh,420px)] w-full min-h-[240px]">
                {mapPoints.length > 0 ? (
                  <MapContainer
                    center={mapPoints[0]}
                    zoom={5}
                    className="h-full w-full"
                    scrollWheelZoom
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FitBounds points={mapPoints} />
                    {locations.map((loc, i) => (
                      <Marker
                        key={loc.id}
                        position={[loc.lat, loc.lng]}
                        icon={L.divIcon({
                          className: "",
                          html: `<div style="width:30px;height:30px;border-radius:50%;background:${CORAL};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${i + 1}</div>`,
                          iconSize: [30, 30],
                        })}
                      />
                    ))}
                    {mapPoints.length > 1 ? (
                      <Polyline
                        positions={mapPoints}
                        pathOptions={{ color: CORAL, weight: 3 }}
                      />
                    ) : null}
                  </MapContainer>
                ) : (
                  <div
                    className="flex h-full min-h-[200px] items-center justify-center text-sm text-[#6C757D]"
                    style={{ background: "#fff" }}
                  >
                    Add locations in the previous step.
                  </div>
                )}
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
              {locations.map((l, i) => (
                <div key={l.id}>
                  <p className="text-sm font-semibold text-[#2C3E50]">
                    {l.date || "—"} — {l.name}
                  </p>
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
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 border-t bg-white px-4 py-3 md:left-[var(--sidebar-width,0px)]"
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
            disabled={nextDisabled}
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: CORAL }}
          >
            Next →
          </button>
        ) : null}
      </div>
    </div>
  );
}
