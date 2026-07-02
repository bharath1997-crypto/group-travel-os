import { apiFetch } from "@/lib/api";
import { buildPlaceKey, extractCityCountry, type PlaceKeyInput } from "./live-place-key";
import type { PlacePreviewData } from "./PlacePreviewCard";

export type PlaceMediaSource =
  | "rovvy_user"
  | "rovvy_admin"
  | "licensed_partner"
  | "open_license";

export type PlaceModerationStatus = "pending" | "approved" | "rejected";

export type PlaceMediaItem = {
  id: string;
  placeKey: string;
  thumbnailUrl: string;
  storageUrl: string;
  caption?: string | null;
  tags: string[];
  source: PlaceMediaSource;
  attribution?: string | null;
  license?: string | null;
  moderationStatus: PlaceModerationStatus;
};

export type PlaceMediaResolution = {
  placeKey: string;
  media: PlaceMediaItem[];
  tags: string[];
};

type ApiPlaceMediaItem = {
  id: string;
  place_key: string;
  thumbnail_url: string;
  storage_url: string;
  caption?: string | null;
  tags?: string[];
  source: PlaceMediaSource;
  attribution?: string | null;
  license?: string | null;
  moderation_status: PlaceModerationStatus;
};

type ApiPlaceMediaResolution = {
  place_key: string;
  media: ApiPlaceMediaItem[];
  tags?: string[];
};

const EMPTY: PlaceMediaResolution = { placeKey: "", media: [], tags: [] };

function mapMediaItem(row: ApiPlaceMediaItem): PlaceMediaItem {
  return {
    id: row.id,
    placeKey: row.place_key,
    thumbnailUrl: row.thumbnail_url,
    storageUrl: row.storage_url,
    caption: row.caption,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    source: row.source,
    attribution: row.attribution,
    license: row.license,
    moderationStatus: row.moderation_status,
  };
}

function mapResolution(data: ApiPlaceMediaResolution): PlaceMediaResolution {
  return {
    placeKey: data.place_key,
    media: (data.media ?? []).map(mapMediaItem),
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
  };
}

export function placePreviewToKeyInput(place: PlacePreviewData): PlaceKeyInput {
  return {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    country: place.country,
    osmType: place.osmType,
    osmId: place.osmId,
  };
}

export function derivePlaceKeyFromPreview(place: PlacePreviewData): string {
  if (place.placeKey) return place.placeKey;
  return buildPlaceKey(placePreviewToKeyInput(place));
}

/**
 * Lazy media resolver — lookup only; does not create registry rows.
 * TODO: upload photo flow → object storage (Supabase / R2 / Firebase / GCS)
 * TODO: moderation queue + tag endpoints
 */
export async function resolvePlaceMedia(
  place: PlacePreviewData,
): Promise<PlaceMediaResolution> {
  const input = placePreviewToKeyInput(place);
  const placeKey = buildPlaceKey(input);
  if (!placeKey) return { ...EMPTY, placeKey };

  try {
    const data = await apiFetch<ApiPlaceMediaResolution>(
      `/live/places/media/resolve`,
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          lat: input.lat,
          lng: input.lng,
          city: input.city ?? null,
          country: input.country ?? null,
          osm_type: input.osmType ?? null,
          osm_id: input.osmId ?? null,
        }),
      },
    );
    return mapResolution(data);
  } catch {
    return { placeKey, media: [], tags: [] };
  }
}

export { buildPlaceKey, extractCityCountry };
