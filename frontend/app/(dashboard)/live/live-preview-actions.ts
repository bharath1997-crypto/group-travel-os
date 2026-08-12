import { apiFetch, apiFetchWithStatus, ApiFetchError } from "@/lib/safe-fetch";
import { getToken } from "@/lib/auth";
import type { PlacePreviewData } from "./PlacePreviewCard";
import type { RouteOrigin } from "./live-types";

export type LiveAddLocationResult = {
  savedLocally: boolean;
  syncedToAccount: boolean;
  pinId?: string;
  created?: boolean;
};

export type LiveStartDirectionResult = {
  ok: boolean;
  sessionId?: string | null;
  message?: string | null;
};

export async function addLivePreviewLocation(
  place: PlacePreviewData,
): Promise<LiveAddLocationResult> {
  const token = getToken();
  if (!token) {
    return { savedLocally: true, syncedToAccount: false };
  }

  // apiFetchWithStatus surfaces the HTTP status instead of throwing, so an
  // expired/rejected token can degrade to a local-only save.
  const { data, status } = await apiFetchWithStatus<{
    pinId: string;
    name: string;
    latitude: number;
    longitude: number;
    created: boolean;
  }>(
    "/live/places/add-location",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        address: place.address || null,
        categoryLabel: place.categoryLabel || null,
        placeKey: place.placeKey ?? null,
      }),
    },
  );

  if (status === 401 || status === 403) {
    return { savedLocally: true, syncedToAccount: false };
  }
  if (!data) {
    throw new ApiFetchError(`Could not save this location (status ${status}).`);
  }

  return {
    savedLocally: true,
    syncedToAccount: true,
    pinId: data.pinId,
    created: data.created,
  };
}

export async function startLivePreviewDirection(input: {
  origin: RouteOrigin;
  destination: PlacePreviewData;
  travelMode: string;
  /** RouteOrigin carries no country; callers that know it can pass it through. */
  originCountry?: string | null;
}): Promise<LiveStartDirectionResult> {
  try {
    const response = await apiFetch<{
      status: "ready" | "failed";
      sessionId?: string | null;
      message?: string | null;
    }>(
      "/live/directions/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: {
            latitude: input.origin.latitude,
            longitude: input.origin.longitude,
            source: input.origin.source,
            country: input.originCountry ?? null,
          },
          destination: {
            latitude: input.destination.lat,
            longitude: input.destination.lng,
            name: input.destination.name ?? null,
            country: input.destination.country ?? null,
          },
          travelMode: input.travelMode,
        }),
      },
      120_000,
    );
    return {
      ok: response.status === "ready",
      sessionId: response.sessionId ?? null,
      message: response.message ?? null,
    };
  } catch (err) {
    if (err instanceof ApiFetchError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: "Directions service unavailable." };
  }
}
