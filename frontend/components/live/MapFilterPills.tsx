"use client";

import {
  Activity,
  AlertTriangle,
  Camera,
  CloudSun,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";

type FilterId = "traffic" | "alerts" | "cameras" | "hazards" | "weather" | "more";

type MapFilterPillsProps = {
  activeFilters: Set<FilterId>;
  onToggleFilter: (id: FilterId) => void;
};

export function MapFilterPills({ activeFilters, onToggleFilter }: MapFilterPillsProps) {
  const pills = [
    { id: "traffic" as const, label: "Live Traffic", icon: Activity },
    { id: "alerts" as const, label: "Alerts", icon: AlertTriangle },
    { id: "cameras" as const, label: "Cameras", icon: Camera },
    { id: "hazards" as const, label: "Hazards", icon: ShieldAlert },
    { id: "weather" as const, label: "Weather", icon: CloudSun },
    { id: "more" as const, label: "More", icon: ChevronDown, isDropdown: true },
  ];

  return (
    <div className="absolute left-3 top-3 z-[110] flex flex-wrap items-center gap-2 pointer-events-auto">
      {pills.map((pill) => {
        const isActive = activeFilters.has(pill.id);
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onToggleFilter(pill.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-sm border transition-all ${
              isActive
                ? "bg-[#0F766E] border-[#0F766E] text-white"
                : "bg-white border-stone-200 text-stone-650 hover:bg-stone-50"
            }`}
          >
            <pill.icon size={13} className={isActive ? "text-white" : "text-stone-500"} />
            <span>{pill.label}</span>
          </button>
        );
      })}
    </div>
  );
}
