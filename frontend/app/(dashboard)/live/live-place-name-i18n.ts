import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/safe-fetch";
import type { PlacePreviewData } from "./PlacePreviewCard";
import {
  isMostlyLatinPlaceName,
  transliteratePlaceNameToLatin,
} from "./live-place-transliteration";

export type PlaceNameDisplayResult = {
  displayName: string;
  originalName?: string | null;
  sourceLanguageCode?: string | null;
  sourceLanguageLabel?: string | null;
  translated: boolean;
};

const displayNameCache = new Map<string, PlaceNameDisplayResult>();
const DISPLAY_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

const COUNTRY_LANGUAGE: Record<string, { code: string; label: string }> = {
  russia: { code: "ru", label: "Russian" },
  "russian federation": { code: "ru", label: "Russian" },
  ukraine: { code: "uk", label: "Ukrainian" },
  belarus: { code: "be", label: "Belarusian" },
  bulgaria: { code: "bg", label: "Bulgarian" },
  serbia: { code: "sr", label: "Serbian" },
  greece: { code: "el", label: "Greek" },
};

function cacheKey(place: Pick<PlacePreviewData, "name" | "lat" | "lng" | "osmType" | "osmId">): string {
  return `${place.lat.toFixed(5)},${place.lng.toFixed(5)}|${place.name.trim().toLowerCase()}|${place.osmType ?? ""}:${place.osmId ?? ""}`;
}

function readCached(key: string): PlaceNameDisplayResult | undefined {
  const at = cacheTimestamps.get(key);
  if (at == null || Date.now() - at > DISPLAY_NAME_CACHE_TTL_MS) {
    displayNameCache.delete(key);
    cacheTimestamps.delete(key);
    return undefined;
  }
  return displayNameCache.get(key);
}

function writeCache(key: string, value: PlaceNameDisplayResult): void {
  displayNameCache.set(key, value);
  cacheTimestamps.set(key, Date.now());
}

export function detectSourceLanguageLabel(
  name: string,
  country?: string | null,
): { code: string; label: string } | null {
  const cleaned = name.trim();
  if (!cleaned || isMostlyLatinPlaceName(cleaned)) return null;

  const countryHit = country ? COUNTRY_LANGUAGE[country.trim().toLowerCase()] : undefined;
  const letters = [...cleaned].filter((char) => /\p{L}/u.test(char));
  const cyrillic = letters.filter((char) => /[\u0400-\u04FF]/.test(char)).length;
  const greek = letters.filter((char) => /[\u0370-\u03FF]/.test(char)).length;

  if (letters.length > 0) {
    const ratio = (count: number) => count / letters.length;
    if (ratio(cyrillic) > 0.3) {
      if (countryHit?.code === "uk") return { code: "uk", label: "Ukrainian" };
      return { code: "ru", label: "Russian" };
    }
    if (ratio(greek) > 0.3) return { code: "el", label: "Greek" };
  }

  return countryHit ?? null;
}

function normalizeDisplayNameResponse(data: Record<string, unknown>): PlaceNameDisplayResult {
  const displayName = String(data.displayName ?? data.display_name ?? "").trim();
  return {
    displayName,
    originalName: (data.originalName ?? data.original_name ?? null) as string | null,
    sourceLanguageCode: (data.sourceLanguageCode ?? data.source_language_code ?? null) as string | null,
    sourceLanguageLabel: (data.sourceLanguageLabel ?? data.source_language_label ?? null) as string | null,
    translated: Boolean(data.translated),
  };
}

function resolvePlaceDisplayNameLocally(
  place: Pick<PlacePreviewData, "name" | "country">,
): PlaceNameDisplayResult {
  const name = place.name.trim();
  const detected = detectSourceLanguageLabel(name, place.country);
  const latin = transliteratePlaceNameToLatin(name);
  if (!latin || !detected) {
    return { displayName: name, translated: false };
  }

  return {
    displayName: latin,
    originalName: name,
    sourceLanguageCode: detected.code,
    sourceLanguageLabel: detected.label,
    translated: true,
  };
}

export async function fetchPlaceDisplayName(
  place: Pick<PlacePreviewData, "name" | "lat" | "lng" | "osmType" | "osmId" | "country">,
): Promise<PlaceNameDisplayResult> {
  const name = place.name?.trim();
  if (!name || isMostlyLatinPlaceName(name)) {
    return { displayName: name, translated: false };
  }

  const key = cacheKey({ ...place, name });
  const cached = readCached(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    name,
    lat: String(place.lat),
    lng: String(place.lng),
  });
  if (place.osmType) params.set("osm_type", place.osmType);
  if (place.osmId != null) params.set("osm_id", String(place.osmId));
  if (place.country) params.set("country", place.country);

  let result: PlaceNameDisplayResult | null = null;
  try {
    const data = await apiFetch<Record<string, unknown>>(`/geocoding/display-name?${params.toString()}`);
    const normalized = normalizeDisplayNameResponse(data);
    if (normalized.displayName && normalized.translated) {
      result = normalized;
    }
  } catch {
    result = null;
  }

  if (!result?.translated) {
    result = resolvePlaceDisplayNameLocally(place);
  }

  writeCache(key, result);
  return result;
}

export function applyPlaceNameDisplay(
  place: PlacePreviewData,
  display: PlaceNameDisplayResult,
): PlacePreviewData {
  if (!display.translated) return place;
  return {
    ...place,
    name: display.displayName,
    nameOriginal: display.originalName ?? place.name,
    nameSourceLanguage: display.sourceLanguageLabel ?? null,
    nameTranslated: true,
  };
}

export async function enrichPlaceDisplayName(place: PlacePreviewData): Promise<PlacePreviewData> {
  if (place.nameTranslated || isMostlyLatinPlaceName(place.name)) return place;
  const display = await fetchPlaceDisplayName(place);
  return applyPlaceNameDisplay(place, display);
}

/** Keeps preview titles in readable Latin letters if parent state has not caught up yet. */
export function useLivePlaceDisplayName(place: PlacePreviewData): PlacePreviewData {
  const [resolved, setResolved] = useState(place);

  useEffect(() => {
    setResolved(place);
    if (place.nameTranslated || isMostlyLatinPlaceName(place.name)) return;

    let cancelled = false;
    void enrichPlaceDisplayName(place)
      .then((next) => {
        if (!cancelled) setResolved(next);
      })
      .catch(() => {
        if (!cancelled) setResolved(place);
      });

    return () => {
      cancelled = true;
    };
  }, [place.lat, place.lng, place.name, place.nameTranslated, place.country, place.osmType, place.osmId]);

  return resolved;
}

export { isMostlyLatinPlaceName };
