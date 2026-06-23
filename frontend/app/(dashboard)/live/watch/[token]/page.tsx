"use client";

import { apiFetch } from "@/lib/api";
import { initFirebase } from "@/lib/firebase-client";
import {
  createHostMarkerElement,
  formatLastUpdated,
  formatStartedAgo,
  isNightMode,
  type SpectatorHostData,
  type SpectatorHostLocation,
} from "@/lib/live/spectator";
import { off, onValue, ref } from "firebase/database";
import { ChevronLeft } from "lucide-react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";

const OSM_MAX_ZOOM = 19;

const OSM_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: OSM_MAX_ZOOM,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const OSM_STYLE_DARK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: OSM_MAX_ZOOM,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-brightness-min": 0.1, "raster-saturation": -0.3 },
    },
  ],
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default function SpectatorWatchPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hostMarkerRef = useRef<{
    marker: maplibregl.Marker;
    setBearing: (bearing: number | null) => void;
    setEnded: (ended: boolean) => void;
  } | null>(null);
  const endedBannerTimerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostData, setHostData] = useState<SpectatorHostData | null>(null);
  const [hostLocation, setHostLocation] = useState<SpectatorHostLocation | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedBanner, setEndedBanner] = useState(false);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("just now");

  const applyMapStyle = useCallback((map: maplibregl.Map, lat: number, lng: number) => {
    map.setStyle(isNightMode(lat, lng) ? OSM_STYLE_DARK : OSM_STYLE_LIGHT);
  }, []);

  const updateHostMarker = useCallback((data: SpectatorHostLocation) => {
    const map = mapRef.current;
    const entry = hostMarkerRef.current;
    if (!map || !entry) return;
    entry.marker.setLngLat([data.lng, data.lat]);
    entry.setBearing(data.bearing ?? null);
    map.easeTo({
      center: [data.lng, data.lat],
      bearing: data.bearing ?? map.getBearing(),
      duration: 800,
    });
    applyMapStyle(map, data.lat, data.lng);
  }, [applyMapStyle]);

  useEffect(() => {
    const authToken =
      typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    if (!authToken) {
      router.replace(`/login?next=${encodeURIComponent(`/live/watch/${token}`)}`);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const data = await apiFetch<SpectatorHostData>(
          `/live/spectator/validate/${encodeURIComponent(token)}`,
        );
        if (active) {
          setHostData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message.toLowerCase() : "";
        if (message.includes("ended")) {
          setError("This trip has ended");
        } else {
          setError("This invite link has expired or is invalid");
        }
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, token]);

  useEffect(() => {
    if (!hostData || sessionEnded) return;

    const fb = initFirebase();
    if (!fb?.db) return;

    const hostRef = ref(fb.db, hostData.firebase_path);
    const unsubscribe = onValue(hostRef, (snapshot) => {
      const data = snapshot.val() as SpectatorHostLocation | null;
      if (data?.lat != null && data?.lng != null) {
        setHostLocation(data);
        updateHostMarker(data);
      } else {
        setSessionEnded(true);
        setEndedBanner(true);
        hostMarkerRef.current?.setEnded(true);
        if (endedBannerTimerRef.current != null) {
          window.clearTimeout(endedBannerTimerRef.current);
        }
        endedBannerTimerRef.current = window.setTimeout(() => {
          setEndedBanner(false);
        }, 5000);
      }
    });

    return () => {
      off(hostRef, "value", unsubscribe);
    };
  }, [hostData, sessionEnded, updateHostMarker]);

  useEffect(() => {
    if (!hostData || !mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE_LIGHT,
      center: [-87.6298, 41.8781],
      zoom: 14,
      maxZoom: OSM_MAX_ZOOM,
      interactive: true,
      attributionControl: false,
    });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on("load", () => {
      const { element, setBearing, setEnded } = createHostMarkerElement();
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([-87.6298, 41.8781])
        .addTo(map);
      hostMarkerRef.current = { marker, setBearing, setEnded };
    });

    return () => {
      hostMarkerRef.current?.marker.remove();
      hostMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [hostData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastUpdatedLabel(formatLastUpdated(hostLocation?.last_seen));
    }, 5000);
    setLastUpdatedLabel(formatLastUpdated(hostLocation?.last_seen));
    return () => window.clearInterval(interval);
  }, [hostLocation?.last_seen]);

  useEffect(() => {
    return () => {
      if (endedBannerTimerRef.current != null) {
        window.clearTimeout(endedBannerTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-900 text-white">
        Loading live trip…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-stone-900 px-6 text-center text-white">
        <p className="text-lg font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 rounded-full bg-[#0F766E] px-5 py-2 text-sm font-semibold"
        >
          Go back
        </button>
      </div>
    );
  }

  if (!hostData) return null;

  const speed = Math.round(hostLocation?.speed_mph ?? 0);
  const road = hostLocation?.road_name || "—";

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-stone-900">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {endedBanner ? (
        <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20">
          <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
            Trip has ended
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Back
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
            <span className="truncate">{hostData.host_name}</span>
            <span className="text-stone-300">·</span>
            <span className="inline-flex items-center gap-1 text-[#5EEAD4]">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          </div>

          <div className="rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
            {speed} mph
          </div>
        </div>

        <div className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3">
          <div className="rounded-2xl bg-[rgba(15,23,42,0.88)] px-4 py-4 text-white shadow-xl backdrop-blur-sm">
            {sessionEnded ? (
              <>
                <p className="text-base font-semibold">
                  This trip has ended · {hostData.host_name} arrived
                </p>
                <p className="mt-1 text-sm text-stone-300">Read only · you are a spectator</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">
                  Watching {hostData.host_name}&apos;s trip
                </p>
                <p className="mt-1 text-sm text-stone-300">
                  Started {formatStartedAgo(hostData.started_at)}
                </p>
                <p className="mt-3 text-sm text-stone-200">
                  Speed: {speed} mph · Road: {road}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  Last updated: {lastUpdatedLabel}
                </p>
                <p className="mt-3 text-xs text-stone-400">
                  Read only · you are a spectator
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
