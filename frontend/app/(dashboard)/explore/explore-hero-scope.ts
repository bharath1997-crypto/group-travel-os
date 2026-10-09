import type { HeroResponse } from "@/lib/hero-location";

import type { ExploreLocationScope } from "./explore-location-scope";
import { resolveScaperMetroCity } from "./explore-scaper-metro";

/** Build hub location scope from hero resolution (GPS → neighbourhood → IP → city). */
export function exploreLocationScopeFromHero(
  hero: HeroResponse,
  coords?: { lat: number; lon: number } | null,
): ExploreLocationScope {
  const lat = coords?.lat ?? hero.photo?.lat ?? undefined;
  const lon = coords?.lon ?? hero.photo?.lon ?? undefined;
  const hubCity = hero.city?.split(",")[0].trim() || undefined;
  const neighbourhood =
    hero.placeLabel?.split(",")[0]?.trim() || hubCity || undefined;
  const label =
    hero.placeLabel?.trim() ||
    [hubCity, hero.region, hero.country].filter(Boolean).join(", ") ||
    hubCity ||
    "Explore area";
  const fetchCity = resolveScaperMetroCity({
    lat: lat != null && Number.isFinite(lat) ? lat : null,
    lon: lon != null && Number.isFinite(lon) ? lon : null,
    fallbackCity: hubCity,
  });

  return {
    label,
    fetchCity,
    city: neighbourhood,
    state: hero.region ?? undefined,
    country: hero.country ?? undefined,
    lat: lat != null && Number.isFinite(lat) ? lat : undefined,
    lon: lon != null && Number.isFinite(lon) ? lon : undefined,
  };
}
