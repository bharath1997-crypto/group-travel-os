"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Layers, Map, Moon, Mountain, Satellite, Sparkles } from "lucide-react";
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

type Props = {
  activeLayer: LiveMapLayer;
  onLayerChange: (layer: LiveMapLayer) => void;
  /** Controlled open state — used when opened from Map Tools. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the floating layers orb (panel only). Default true. */
  showTrigger?: boolean;
  mapViewMode?: "2d" | "3d";
  onToggleViewMode?: () => void;
};

export default function LiveMapLayerControl({
  activeLayer,
  onLayerChange,
  open: openProp,
  onOpenChange,
  showTrigger = true,
  mapViewMode,
  onToggleViewMode,
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
          className={`pointer-events-auto absolute bottom-full left-0 z-[60] w-[min(18.5rem,calc(100vw-2rem))] ${LIVE_MAP_LAYERS_PANEL_OFFSET} max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-md:left-auto max-md:mb-0 max-md:w-auto`}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
