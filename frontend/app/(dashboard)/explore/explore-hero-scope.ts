import type { HeroResponse } from "@/lib/hero-location";

import type { ExploreLocationScope } from "./explore-location-scope";

/** Build hub location scope from hero resolution (GPS → neighbourhood → IP → city). */
export function exploreLocationScopeFromHero(
  hero: HeroResponse,
  coords?: { lat: number; lon: number } | null,
): ExploreLocationScope {
  const lat = coords?.lat ?? hero.photo?.lat ?? undefined;
  const lon = coords?.lon ?? hero.photo?.lon ?? undefined;
  const city = hero.city?.split(",")[0].trim() || undefined;
  const label =
    hero.placeLabel?.trim() ||
    [city, hero.region, hero.country].filter(Boolean).join(", ") ||
    city ||
    "Explore area";

  return {
    label,
    fetchCity: city,
    city,
    state: hero.region ?? undefined,
    country: hero.country ?? undefined,
    lat: lat != null && Number.isFinite(lat) ? lat : undefined,
    lon: lon != null && Number.isFinite(lon) ? lon : undefined,
  };
}
