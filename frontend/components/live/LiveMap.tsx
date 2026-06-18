"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { onValue, ref, type Database } from "firebase/database";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
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

const MapController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        mapRef,
        fitKey,
        centerOverride,
      }: {
        mapRef: MutableRefObject<L.Map | null>;
        fitKey: string;
        centerOverride?: [number, number];
      }) {
        const map = mod.useMap();
        useEffect(() => {
          mapRef.current = map;
        }, [map, mapRef]);

        useEffect(() => {
          const fix = () => map.invalidateSize();
          fix();
          const id = requestAnimationFrame(fix);
          const t = window.setTimeout(fix, 150);
          window.addEventListener("resize", fix);
          void fitKey;
          return () => {
            cancelAnimationFrame(id);
            window.clearTimeout(t);
            window.removeEventListener("resize", fix);
          };
        }, [map, fitKey]);

        useEffect(() => {
          if (centerOverride) {
            map.setView(centerOverride, 16);
          }
        }, [map, centerOverride]);

        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

const FitBoundsWatcher = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        mapRef,
        points,
      }: {
        mapRef: MutableRefObject<L.Map | null>;
        points: [number, number][];
      }) {
        const map = mod.useMap();
        useEffect(() => {
          window.setTimeout(() => {
            if (!mapRef.current) return;
            if (points.length === 0)
              mapRef.current.setView([20, 0], 2);
            else mapRef.current.fitBounds(points, { padding: [48, 48], maxZoom: 16 });
          }, 50);
        }, [map, mapRef, points]);
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

const MapPickHandler = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        picking,
        onPick,
      }: {
        picking: boolean;
        onPick: (lat: number, lng: number) => void;
      }) {
        mod.useMapEvents({
          click(e) {
            if (!picking) return;
            onPick(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

export type MapMemberLite = {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type GeoPoint = { lat: number | null; lng: number | null };

type LocRow = {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  updated_at?: unknown;
  timestamp?: unknown;
};

const COLORS = ["#DC2626", "#6366f1", "#f59e0b", "#10b981", "#a855f7", "#eab308"];

function readLoc(row: LocRow | null): {
  lat: number | null;
  lng: number | null;
  updated_at: number | null;
} {
  if (!row || typeof row !== "object") {
    return { lat: null, lng: null, updated_at: null };
  }
  let lat =
    typeof row.lat === "number"
      ? row.lat
      : typeof row.latitude === "number"
        ? row.latitude
        : null;
  let lng =
    typeof row.lng === "number"
      ? row.lng
      : typeof row.longitude === "number"
        ? row.longitude
        : null;
  let updated =
    typeof row.updated_at === "number"
      ? row.updated_at
      : typeof row.timestamp === "number"
        ? row.timestamp
        : null;
  if (
    lat === null &&
    typeof row.lat === "string" &&
    !Number.isNaN(Number(row.lat))
  )
    lat = Number(row.lat);
  if (
    lng === null &&
    typeof row.lng === "string" &&
    !Number.isNaN(Number(row.lng))
  )
    lng = Number(row.lng);

  return { lat: lat ?? null, lng: lng ?? null, updated_at: updated };
}

export function LiveMap(props: {
  tripId: string;
  firebaseDb: Database | null;
  members: MapMemberLite[];
  meetPoint: GeoPoint & { name?: string | null };
  pickingMeetPoint?: boolean;
  onMapPick?: (lat: number, lng: number) => void;
  currentUserId: string | null;
  pulseUserId?: string | null;
  style?: "standard" | "satellite" | "night";
  routeLine?: [number, number][];
  centerOverride?: [number, number];
}) {
  const mapRef = useRef<L.Map | null>(null);
  const [locs, setLocs] = useState<
    Record<string, { lat: number; lng: number; updated_at: number | null }>
  >({});

  useEffect(() => {
    if (!props.firebaseDb || !props.tripId) return undefined;
    const base = ref(props.firebaseDb, `trips/${props.tripId}/locations`);
    const off = onValue(base, (snap) => {
      const raw = snap.val() as Record<string, LocRow> | null;
      const next: typeof locs = {};
      if (!raw) {
        setLocs({});
        return;
      }
      Object.keys(raw).forEach((uid) => {
        const { lat, lng, updated_at } = readLoc(raw[uid]);
        if (lat !== null && lng !== null) {
          next[uid] = { lat, lng, updated_at };
        }
      });
      setLocs(next);
    });
    return () => off();
  }, [props.firebaseDb, props.tripId]);

  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [];
    props.members.forEach((mem) => {
      const g = locs[mem.user_id];
      if (g?.lat != null && g?.lng != null) pts.push([g.lat, g.lng]);
    });
    if (
      props.meetPoint.lat !== null &&
      props.meetPoint.lng !== null &&
      !Number.isNaN(props.meetPoint.lat) &&
      !Number.isNaN(props.meetPoint.lng)
    ) {
      pts.push([props.meetPoint.lat, props.meetPoint.lng]);
    }
    return pts;
  }, [
    locs,
    props.meetPoint.lat,
    props.meetPoint.lng,
    props.members,
  ]);

  const center = useMemo((): [number, number] => {
    if (fitPoints.length === 0) return [20.0, 0.0];
    let slat = 0;
    let slng = 0;
    fitPoints.forEach(([lat, lng]) => {
      slat += lat;
      slng += lng;
    });
    return [slat / fitPoints.length, slng / fitPoints.length];
  }, [fitPoints]);

  const fitKey = useMemo(() => JSON.stringify(fitPoints), [fitPoints]);

  const makeIcon = useCallback((color: string, pulse: boolean, img?: string | null) => {
    const border = pulse ? `3px solid #50d493` : `2px solid ${color}`;
    const inner =
      img && img.startsWith?.("http")
        ? `<img src="${encodeURI(img)}" alt="" width="38" height="38" style="width:38px;height:38px;border-radius:999px;object-fit:cover"/>`
        : `<span style="font-size:12px;color:#fff;font-weight:700">?</span>`;
    return L.divIcon({
      html: `
        <div style="animation:${
          pulse ? "pulse 1.35s infinite" : "none"
        };position:relative;display:flex;width:42px;height:42px;border-radius:999px;align-items:center;justify-content:center;background:${
          img ? "transparent" : color
        };border:${border}">
          ${inner}
        </div>`,
      className: "live-member-marker",
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -36],
    });
  }, []);

  const pulseId = props.pulseUserId || props.currentUserId;

  if (!props.firebaseDb) {
    return (
      <div className="flex min-h-[360px] w-full items-center justify-center rounded-2xl border border-dashed border-amber-500/65 bg-[#1a0505]/85 px-5 text-center text-sm text-amber-100">
        Firebase client unavailable — pins need NEXT_PUBLIC_FIREBASE_DATABASE_URL configured.
      </div>
    );
  }

  const tileUrls = {
    standard: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    night: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  };

  return (
    <>
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: translateY(-2px) scale(1);
            filter: brightness(1);
          }
          70% {
            transform: translateY(-2px) scale(1.08);
            filter: brightness(1.15);
          }
          100% {
            transform: translateY(-2px) scale(1);
            filter: brightness(1);
          }
        }
      `}</style>

      <div className="flex h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-[#1f3a61]/80 [&_.leaflet-tile-pane]:brightness-[0.92] [&_.leaflet-container]:rounded-2xl">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full [&_.leaflet-attribution-flag]:hidden"
          style={{ minHeight: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url={tileUrls[props.style || "standard"]}
          />
          <MapController mapRef={mapRef} fitKey={fitKey} centerOverride={props.centerOverride} />
          <FitBoundsWatcher mapRef={mapRef} points={fitPoints} />
          <MapPickHandler
            picking={Boolean(props.pickingMeetPoint)}
            onPick={props.onMapPick ?? (() => {})}
          />

          {props.meetPoint.lat !== null &&
          props.meetPoint.lng !== null &&
          !Number.isNaN(props.meetPoint.lat) &&
          !Number.isNaN(props.meetPoint.lng) ? (
            <Marker
              position={[props.meetPoint.lat, props.meetPoint.lng]}
              icon={L.divIcon({
                html: `<div title="meet" style="font-size:24px;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.65)">🚩</div>`,
                className: "",
                iconSize: [36, 36],
                iconAnchor: [18, 34],
              })}
            />
          ) : null}

          {props.members.map((m, idx) => {
            const row = locs[m.user_id];
            if (
              row?.lat === undefined ||
              row?.lng === undefined ||
              Number.isNaN(row.lat) ||
              Number.isNaN(row.lng)
            )
              return null;

            const col = COLORS[idx % COLORS.length]!;
            const pulse = pulseId !== null && m.user_id === pulseId;
            return (
              <Marker
                key={m.user_id}
                position={[row.lat, row.lng]}
                icon={makeIcon(col, pulse, m.avatar_url)}
              />
            );
          })}

          {props.routeLine && props.routeLine.length > 1 ? (
            <Polyline
              positions={props.routeLine}
              color="#0F766E"
              dashArray="6, 6"
              weight={4}
            />
          ) : null}
        </MapContainer>
      </div>
    </>
  );
}
