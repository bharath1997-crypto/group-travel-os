"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { apiFetch } from "@/lib/api";

import "leaflet/dist/leaflet.css";

export type PinOut = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  name: string;
  note: string | null;
  flag_type: string;
  created_at: string;
};

const FLAG_COLORS: Record<string, string> = {
  dream: "#EF4444",
  interesting: "#F59E0B",
  gang_trip: "#3B82F6",
  visited: "#10B981",
  custom: "#8B5CF6",
};

const FLAG_OPTIONS = [
  "dream",
  "interesting",
  "gang_trip",
  "visited",
  "custom",
] as const;

type TileMode = "street" | "hybrid" | "satellite" | "terrain" | "dark";

/** Single TileLayer modes (hybrid uses satellite + label overlay below). */
type BasemapMode = Exclude<TileMode, "hybrid">;

const TILES: Record<
  BasemapMode,
  { url: string; attribution: string; maxZoom: number }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    maxZoom: 19,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    maxZoom: 17,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
    maxZoom: 19,
  },
};

/** Hybrid: satellite base + semi-transparent label overlay. */
const HYBRID_LABEL_OVERLAY = {
  url: "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
  attribution:
    'Labels © <a href="http://stamen.com">Stamen Design</a>, <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
} as const;

const TILE_MODE_ORDER: [TileMode, string][] = [
  ["street", "Street"],
  ["hybrid", "Hybrid"],
  ["satellite", "Satellite"],
  ["terrain", "Terrain"],
  ["dark", "Dark"],
];

const PRESETS = [
  { label: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { label: "Paris", lat: 48.8566, lng: 2.3522 },
  { label: "New York", lat: 40.7128, lng: -74.006 },
  { label: "Dubai", lat: 25.2048, lng: 55.2708 },
  { label: "Sydney", lat: -33.8688, lng: 151.2093 },
  { label: "Bali", lat: -8.4095, lng: 115.1889 },
] as const;

function flagDivIcon(flagType: string) {
  const c = FLAG_COLORS[flagType] ?? FLAG_COLORS.custom;
  return L.divIcon({
    className: "saved-flag-pin",
    html: `<div style="background:${c};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const searchResultIcon = L.divIcon({
  className: "search-hit-pin",
  html:
    '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #f97316;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const draftIcon = L.divIcon({
  className: "draft-pin",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#9CA3AF;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type NominatimHit = { lat: string; lon: string; display_name: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function FlyToView({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  const skip = useRef(true);
  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    map.flyTo([lat, lng], zoom, { duration: 1.15 });
  }, [map, lat, lng, zoom]);
  return null;
}

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  // Mobile long-press will be added when React Native app is built — web uses single click
  useMapEvents({
    click(e) {
      const t = e.originalEvent?.target as Element | undefined;
      if (
        t?.closest?.(
          ".leaflet-interactive, .leaflet-marker-icon, .leaflet-popup",
        )
      )
        return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function UserLocationLayers({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    const userName =
      typeof window !== "undefined"
        ? localStorage.getItem("gt_user_name")?.trim() || "You"
        : "You";
    const safeName = escapeHtml(userName);
    const avatarSeed = encodeURIComponent(userName);
    const avatarSrc = `https://api.dicebear.com/7.x/lorelei/svg?seed=${avatarSeed}`;

    const popupHtml = `
    <div style="text-align:center; padding: 8px;">
      <img src="${avatarSrc}" width="48" height="48" alt=""
        style="border-radius:50%; border: 2px solid white; display:block; margin: 0 auto 8px; box-shadow: 0 1px 3px rgba(0,0,0,.2);"/>
      <strong>${safeName}</strong><br/>
      <span style="color:#6B7280; font-size:12px;">
        📍 You are here
      </span><br/>
      <span style="color:#6B7280; font-size:11px;">
        ${lat.toFixed(4)}, ${lng.toFixed(4)}
      </span>
    </div>`;

    const ring = L.circleMarker([lat, lng], {
      radius: 18,
      fillColor: "#3B82F6",
      color: "#3B82F6",
      weight: 2,
      opacity: 0.45,
      fillOpacity: 0.12,
      className: "gt-user-loc-pulse-ring",
      interactive: false,
    });

    const marker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: "#3B82F6",
      color: "#ffffff",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9,
    });

    marker.bindPopup(popupHtml);
    marker.on("click", () => {
      marker.openPopup();
    });

    ring.addTo(map);
    marker.addTo(map);

    return () => {
      ring.remove();
      marker.remove();
    };
  }, [map, lat, lng]);

  return null;
}

export default function MapComponent() {
  const [tileMode, setTileMode] = useState<TileMode>("street");
  const [pins, setPins] = useState<PinOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [centerLat, setCenterLat] = useState(20);
  const [centerLng, setCenterLng] = useState(0);
  const [zoom, setZoom] = useState(2);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHit, setSearchHit] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newFlag, setNewFlag] = useState<string>("dream");
  const [savingPin, setSavingPin] = useState(false);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const leftControlsRef = useRef<HTMLDivElement>(null);
  const rightControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const left = leftControlsRef.current;
    const right = rightControlsRef.current;
    const nodes = [left, right].filter(Boolean) as HTMLElement[];
    const stop = (e: Event) => {
      L.DomEvent.stopPropagation(e);
    };
    for (const el of nodes) {
      L.DomEvent.on(el, "click", stop);
      L.DomEvent.on(el, "mousedown", stop);
      L.DomEvent.on(el, "dblclick", stop);
    }
    return () => {
      for (const el of nodes) {
        L.DomEvent.off(el, "click", stop);
        L.DomEvent.off(el, "mousedown", stop);
        L.DomEvent.off(el, "dblclick", stop);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const flyTo = useCallback((lat: number, lng: number, z: number) => {
    setCenterLat(lat);
    setCenterLng(lng);
    setZoom(z);
  }, []);

  const refreshPins = useCallback(async () => {
    try {
      const list = await apiFetch<PinOut[]>("/pins");
      setPins(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load pins");
    }
  }, []);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!draft) return;
    setNewName("");
    setNewNote("");
    setNewFlag("dream");
  }, [draft]);

  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          referrerPolicy: "no-referrer",
        });
        if (!res.ok) return;
        const data = (await res.json()) as NominatimHit[];
        if (!data.length) return;
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        setSearchHit({ lat, lng, label: data[0].display_name });
        flyTo(lat, lng, 12);
      } finally {
        setSearching(false);
      }
    },
    [searchQuery, flyTo],
  );

  const onPreset = useCallback(
    (p: (typeof PRESETS)[number]) => {
      setSearchHit(null);
      flyTo(p.lat, p.lng, 11);
    },
    [flyTo],
  );

  const onMapClick = useCallback((lat: number, lng: number) => {
    setSearchHit(null);
    setDraft({ lat, lng });
  }, []);

  const cancelDraft = useCallback(() => setDraft(null), []);

  const saveDraftPin = useCallback(async () => {
    if (!draft) return;
    const name = newName.trim();
    if (!name) return;
    setSavingPin(true);
    try {
      const created = await apiFetch<PinOut>("/pins", {
        method: "POST",
        body: JSON.stringify({
          lat: draft.lat,
          lng: draft.lng,
          name,
          flag_type: newFlag,
          note: newNote.trim() || null,
        }),
      });
      setPins((prev) => [created, ...prev]);
      setDraft(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingPin(false);
    }
  }, [draft, newName, newNote, newFlag, showToast]);

  const deletePin = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/pins/${id}`, { method: "DELETE" });
        setPins((p) => p.filter((x) => x.id !== id));
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [showToast],
  );

  const saveEditedNote = useCallback(
    async (id: string) => {
      try {
        const updated = await apiFetch<PinOut>(`/pins/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ note: editNote }),
        });
        setPins((p) => p.map((x) => (x.id === id ? updated : x)));
        setEditingId(null);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Update failed");
      }
    },
    [editNote, showToast],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gt-user-loc-ring-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.28; }
}
.gt-user-loc-pulse-ring {
  animation: gt-user-loc-ring-pulse 1.8s ease-in-out infinite;
}
`,
        }}
      />

      <div
        ref={leftControlsRef}
        className="pointer-events-auto absolute left-3 top-3 z-[1100] flex max-w-[min(100%-6rem,22rem)] flex-col gap-2"
      >
        <form
          onSubmit={(e) => void handleSearch(e)}
          className="flex flex-col gap-2 rounded-lg bg-white/95 p-2 shadow-lg ring-1 ring-gray-200 backdrop-blur-sm sm:flex-row sm:items-center"
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destination..."
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            aria-label="Search destination"
          />
          <button
            type="submit"
            disabled={searching}
            className="shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-white/95 p-2 shadow-lg ring-1 ring-gray-200 backdrop-blur-sm">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onPreset(p)}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-800 hover:bg-gray-50 md:text-xs"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={rightControlsRef}
        className="pointer-events-auto absolute right-3 top-3 z-[1100] flex flex-col items-end gap-2"
      >
        <div className="flex flex-wrap justify-end gap-1 rounded-lg bg-white/95 p-1.5 shadow-lg ring-1 ring-gray-200 backdrop-blur-sm">
          {TILE_MODE_ORDER.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tileMode === key}
              onClick={() => setTileMode(key)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold md:text-xs ${
                tileMode === key
                  ? "bg-gray-900 text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            showToast("Live location sharing coming in the next update!")
          }
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg ring-2 ring-red-400/50"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-200 opacity-80" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          Live
        </button>
      </div>

      {loadError ? (
        <p className="absolute bottom-3 right-3 z-[1100] max-w-xs rounded bg-red-50 px-2 py-1 text-xs text-red-800">
          {loadError}
        </p>
      ) : null}

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={zoom}
        className="z-0 h-full w-full"
        style={{ height: "100%", width: "100%", minHeight: "240px" }}
        scrollWheelZoom
        closePopupOnClick={false}
        doubleClickZoom={false}
      >
        {tileMode === "hybrid" ? (
          <>
            <TileLayer
              key="hybrid-imagery"
              url={TILES.satellite.url}
              attribution={TILES.satellite.attribution}
              maxZoom={TILES.satellite.maxZoom}
            />
            <TileLayer
              key="hybrid-labels"
              url={HYBRID_LABEL_OVERLAY.url}
              attribution={HYBRID_LABEL_OVERLAY.attribution}
              opacity={0.7}
              maxZoom={HYBRID_LABEL_OVERLAY.maxZoom}
            />
          </>
        ) : (
          <TileLayer
            key={tileMode}
            attribution={TILES[tileMode].attribution}
            url={TILES[tileMode].url}
            maxZoom={TILES[tileMode].maxZoom}
          />
        )}
        <FlyToView lat={centerLat} lng={centerLng} zoom={zoom} />
        <MapClickHandler onClick={onMapClick} />

        {userLoc ? (
          <UserLocationLayers lat={userLoc.lat} lng={userLoc.lng} />
        ) : null}

        {searchHit ? (
          <Marker position={[searchHit.lat, searchHit.lng]} icon={searchResultIcon}>
            <Popup>
              <div className="max-w-[14rem] text-xs">
                <p className="font-medium text-gray-900">Search result</p>
                <p className="text-gray-600">{searchHit.label}</p>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {draft ? (
          <Marker
            position={[draft.lat, draft.lng]}
            icon={draftIcon}
            eventHandlers={{
              add: (e) => {
                (e.target as L.Marker).openPopup();
              },
            }}
          >
            <Popup>
              <div className="min-w-[14rem] max-w-[18rem] space-y-2 text-sm">
                <p className="font-semibold text-gray-900">New pin</p>
                <label className="block text-[11px] font-medium text-gray-600">
                  Name
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    placeholder="Required"
                  />
                </label>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-gray-600">
                    Flag
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {FLAG_OPTIONS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setNewFlag(f)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize text-white"
                        style={{
                          background: FLAG_COLORS[f],
                          opacity: newFlag === f ? 1 : 0.45,
                          outline:
                            newFlag === f ? "2px solid #111" : "none",
                        }}
                      >
                        {f.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-[11px] font-medium text-gray-600">
                  Note (optional)
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingPin}
                    onClick={() => void saveDraftPin()}
                    className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {savingPin ? "Saving…" : "Save pin"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelDraft}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={flagDivIcon(pin.flag_type)}
          >
            <Popup>
              <div className="min-w-[12rem] max-w-[16rem] text-xs">
                <p className="font-semibold text-gray-900">
                  📍 {pin.name}
                </p>
                <p className="mt-1">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white"
                    style={{
                      background: FLAG_COLORS[pin.flag_type] ?? "#888",
                    }}
                  >
                    {pin.flag_type.replace("_", " ")}
                  </span>
                </p>
                {editingId === pin.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void saveEditedNote(pin.id)}
                        className="rounded bg-gray-900 px-2 py-1 text-[10px] text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-gray-300 px-2 py-1 text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {pin.note ? (
                      <p className="mt-1 text-gray-700">Note: {pin.note}</p>
                    ) : (
                      <p className="mt-1 italic text-gray-400">No note</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-gray-500">
                      {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </p>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(pin.id);
                          setEditNote(pin.note ?? "");
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-[10px] font-medium"
                      >
                        Edit note
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePin(pin.id)}
                        className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {toast ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[5000] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm text-white shadow-xl"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
