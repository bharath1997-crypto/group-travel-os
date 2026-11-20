import { apiFetch } from "@/lib/api";

import type {
  CollectionItem,
  CollectionItemPatch,
  CollectionListResponse,
  CollectionSummary,
  ExtractLinkResponse,
  Friend,
} from "./collection-types";

export async function fetchCollectionItems(params?: {
  country?: string;
  city?: string;
  category?: string;
  tag?: string;
}): Promise<CollectionListResponse> {
  const qs = new URLSearchParams();
  if (params?.country && params.country !== "Any") qs.set("country", params.country);
  if (params?.city && params.city !== "Any") qs.set("city", params.city);
  if (params?.category && params.category !== "Any") qs.set("category", params.category);
  if (params?.tag) qs.set("tag", params.tag);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<CollectionListResponse>(`/collection/items${suffix}`);
}

export async function createCollectionItem(body: {
  name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  subcategory?: string | null;
  source?: string;
  saved_from?: string | null;
  note?: string | null;
  stars?: number;
  match_status?: string;
  is_unsorted?: boolean;
  collection_id?: string | null;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
}): Promise<CollectionItem> {
  return apiFetch<CollectionItem>("/collection/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCollectionItem(
  id: string,
  patch: CollectionItemPatch,
): Promise<CollectionItem> {
  return apiFetch<CollectionItem>(`/collection/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function fetchCollections(): Promise<CollectionSummary[]> {
  return apiFetch<CollectionSummary[]>("/collection/collections");
}

export async function deleteCollectionItem(id: string): Promise<void> {
  await apiFetch(`/collection/items/${id}`, { method: "DELETE" });
}

export async function extractCollectionLink(url: string): Promise<ExtractLinkResponse> {
  return apiFetch<ExtractLinkResponse>("/collection/extract-link", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

/** Accepted connections you can send a save to. */
export async function fetchFriends(): Promise<Friend[]> {
  return apiFetch<Friend[]>("/social/connections");
}

export async function shareCollectionItem(
  id: string,
  friendIds: string[],
): Promise<{ sent: string[]; already_shared: string[] }> {
  return apiFetch<{ sent: string[]; already_shared: string[] }>(`/collection/items/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ friend_ids: friendIds }),
  });
}

export async function createNamedCollection(name: string): Promise<{ id: string; name: string }> {
  return apiFetch<{ id: string; name: string }>("/collection/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
