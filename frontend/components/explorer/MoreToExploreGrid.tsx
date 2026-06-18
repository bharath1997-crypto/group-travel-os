"use client";

type MoreToExploreGridProps = {
  onCreateTrip?: () => void;
  onOpenMap?: () => void;
  onSplitCosts?: () => void;
};

const CARDS = [
  {
    emoji: "✈️",
    title: "Start a group trip",
    description:
      "Create a shared workspace to coordinate flights, stays, activities, and calendars with your whole crew.",
    cta: "Create Trip",
    gradient: "from-teal-50 to-emerald-50",
    border: "border-teal-100",
    action: "trip" as const,
  },
  {
    emoji: "🗺️",
    title: "Save places to your map",
    description:
      "Pin destinations, routes, restaurants, and hotels to a shared interactive map visible to everyone in your group.",
    cta: "Open Map",
    gradient: "from-sky-50 to-indigo-50",
    border: "border-sky-100",
    action: "map" as const,
  },
  {
    emoji: "💸",
    title: "Split activity costs",
    description:
      "Track shared expenses and activities with automatic calculation of who owes what — zero awkward conversations.",
    cta: "Try Splits",
    gradient: "from-amber-50 to-orange-50",
    border: "border-amber-100",
    action: "split" as const,
  },
] as const;

export function MoreToExploreGrid({
  onCreateTrip,
  onOpenMap,
  onSplitCosts,
}: MoreToExploreGridProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    trip: onCreateTrip,
    map: onOpenMap,
    split: onSplitCosts,
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {CARDS.map((card) => (
        <div
          key={card.title}
          className={`bg-gradient-to-br ${card.gradient} rounded-3xl p-8 border ${card.border} flex flex-col justify-between min-h-[260px] shadow-sm hover:shadow-md transition-shadow duration-300`}
        >
          <div className="space-y-3">
            <span className="text-4xl" role="img" aria-label={card.title}>
              {card.emoji}
            </span>
            <h3 className="font-extrabold text-xl text-slate-900">{card.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{card.description}</p>
          </div>
          <button
            onClick={handlers[card.action]}
            className="bg-[#0F766E] hover:bg-[#0D635C] text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors mt-6 self-start shadow-sm"
          >
            {card.cta}
          </button>
        </div>
      ))}
    </div>
  );
}
