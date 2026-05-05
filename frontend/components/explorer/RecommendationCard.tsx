"use client";

type RecommendationCardProps = {
  icon: string;
  label: string;
  onClick: () => void;
};

export function RecommendationCard({ icon, label, onClick }: RecommendationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-44 shrink-0 rounded-3xl border border-white/10 bg-[#102f55] p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#E94560]/60"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
        {icon}
      </span>
      <p className="mt-4 line-clamp-2 text-sm font-bold text-white">{label}</p>
      <p className="mt-1 text-xs text-white/55">Near you</p>
    </button>
  );
}
