"use client";

import {
  formatTrackDate,
  formatTrackDistanceMeters,
  formatTrackDuration,
  shareTripSummary,
  type TripTrack,
} from "@/lib/live/track";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Pause, Play, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const OSM_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function createReplayDot(bearing: number): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "relative flex h-3 w-3 items-center justify-center";

  const cone = document.createElement("div");
  cone.className = "absolute bottom-full left-1/2 mb-0.5 h-0 w-0 border-x-[5px] border-b-[10px] border-x-transparent border-b-[#5EEAD4]/80";
  cone.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  cone.style.transformOrigin = "center bottom";

  const dot = document.createElement("div");
  dot.className = "h-3 w-3 rounded-full border-2 border-white bg-[#0F766E] shadow";

  root.appendChild(cone);
  root.appendChild(dot);
  return root;
}

type TripSummarySheetProps = {
  track: TripTrack;
  onClose: () => void;
  onToast?: (message: string) => void;
};

export function TripSummarySheet({ track, onClose, onToast }: TripSummarySheetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const replayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const replayIntervalRef = useRef<number | null>(null);
  const replayIndexRef = useRef(0);

  const [replaySpeed, setReplaySpeed] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayComplete, setReplayComplete] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current != null) {
      window.clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setReplayPlaying(false);
  }, []);

  const resetReplay = useCallback(() => {
    stopReplay();
    replayIndexRef.current = 0;
    setReplayComplete(false);
    setReplayProgress(0);
    const first = track.track_points[0];
    if (first && replayMarkerRef.current) {
      replayMarkerRef.current.setLngLat([first.lng, first.lat]);
      setReplaySpeed(first.speed_mph);
    }
  }, [stopReplay, track.track_points]);

  const startReplay = useCallback(() => {
    const map = mapRef.current;
    const points = track.track_points;
    if (!map || points.length === 0) return;

    stopReplay();
    setReplayComplete(false);
    setReplayPlaying(true);

    if (!replayMarkerRef.current) {
      replayMarkerRef.current = new maplibregl.Marker({
        element: createReplayDot(points[0].bearing || 0),
        anchor: "center",
      })
        .setLngLat([points[0].lng, points[0].lat])
        .addTo(map);
    }

    replayIntervalRef.current = window.setInterval(() => {
      const index = replayIndexRef.current;
      if (index >= points.length) {
        stopReplay();
        setReplayComplete(true);
        return;
      }
      const point = points[index];
      replayMarkerRef.current?.setLngLat([point.lng, point.lat]);
      map.panTo([point.lng, point.lat], { duration: 300 });
      setReplaySpeed(point.speed_mph);
      setReplayProgress(Math.round(((index + 1) / points.length) * 100));
      replayIndexRef.current = index + 1;
    }, 300);
  }, [stopReplay, track.track_points]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || track.track_points.length === 0) return;

    const first = track.track_points[0];
    const map = new maplibregl.Map({
      container,
      style: OSM_STYLE_LIGHT,
      center: [first.lng, first.lat],
      zoom: 13,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      const coordinates = track.track_points.map(
        (point) => [point.lng, point.lat] as [number, number],
      );
      map.addSource("trip-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        paint: {
          "line-color": "#0F766E",
          "line-width": 4,
        },
      });

      const startEl = document.createElement("div");
      startEl.className = "h-3 w-3 rounded-full border-2 border-white bg-green-500 shadow";
      new maplibregl.Marker({ element: startEl, anchor: "center" })
        .setLngLat([first.lng, first.lat])
        .addTo(map);

      const last = track.track_points[track.track_points.length - 1];
      const endEl = document.createElement("div");
      endEl.className = "h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow";
      new maplibregl.Marker({ element: endEl, anchor: "center" })
        .setLngLat([last.lng, last.lat])
        .addTo(map);

      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 40, duration: 0 });
    });

    return () => {
      stopReplay();
      replayMarkerRef.current?.remove();
      replayMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [stopReplay, track.track_points]);

  const handleShare = async () => {
    try {
      const result = await shareTripSummary(track);
      onToast?.(
        result === "shared"
          ? "Trip summary shared."
          : "Trip summary copied to clipboard!",
      );
    } catch {
      onToast?.("Could not share trip summary.");
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Your Trip Summary</h2>
            <p className="mt-1 text-sm text-stone-500">
              {formatTrackDate(track.started_at)} · {formatTrackDuration(track.total_duration_s)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip summary"
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div
            ref={mapContainerRef}
            className="h-60 w-full overflow-hidden rounded-2xl bg-stone-100"
          />

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Distance</p>
              <p className="font-semibold text-stone-900">
                {formatTrackDistanceMeters(track.total_distance_m)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Duration</p>
              <p className="font-semibold text-stone-900">
                {formatTrackDuration(track.total_duration_s)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Max speed</p>
              <p className="font-semibold text-stone-900">
                {Math.round(track.max_speed_mph ?? 0)} mph
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Avg speed</p>
              <p className="font-semibold text-stone-900">
                {Math.round(track.avg_speed_mph ?? 0)} mph
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Reports</p>
              <p className="font-semibold text-stone-900">{track.reports_encountered}</p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Cameras</p>
              <p className="font-semibold text-stone-900">{track.cameras_passed}</p>
            </div>
          </div>

          {replaySpeed != null ? (
            <p className="mt-3 text-center text-sm font-medium text-[#0F766E]">
              Replay speed: {Math.round(replaySpeed)} mph
            </p>
          ) : null}

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-[#0F766E] transition-all"
              style={{ width: `${replayProgress}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={replayPlaying ? stopReplay : startReplay}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-3 py-3 text-sm font-semibold text-white"
            >
              {replayPlaying ? <Pause size={16} /> : <Play size={16} />}
              {replayPlaying ? "Pause" : replayComplete ? "Replay Again" : "Replay Route"}
            </button>
            <button
              type="button"
              onClick={resetReplay}
              className="flex items-center justify-center gap-2 rounded-xl bg-stone-200 px-3 py-3 text-sm font-semibold text-stone-800"
            >
              <Square size={16} />
              Stop
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="rounded-xl bg-stone-900 px-3 py-3 text-sm font-semibold text-white"
            >
              Share
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
