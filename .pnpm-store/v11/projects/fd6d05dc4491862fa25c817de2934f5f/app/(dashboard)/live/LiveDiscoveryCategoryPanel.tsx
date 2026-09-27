"use client";

import { useMemo } from "react";
import {
  DISCOVERY_LAYER_CATEGORY_OPTIONS,
  type DiscoveryLayerCategoryKey,
} from "./live-map-discovery-categories";
import { LIVE_DISCOVERY_MIN_ZOOM } from "./live-map-discovery-layer-session";

type Props = {
  selectedKeys: DiscoveryLayerCategoryKey[];
  mapZoom: number;
  layerEnabled: boolean;
  onToggleKey: (key: DiscoveryLayerCategoryKey) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEnableLayer: () => void;
};

export default function LiveDiscoveryCategoryPanel({
  selectedKeys,
  mapZoom,
  layerEnabled,
  onToggleKey,
  onSelectAll,
  onClearAll,
  onEnableLayer,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof DISCOVERY_LAYER_CATEGORY_OPTIONS>();
    for (const opt of DISCOVERY_LAYER_CATEGORY_OPTIONS) {
      const list = map.get(opt.groupLabel) ?? [];
      list.push(opt);
      map.set(opt.groupLabel, list);
    }
    return [...map.entries()];
  }, []);

  const zoomOk = mapZoom >= LIVE_DISCOVERY_MIN_ZOOM;

  return (
    <div className="flex flex-col gap-3 px-1 pb-2">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">Map categories</h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">
          Choose what appears as teal pins on the map. Nearby places cluster into numbered circles when
          they are too close — hover for help, click to zoom in and split the group.
        </p>
      </div>

      {!zoomOk ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Zoom to z{LIVE_DISCOVERY_MIN_ZOOM}+ to load pins for the area on your screen (not the whole
          world). Pan to another region to refresh.
        </p>
      ) : null}

      {!layerEnabled ? (
        <button
          type="button"
          onClick={onEnableLayer}
          className="rounded-full bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white hover:brightness-105"
        >
          Turn on map pins for selected categories
        </button>
      ) : (
        <p className="text-[11px] font-medium text-[#0F766E]">Map pins on · {selectedKeys.length} categories</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
        >
          Clear
        </button>
      </div>

      <div className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain pr-1 space-y-4">
        {grouped.map(([groupLabel, options]) => (
          <div key={groupLabel}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
              {groupLabel}
            </p>
            <ul className="space-y-1">
              {options.map((opt) => {
                const checked = selectedSet.has(opt.key as DiscoveryLayerCategoryKey);
                return (
                  <li key={opt.key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F1EFE8]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleKey(opt.key as DiscoveryLayerCategoryKey)}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      <span className="text-base leading-none" aria-hidden>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-medium text-stone-800">{opt.mapLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
