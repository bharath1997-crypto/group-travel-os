import { apiFetch } from "@/lib/safe-fetch";

export type LiveDiscoveryLayerPoint = {
  id?: string;
  placeKey?: string;
  name: string;
  category: string;
  address?: string;
  lat: number;
  lng: number;
  osmType?: string | null;
  osmId?: string | number | null;
  tags?: Record<string, unknown>;
  gersId?: string | null;
  spine?: Record<string, unknown> | null;
};

export type LiveDiscoveryLayerResponse = {
  points: LiveDiscoveryLayerPoint[];
  cached?: boolean;
  error?: string | null;
};

import { buildDiscoveryCatsParam, DISCOVERY_LAYER_DEFAULT_KEYS } from "./live-map-discovery-categories";

export async function fetchLiveDiscoveryLayer(
  bbox: { south: number; west: number; north: number; east: number },
  cats = buildDiscoveryCatsParam(DISCOVERY_LAYER_DEFAULT_KEYS),
  zoom?: number,
): Promise<LiveDiscoveryLayerResponse> {
  const params = new URLSearchParams({
    south: String(bbox.south),
    west: String(bbox.west),
    north: String(bbox.north),
    east: String(bbox.east),
    cats,
  });
  if (zoom != null && Number.isFinite(zoom)) {
    params.set("zoom", String(zoom));
  }
  try {
    return await apiFetch<LiveDiscoveryLayerResponse>(`/live/layer?${params.toString()}`);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 503) {
      return { points: [], error: "layer unavailable · try again" };
    }
    throw err;
  }
}
