"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Layers, Map, Moon, Satellite, Sparkles } from "lucide-react";
import type { LiveMapLayer } from "@/lib/map-providers";

const LIVE_MAP_LAYER_OPTIONS = [
  {
    id: "street" as const,
    label: "Detailed Map",
    description: "Full street detail",
    icon: "map" as const,
    previewClass: "bg-gradient-to-br from-[#E8F5F3] via-[#F8FAFC] to-[#D1FAE5]",
  },
  {
    id: "clean" as const,
    label: "Clean Map",
    description: "Simplified street view",
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
    case "layers":
      return <Layers className={className} aria-hidden />;
    case "moon":
      return <Moon className={className} aria-hidden />;
  }
}

function LayerPreview({ option }: { option: (typeof LIVE_MAP_LAYER_OPTIONS)[number] }) {
  return (
    <div
      className={`relative h-11 w-11 shrink-0 rounded-xl border border-stone-200/80 shadow-inner ${option.previewClass}`}
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
      {option.id === "dark" ? (
        <div className="absolute inset-x-2 top-4 h-px bg-white/15" />
      ) : null}
    </div>
  );
}

type Props = {
  activeLayer: LiveMapLayer;
  onLayerChange: (layer: LiveMapLayer) => void;
};

export default function LiveMapLayerControl({ activeLayer, onLayerChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const selectLayer = useCallback(
    (layer: LiveMapLayer) => {
      onLayerChange(layer);
      setOpen(false);
    },
    [onLayerChange],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
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
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-col items-center">
      <button
        type="button"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 md:h-10 md:w-10 ${
          open ? "ring-2 ring-[#0F766E]/30" : ""
        }`}
        onClick={() => setOpen((prev) => !prev)}
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Layers
          className={`h-5 w-5 transition-colors ${open || activeLayer !== "street" ? "text-[#0F766E]" : "text-stone-500"}`}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Map layers"
          className="absolute bottom-0 right-full z-50 mr-2.5 w-[min(18.5rem,calc(100vw-2rem))] max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] max-md:right-auto max-md:mr-0 max-md:w-auto"
        >
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-md">
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-stone-900">Map layers</h3>
              <p className="mt-0.5 text-[11px] text-stone-500">
                Current: {LAYER_LABELS[activeLayer]}
              </p>
            </div>

            <ul className="flex flex-col gap-1 p-2 max-h-[min(24rem,60vh)] overflow-y-auto">
              {LIVE_MAP_LAYER_OPTIONS.map((option) => {
                const selected = activeLayer === option.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => selectLayer(option.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                        selected
                          ? "bg-[#0F766E]/10 ring-1 ring-[#0F766E]/35"
                          : "hover:bg-stone-50"
                      }`}
                      aria-pressed={selected}
                    >
                      <LayerPreview option={option} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-semibold ${selected ? "text-[#0F766E]" : "text-stone-800"}`}
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
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-white">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
