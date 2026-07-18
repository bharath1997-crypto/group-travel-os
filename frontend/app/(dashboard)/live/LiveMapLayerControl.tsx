"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Footprints,
  Layers,
  Map,
  Moon,
  Mountain,
  Route,
  Sailboat,
  Satellite,
  Ship,
  Sparkles,
  Train,
  Users,
} from "lucide-react";
import type { LiveMapLayer } from "@/lib/map-providers";
import { LIVE_MAP_LAYERS_PANEL_OFFSET } from "./live-layout";

const LIVE_MAP_LAYER_OPTIONS = [
  {
    id: "street" as const,
    label: "Detailed Map",
    description: "Every house number always visible",
    icon: "map" as const,
    previewClass: "bg-gradient-to-br from-[#E8F5F3] via-[#F8FAFC] to-[#D1FAE5]",
  },
  {
    id: "clean" as const,
    label: "Clean Map",
    description: "Best for rides — zoom in for house numbers",
    icon: "clean" as const,
    previewClass: "bg-gradient-to-br from-[#F1F5F9] via-[#FFFFFF] to-[#ECFEFF]",
  },
  {
    id: "satellite" as const,
    label: "Satellite",
    description: "Aerial imagery",
    icon: "satellite" as const,
    previewClass: "bg-gradient-to-br from-[#3D5A45] via-[#6B705C] to-[#2C3E2D]",
  },
  {
    id: "terrain" as const,
    label: "Terrain",
    description: "Topography with elevation contours",
    icon: "terrain" as const,
    previewClass: "bg-gradient-to-br from-[#8B7355] via-[#6B8E5A] to-[#4A6741]",
  },
  {
    id: "hybrid" as const,
    label: "Hybrid",
    description: "Satellite with labels",
    icon: "layers" as const,
    previewClass:
      "bg-gradient-to-br from-[#4A6741] via-[#5C6B52] to-[#2F4538] relative overflow-hidden",
  },
  {
    id: "dark" as const,
    label: "Dark",
    description: "Low-light map",
    icon: "moon" as const,
    previewClass: "bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155]",
  },
] as const;

const LAYER_LABELS: Record<LiveMapLayer, string> = {
  street: "Detailed Map",
  clean: "Clean Map",
  satellite: "Satellite",
  terrain: "Terrain",
  hybrid: "Hybrid",
  dark: "Dark",
};

function LayerOptionIcon({ icon }: { icon: (typeof LIVE_MAP_LAYER_OPTIONS)[number]["icon"] }) {
  const className = "h-4 w-4 shrink-0";
  switch (icon) {
    case "map":
      return <Map className={className} aria-hidden />;
    case "clean":
      return <Sparkles className={className} aria-hidden />;
    case "satellite":
      return <Satellite className={className} aria-hidden />;
    case "terrain":
      return <Mountain className={className} aria-hidden />;
    case "layers":
      return <Layers className={className} aria-hidden />;
    case "moon":
      return <Moon className={className} aria-hidden />;
  }
}

function LayerPreview({ option }: { option: (typeof LIVE_MAP_LAYER_OPTIONS)[number] }) {
  return (
    <div
      className={`relative h-10 w-10 shrink-0 rounded-xl border border-stone-200/80 shadow-inner ${option.previewClass}`}
      aria-hidden
    >
      {option.id === "street" ? (
        <>
          <div className="absolute inset-x-1 top-2.5 h-px bg-stone-300/70" />
          <div className="absolute inset-x-1 top-4 h-px bg-stone-300/50" />
          <div className="absolute inset-y-1.5 left-2.5 w-px bg-stone-300/70" />
          <div className="absolute inset-y-1.5 left-4 w-px bg-stone-300/50" />
          <div className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-sm bg-[#0F766E]/35" />
          <div className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/60" />
        </>
      ) : null}
      {option.id === "clean" ? (
        <>
          <div className="absolute inset-x-2 top-4 h-px bg-stone-200/90" />
          <div className="absolute inset-y-2 left-4 w-px bg-stone-200/90" />
        </>
      ) : null}
      {option.id === "hybrid" ? (
        <>
          <div className="absolute inset-x-1 top-4 h-px bg-white/50" />
          <div className="absolute left-2 top-2 text-[6px] font-bold uppercase tracking-wide text-white/80">
            Rd
          </div>
        </>
      ) : null}
      {option.id === "terrain" ? (
        <>
          <div className="absolute inset-x-1 top-3 h-px bg-white/30" />
          <div className="absolute inset-x-2 top-5 h-px bg-white/20" />
          <div className="absolute inset-x-1 top-7 h-px bg-white/15" />
          <div className="absolute bottom-1.5 left-1.5 h-2 w-3 rounded-sm bg-[#5C7A3A]/50" />
        </>
      ) : null}
      {option.id === "dark" ? (
        <div className="absolute inset-x-2 top-4 h-px bg-white/15" />
      ) : null}
    </div>
  );
}

type OverlayToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  title: string;
  description: string;
  preview: ReactNode;
};

function OverlayToggle({ enabled, onChange, title, description, preview }: OverlayToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
        enabled
          ? "border border-[#007F73] bg-[#E6F7F4]"
          : "border border-transparent hover:bg-stone-50"
      }`}
      aria-pressed={enabled}
    >
      {preview}
      <div className="min-w-0 flex-1">
        <span
          className={`text-sm font-semibold ${enabled ? "text-[#007F73]" : "text-stone-800"}`}
        >
          {title}
        </span>
        <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{description}</p>
      </div>
      {enabled ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007F73] text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <span className="h-6 w-6 shrink-0" aria-hidden />
      )}
    </button>
  );
}

type Props = {
  activeLayer: LiveMapLayer;
  onLayerChange: (layer: LiveMapLayer) => void;
  travelLayerEnabled?: boolean;
  onTravelLayerChange?: (enabled: boolean) => void;
  seaRoutesEnabled?: boolean;
  onSeaRoutesChange?: (enabled: boolean) => void;
  cruiseRoutesEnabled?: boolean;
  onCruiseRoutesChange?: (enabled: boolean) => void;
  footRoutesEnabled?: boolean;
  onFootRoutesChange?: (enabled: boolean) => void;
  friendTrackingEnabled?: boolean;
  onFriendTrackingChange?: (enabled: boolean) => void;
  /** Controlled open state — used when opened from Map Tools. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the floating layers orb (panel only). Default true. */
  showTrigger?: boolean;
  mapViewMode?: "2d" | "3d";
  onToggleViewMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  bearing?: number;
  onResetNorth?: () => void;
};

export default function LiveMapLayerControl({
  activeLayer,
  onLayerChange,
  travelLayerEnabled = false,
  onTravelLayerChange,
  seaRoutesEnabled = false,
  onSeaRoutesChange,
  cruiseRoutesEnabled = false,
  onCruiseRoutesChange,
  footRoutesEnabled = false,
  onFootRoutesChange,
  friendTrackingEnabled = true,
  onFriendTrackingChange,
  open: openProp,
  onOpenChange,
  showTrigger = true,
  mapViewMode,
  onToggleViewMode,
  isFullscreen,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
  notificationsEnabled,
  onToggleNotifications,
  bearing,
  onResetNorth,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(open) : next;
      if (!isControlled) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange, open],
  );

  const selectLayer = useCallback(
    (layer: LiveMapLayer) => {
      onLayerChange(layer);
      setOpen(false);
    },
    [onLayerChange, setOpen],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-live-layers-trigger]")) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className="relative flex flex-col items-center">
      {showTrigger ? (
        <button
          type="button"
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-md transition-all hover:bg-white ${
            open ? "ring-2 ring-[#007F73]/25" : ""
          }`}
          onClick={() => setOpen((prev) => !prev)}
          title="Map layers"
          aria-label="Map layers"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Layers
            className={`h-5 w-5 transition-colors ${open ? "text-[#007F73]" : "text-stone-500"}`}
          />
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Map layers"
          className={`pointer-events-auto absolute bottom-full left-0 z-[60] w-[min(18.5rem,calc(100vw-2rem))] ${LIVE_MAP_LAYERS_PANEL_OFFSET} max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-md:right-auto max-md:mb-0 max-md:w-auto`}
        >
          <div className="overflow-hidden rounded-2xl bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-md">
            <div className="border-b border-stone-100/80 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-stone-900">Map layers</h3>
              <p className="mt-0.5 text-[11px] text-stone-500">
                Current: {LAYER_LABELS[activeLayer]}
              </p>
            </div>

            <ul className="flex max-h-[min(26rem,62vh)] flex-col gap-0.5 overflow-y-auto p-1.5">
              {LIVE_MAP_LAYER_OPTIONS.map((option) => {
                const selected = activeLayer === option.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => selectLayer(option.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
                        selected
                          ? "border border-[#007F73] bg-[#E6F7F4]"
                          : "border border-transparent hover:bg-stone-50"
                      }`}
                      aria-pressed={selected}
                    >
                      <LayerPreview option={option} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-semibold ${selected ? "text-[#007F73]" : "text-stone-800"}`}
                          >
                            {option.label}
                          </span>
                          <LayerOptionIcon icon={option.icon} />
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                          {option.description}
                        </p>
                      </div>
                      {selected ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007F73] text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                        </span>
                      ) : (
                        <span className="h-6 w-6 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {onTravelLayerChange || onSeaRoutesChange || onCruiseRoutesChange || onFootRoutesChange || onFriendTrackingChange ? (
              <div className="border-t border-stone-100/80 p-2">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Overlays
                </p>
                <div className="flex flex-col gap-1">
                  {onFriendTrackingChange ? (
                    <OverlayToggle
                      enabled={friendTrackingEnabled}
                      onChange={onFriendTrackingChange}
                      title="Friend tracking"
                      description="Show/hide live coordinates of group members on the map"
                      preview={
                        <div
                          className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-inner ${
                            friendTrackingEnabled
                              ? "border-[#0F766E]/30 bg-gradient-to-br from-[#E6F7F4] via-white to-[#D1FAE5]"
                              : "border-stone-200/80 bg-gradient-to-br from-[#F8FAFC] via-white to-[#E2E8F0]"
                          }`}
                          aria-hidden
                        >
                          <Users
                            className={`h-4 w-4 ${friendTrackingEnabled ? "text-[#0F766E]" : "text-stone-500"}`}
                          />
                        </div>
                      }
                    />
                  ) : null}
                  {onTravelLayerChange ? (
                    <OverlayToggle
                      enabled={travelLayerEnabled}
                      onChange={onTravelLayerChange}
                      title="Travel layer"
                      description="Highways, city routes, railways & transit"
                      preview={
                        <div
                          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-inner ${
                            travelLayerEnabled
                              ? "border-[#007F73]/30 bg-gradient-to-br from-[#E6F7F4] via-white to-[#D1FAE5]"
                              : "border-stone-200/80 bg-gradient-to-br from-[#F8FAFC] via-white to-[#E2E8F0]"
                          }`}
                          aria-hidden
                        >
                          <Route className="h-4 w-4 text-[#007F73]" />
                          <Train className="absolute bottom-1.5 right-1.5 h-3 w-3 text-stone-500" />
                        </div>
                      }
                    />
                  ) : null}
                  {onSeaRoutesChange ? (
                    <OverlayToggle
                      enabled={seaRoutesEnabled}
                      onChange={onSeaRoutesChange}
                      title="Sea routes"
                      description="Sky-blue shipping lanes & teal ferry links (zoom in for ferries)"
                      preview={
                        <div
                          className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-inner ${
                            seaRoutesEnabled
                              ? "border-blue-400/50 bg-gradient-to-br from-[#0C4A6E] via-[#0369A1] to-[#38BDF8]"
                              : "border-stone-200/80 bg-gradient-to-br from-[#F8FAFC] via-white to-[#E2E8F0]"
                          }`}
                          aria-hidden
                        >
                          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
                            <path
                              d="M4 28 Q14 18 22 22 T36 14"
                              fill="none"
                              stroke={seaRoutesEnabled ? "#7DD3FC" : "#94A3B8"}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8 32 Q18 26 28 30"
                              fill="none"
                              stroke={seaRoutesEnabled ? "#5EEAD4" : "#CBD5E1"}
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                              strokeLinecap="round"
                            />
                          </svg>
                          <Ship
                            className={`relative h-3.5 w-3.5 ${seaRoutesEnabled ? "text-white" : "text-blue-600"}`}
                          />
                        </div>
                      }
                    />
                  ) : null}
                  {onCruiseRoutesChange ? (
                    <OverlayToggle
                      enabled={cruiseRoutesEnabled}
                      onChange={onCruiseRoutesChange}
                      title="Cruise routes"
                      description="Gold cruise paths — visible worldwide on satellite"
                      preview={
                        <div
                          className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-inner ${
                            cruiseRoutesEnabled
                              ? "border-amber-400/50 bg-gradient-to-br from-[#78350F] via-[#B45309] to-[#FBBF24]"
                              : "border-stone-200/80 bg-gradient-to-br from-[#F8FAFC] via-white to-[#E2E8F0]"
                          }`}
                          aria-hidden
                        >
                          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
                            <path
                              d="M6 26 Q20 8 34 24"
                              fill="none"
                              stroke={cruiseRoutesEnabled ? "#FDE68A" : "#94A3B8"}
                              strokeWidth="2.5"
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                          </svg>
                          <Sailboat
                            className={`relative h-3.5 w-3.5 ${cruiseRoutesEnabled ? "text-white" : "text-violet-600"}`}
                          />
                        </div>
                      }
                    />
                  ) : null}
                  {onFootRoutesChange ? (
                    <OverlayToggle
                      enabled={footRoutesEnabled}
                      onChange={onFootRoutesChange}
                      title="Foot routes"
                      description="Green trekking trails & hiking paths worldwide (OSM)"
                      preview={
                        <div
                          className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-inner ${
                            footRoutesEnabled
                              ? "border-emerald-400/50 bg-gradient-to-br from-[#14532D] via-[#166534] to-[#4ADE80]"
                              : "border-stone-200/80 bg-gradient-to-br from-[#F8FAFC] via-white to-[#E2E8F0]"
                          }`}
                          aria-hidden
                        >
                          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
                            <path
                              d="M6 30 Q14 14 22 20 T34 10"
                              fill="none"
                              stroke={footRoutesEnabled ? "#BBF7D0" : "#94A3B8"}
                              strokeWidth="3"
                              strokeDasharray="3 2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8 34 Q18 24 30 28"
                              fill="none"
                              stroke={footRoutesEnabled ? "#4ADE80" : "#CBD5E1"}
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          <Footprints
                            className={`relative h-3.5 w-3.5 ${footRoutesEnabled ? "text-white" : "text-emerald-700"}`}
                          />
                        </div>
                      }
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {onToggleViewMode ? (
              <div className="border-t border-stone-100/80 p-2">
                <button
                  type="button"
                  onClick={onToggleViewMode}
                  className={`flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    mapViewMode === "3d"
                      ? "bg-[#E6F7F4] text-[#007F73]"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {mapViewMode === "3d" ? "Switch to 2D view" : "Switch to 3D view"}
                </button>
              </div>
            ) : null}
            {onToggleFullscreen || onToggleSound || onToggleNotifications || onResetNorth ? (
              <div className="border-t border-stone-100/80 p-2">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Map settings & tools
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {onToggleFullscreen && (
                    <button
                      type="button"
                      onClick={onToggleFullscreen}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                        isFullscreen
                          ? "bg-[#E6F7F4] text-[#007F73] border border-[#007F73]/25"
                          : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-transparent"
                      }`}
                    >
                      {isFullscreen ? "Exit Full" : "Fullscreen"}
                    </button>
                  )}
                  {onToggleSound && (
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                        soundEnabled
                          ? "bg-[#E6F7F4] text-[#007F73] border border-[#007F73]/25"
                          : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-transparent"
                      }`}
                    >
                      {soundEnabled ? "Sound On" : "Sound Off"}
                    </button>
                  )}
                  {onToggleNotifications && (
                    <button
                      type="button"
                      onClick={onToggleNotifications}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                        notificationsEnabled
                          ? "bg-[#E6F7F4] text-[#007F73] border border-[#007F73]/25"
                          : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-transparent"
                      }`}
                    >
                      {notificationsEnabled ? "Notifs On" : "Notifs Off"}
                    </button>
                  )}
                  {onResetNorth && (
                    <button
                      type="button"
                      onClick={onResetNorth}
                      className="flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold bg-stone-50 text-stone-700 hover:bg-stone-100 border border-transparent cursor-pointer"
                    >
                      Reset North
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
