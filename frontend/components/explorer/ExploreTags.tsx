"use client";

const DEFAULT_PILLS = [
  "Things to do in Chicago",
  "Free activities near me",
  "Events this weekend",
  "Best restaurants for groups",
  "Outdoor activities",
  "Nightlife near me",
  "Museums near me",
  "Concerts tonight",
  "Group trip planner",
  "Hidden gems in US cities",
  "Chicago travel packages",
  "New York weekend events",
  "Best sights in Los Angeles",
  "Miami budget friendly spots",
  "Las Vegas group booking",
  "San Francisco tour itineraries",
  "Orlando theme park guide",
  "Seattle outdoor activities",
  "Family vacation planner app",
  "Live music concerts tonight",
];

type ExploreTagsProps = {
  pills?: string[];
  title?: string;
};

export function ExploreTags({
  pills = DEFAULT_PILLS,
  title = "Explore more on Rovvy",
}: ExploreTagsProps) {
  return (
    <div>
      <h3 className="text-sm font-extrabold text-slate-900 tracking-widest uppercase mb-5">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {pills.map((pill) => (
          <span
            key={pill}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold px-4 py-2.5 rounded-full text-slate-600 select-all cursor-text hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300 transition-colors"
          >
            {pill}
          </span>
        ))}
      </div>
    </div>
  );
}
