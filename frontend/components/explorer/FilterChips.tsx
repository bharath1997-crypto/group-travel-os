"use client";

type FilterChipsProps = {
  label?: string;
  chips: { label: string; value: string }[];
  active: string;
  onSelect: (value: string) => void;
  wrap?: boolean;
};

export function FilterChips({
  label,
  chips,
  active,
  onSelect,
  wrap = false,
}: FilterChipsProps) {
  return (
    <div className="space-y-2">
      {label ? <p className="text-xs font-bold uppercase tracking-wide text-white/50">{label}</p> : null}
      <div
        className={[
          "gap-2",
          wrap
            ? "flex flex-wrap"
            : "-mx-4 flex overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        ].join(" ")}
      >
        {chips.map((chip) => {
          const isActive = active === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onSelect(chip.value)}
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "border-[#E94560] bg-[#E94560] text-white"
                  : "border-white/10 bg-[#102f55] text-white/75 hover:border-[#E94560]/60 hover:text-white",
              ].join(" ")}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
