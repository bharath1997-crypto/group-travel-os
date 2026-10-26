import { nearestDirectoryCity, type DirectoryNearestCity } from "./explore-directory-api";
import { resolveScaperMetroCity } from "./explore-scaper-metro";

const LS_LAST_CITY = "rovvy_explore_directory_city";

export type DirectoryHubResolution = {
  fetchCity: string;
  label: string;
  stateSlug?: string;
  citySlug?: string;
  source: "gps" | "saved" | "fallback";
};

export function readSavedDirectoryCity(): DirectoryNearestCity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_LAST_CITY);
    if (!raw) return null;
    return JSON.parse(raw) as DirectoryNearestCity;
  } catch {
    return null;
  }
}

export function writeSavedDirectoryCity(hit: DirectoryNearestCity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_LAST_CITY, JSON.stringify(hit));
}

/** Browser GPS → nearest directory city; server receives city + state only. */
export async function resolveExploreHubFromGps(
  lat: number,
  lng: number,
): Promise<DirectoryHubResolution | null> {
  const hit = await nearestDirectoryCity(lat, lng);
  if (!hit) return null;
  writeSavedDirectoryCity(hit);
  return {
    fetchCity: hit.name,
    label: hit.state_name ? `${hit.name}, ${hit.state_name}` : hit.name,
    stateSlug: hit.state_slug,
    citySlug: hit.slug,
    source: "gps",
  };
}

export function resolveExploreHubFromSavedOrFallback(fallbackCity: string): DirectoryHubResolution {
  const saved = readSavedDirectoryCity();
  if (saved) {
    return {
      fetchCity: saved.name,
      label: saved.state_name ? `${saved.name}, ${saved.state_name}` : saved.name,
      stateSlug: saved.state_slug,
      citySlug: saved.slug,
      source: "saved",
    };
  }
  const metro = resolveScaperMetroCity({ fallbackCity });
  return { fetchCity: metro, label: metro, source: "fallback" };
}
