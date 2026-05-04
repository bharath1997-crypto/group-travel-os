"use client";

export type PlatformChip = {
  label: string;
  value: string;
  comingSoon?: boolean;
};

type PlatformChipsProps = {
  chips: PlatformChip[];
  active: string;
  onSelect: (value: string) => void;
  onComingSoon: (label: string) => void;
};

export function PlatformChips({
  chips,
  active,
  onSelect,
  onComingSoon,
}: PlatformChipsProps) {
  return (
    <section className="space-y-3">
      <p className="text-sm font-bold text-white">Browse by platform</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {chips.map((chip) => {
          const isActive = active === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                chip.comingSoon ? onComingSoon(chip.label) : onSelect(chip.value)
              }
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
    </section>
  );
}
