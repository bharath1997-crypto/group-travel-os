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
    },
    [onLayerChange],
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
          className={`pointer-events-auto absolute bottom-full left-0 z-[60] ${LIVE_MAP_LAYERS_PANEL_OFFSET}`}
        >
          <div className="overflow-hidden rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-800/30 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md p-2.5 flex items-center gap-3 w-[min(32rem,calc(100vw-2rem))] select-none">
            
            {/* Left section: Main Layers */}
            <div className="flex items-center gap-2 shrink-0">
              {LIVE_MAP_LAYER_OPTIONS.map((option) => {
                const selected = activeLayer === option.id;
                const labelText = option.label.replace(" Map", "");
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectLayer(option.id)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                    aria-pressed={selected}
                  >
                    {/* Frame container */}
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        selected
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <LayerPreview option={option} />
                      {selected && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    {/* Downside: EXACT model/layer name */}
                    <span
                      className={`text-[9px] font-extrabold tracking-wide transition-colors ${
                        selected ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"
                      }`}
                    >
                      {labelText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Small Single Divider Line */}
            <div className="h-10 w-px bg-stone-300/80 dark:bg-stone-700/80 shrink-0 self-center" />

            {/* Right section: Horizontal Overlays Slider */}
            <div className="flex-1 overflow-hidden relative">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5 select-none scroll-smooth">
                
                {/* Overlay 1: Friend tracking */}
                {onFriendTrackingChange && (
                  <button
                    type="button"
                    onClick={() => onFriendTrackingChange(!friendTrackingEnabled)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        friendTrackingEnabled
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Users className={`h-4.5 w-4.5 ${friendTrackingEnabled ? "text-[#007F73]" : "text-stone-500"}`} />
                      {friendTrackingEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${friendTrackingEnabled ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      Friends
                    </span>
                  </button>
                )}

                {/* Overlay 2: Travel layer */}
                {onTravelLayerChange && (
                  <button
                    type="button"
                    onClick={() => onTravelLayerChange(!travelLayerEnabled)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        travelLayerEnabled
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Route className={`h-4.5 w-4.5 ${travelLayerEnabled ? "text-[#007F73]" : "text-stone-500"}`} />
                      {travelLayerEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${travelLayerEnabled ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      Travel
                    </span>
                  </button>
                )}

                {/* Overlay 3: Sea routes */}
                {onSeaRoutesChange && (
                  <button
                    type="button"
                    onClick={() => onSeaRoutesChange(!seaRoutesEnabled)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        seaRoutesEnabled
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Ship className={`h-4.5 w-4.5 ${seaRoutesEnabled ? "text-[#007F73]" : "text-stone-500"}`} />
                      {seaRoutesEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${seaRoutesEnabled ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      Sea
                    </span>
                  </button>
                )}

                {/* Overlay 4: Cruise routes */}
                {onCruiseRoutesChange && (
                  <button
                    type="button"
                    onClick={() => onCruiseRoutesChange(!cruiseRoutesEnabled)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        cruiseRoutesEnabled
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Sailboat className={`h-4.5 w-4.5 ${cruiseRoutesEnabled ? "text-[#007F73]" : "text-stone-500"}`} />
                      {cruiseRoutesEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${cruiseRoutesEnabled ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      Cruise
                    </span>
                  </button>
                )}

                {/* Overlay 5: Foot routes */}
                {onFootRoutesChange && (
                  <button
                    type="button"
                    onClick={() => onFootRoutesChange(!footRoutesEnabled)}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        footRoutesEnabled
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Footprints className={`h-4.5 w-4.5 ${footRoutesEnabled ? "text-[#007F73]" : "text-stone-500"}`} />
                      {footRoutesEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${footRoutesEnabled ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      Foot
                    </span>
                  </button>
                )}

                {/* Optional: 3D perspective Toggle */}
                {onToggleViewMode && (
                  <button
                    type="button"
                    onClick={onToggleViewMode}
                    className="group flex flex-col items-center gap-0.5 focus:outline-none cursor-pointer shrink-0"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
                        mapViewMode === "3d"
                          ? "border-[#007F73] bg-[#E6F7F4]/90 shadow-sm ring-1 ring-[#007F73]/20"
                          : "border-stone-200/50 bg-white/60 dark:bg-slate-800/50 hover:bg-white hover:border-stone-300"
                      }`}
                    >
                      <Mountain className={`h-4.5 w-4.5 ${mapViewMode === "3d" ? "text-[#007F73]" : "text-stone-500"}`} />
                      {mapViewMode === "3d" && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007F73] text-white shadow-sm ring-1 ring-white">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wide transition-colors ${mapViewMode === "3d" ? "text-[#007F73]" : "text-stone-500 group-hover:text-stone-700"}`}>
                      3D View
                    </span>
                  </button>
                )}

              </div>
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
