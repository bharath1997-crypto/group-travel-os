/** Map pin category labels used on /explore/map */
export const EXPLORE_MAP_CATEGORIES = [
  "All",
  "Events",
  "Activities",
  "Food",
  "Parks",
  "Nightlife",
  "Gaming",
  "Amusement",
  "Trekking",
  "Landmarks",
  "Shopping",
  "Sports",
] as const;

export type ExploreMapCategory = (typeof EXPLORE_MAP_CATEGORIES)[number];

export function exploreMapHref(category?: string): string {
  if (!category || category === "All") return "/explore/map";
  return `/explore/map?category=${encodeURIComponent(category)}`;
}

/** See-all route → pre-selected map category */
export const SEE_ALL_MAP_CATEGORY: Record<string, ExploreMapCategory> = {
  "/explore/activities": "Activities",
  "/explore/events": "Events",
  "/explore/landmarks": "Landmarks",
  "/explore/trekking": "Trekking",
  "/explore/gaming": "Gaming",
  "/explore/amusement": "Amusement",
  "/explore/food": "Food",
  "/explore/parks": "Parks",
  "/explore/nightlife": "Nightlife",
  "/explore/sports": "Sports",
  "/explore/shopping": "Shopping",
};

export function mapCategoryFromPath(path: string): ExploreMapCategory | undefined {
  return SEE_ALL_MAP_CATEGORY[path.replace(/\/$/, "")];
}

export function isExploreMapCategory(value: string): value is ExploreMapCategory {
  return (EXPLORE_MAP_CATEGORIES as readonly string[]).includes(value);
}

/** Main explore map — tighter local radius */
export const MAIN_MAP_DEFAULT_RADIUS = 50;

/** Category-specific sub-map — nationwide / unlimited search */
export const CATEGORY_MAP_DEFAULT_RADIUS = 500;

export function isCategoryMapMode(category: string | null | undefined): boolean {
  return !!category && category !== "All";
}

/** Match API event categories to map filter pills */
export function matchesMapCategory(
  eventCategory: string | undefined | null,
  mapCategory: string,
): boolean {
  if (mapCategory === "All") return true;
  const cat = (eventCategory || "").trim().toLowerCase();
  const matchers: Record<string, string[]> = {
    Activities: [
      "activities",
      "activity",
      "experience",
      "arts",
      "art",
      "cultural",
      "entertainment",
      "comedy",
      "theatre",
      "theater",
    ],
    Events: ["events", "event", "music", "festival", "concert"],
    Sports: ["sports", "sport", "fitness"],
    Food: ["food", "dining", "restaurant", "drink"],
    Parks: ["parks", "park", "outdoor", "nature"],
    Nightlife: ["nightlife", "club", "bar"],
    Gaming: ["gaming", "game", "esports", "arcade"],
    Amusement: ["amusement", "theme park", "attraction"],
    Trekking: ["trekking", "trek", "hike", "adventure"],
    Landmarks: ["landmarks", "landmark", "photo", "sightseeing"],
    Shopping: ["shopping", "shop", "retail", "market"],
  };
  const keys = matchers[mapCategory];
  if (keys) return keys.some((k) => cat.includes(k));
  return cat === mapCategory.toLowerCase();
}
