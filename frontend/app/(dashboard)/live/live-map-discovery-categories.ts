import { LIVE_SEARCH_CATEGORIES, LIVE_SEARCH_GROUPS } from "./live-search-categories";

/** Categories users can toggle for the map discovery layer (point POIs only). */
export const DISCOVERY_LAYER_SELECTABLE_KEYS = [
  "parks",
  "national_parks",
  "forests",
  "waterfalls",
  "mountains",
  "rock_formations",
  "beaches",
  "viewpoints",
  "scenic_drives",
  "historic_sites",
  "monuments",
  "capitals",
  "landmarks",
  "museums",
  "churches",
] as const;

export type DiscoveryLayerCategoryKey = (typeof DISCOVERY_LAYER_SELECTABLE_KEYS)[number];

export const DISCOVERY_LAYER_DEFAULT_KEYS: DiscoveryLayerCategoryKey[] = [
  "parks",
  "national_parks",
  "capitals",
  "historic_sites",
  "monuments",
  "viewpoints",
];

const SESSION_KEY = "rovvy_live_discovery_category_keys_v1";

export type DiscoveryLayerCategoryOption = {
  key: string;
  mapLabel: string;
  icon: string;
  group: string;
  groupLabel: string;
};

const groupLabelById = new Map(LIVE_SEARCH_GROUPS.map((g) => [g.id, g.label]));

export const DISCOVERY_LAYER_CATEGORY_OPTIONS: DiscoveryLayerCategoryOption[] =
  LIVE_SEARCH_CATEGORIES.filter((c) =>
    (DISCOVERY_LAYER_SELECTABLE_KEYS as readonly string[]).includes(c.key),
  ).map((c) => ({
    key: c.key,
    mapLabel: c.mapLabel,
    icon: c.icon,
    group: c.group ?? "nature",
    groupLabel: groupLabelById.get(c.group ?? "nature") ?? "Places",
  }));

export function readDiscoveryCategorySelection(): DiscoveryLayerCategoryKey[] {
  if (typeof window === "undefined") return [...DISCOVERY_LAYER_DEFAULT_KEYS];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [...DISCOVERY_LAYER_DEFAULT_KEYS];
    const parsed = JSON.parse(raw) as string[];
    const allowed = new Set(DISCOVERY_LAYER_SELECTABLE_KEYS as readonly string[]);
    const keys = parsed.filter((k) => allowed.has(k)) as DiscoveryLayerCategoryKey[];
    return keys.length > 0 ? keys : [...DISCOVERY_LAYER_DEFAULT_KEYS];
  } catch {
    return [...DISCOVERY_LAYER_DEFAULT_KEYS];
  }
}

export function writeDiscoveryCategorySelection(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function buildDiscoveryCatsParam(keys: string[]): string {
  const allowed = new Set(DISCOVERY_LAYER_SELECTABLE_KEYS as readonly string[]);
  const filtered = keys.filter((k) => allowed.has(k));
  if (filtered.length === 0) return DISCOVERY_LAYER_DEFAULT_KEYS.join(",");
  return filtered.join(",");
}
