"use client";

const BORDER = "#E9ECEF";
const CORAL = "#E94560";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
};

export function TabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`sticky top-0 z-10 flex gap-1 overflow-x-auto border-b bg-white pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ borderColor: BORDER }}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition ${
              active
                ? "border-[#E94560] text-[#E94560]"
                : "border-transparent text-[#6C757D] hover:text-[#2C3E50]"
            }`}
            style={active ? { borderColor: CORAL, color: CORAL } : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
