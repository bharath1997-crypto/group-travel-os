"use client";

export type MoodOption = {
  label: string;
  value: string;
};

type MoodSelectorProps = {
  moods: MoodOption[];
  active: string;
  onSelect: (value: string) => void;
};

export function MoodSelector({ moods, active, onSelect }: MoodSelectorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#102f55] p-4 shadow-xl sm:p-5">
      <div>
        <h2 className="text-lg font-bold text-white">✨ What&apos;s your mood today?</h2>
        <p className="mt-1 text-sm text-white/60">
          Wayra will suggest the perfect events for you
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {moods.map((mood) => {
          const isActive = active === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              onClick={() => onSelect(isActive ? "" : mood.value)}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm font-bold transition",
                isActive
                  ? "border-[#E94560] bg-[#E94560]/15 text-white"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-[#E94560]/60 hover:text-white",
              ].join(" ")}
            >
              {mood.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
