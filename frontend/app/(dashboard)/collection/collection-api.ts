import { apiFetch } from "@/lib/api";

import type {
  CollectionItem,
  CollectionListResponse,
  ExtractLinkResponse,
} from "./collection-types";

export async function fetchCollectionItems(params?: {
  country?: string;
  city?: string;
  category?: string;
}): Promise<CollectionListResponse> {
  const qs = new URLSearchParams();
  if (params?.country && params.country !== "Any") qs.set("country", params.country);
  if (params?.city && params.city !== "Any") qs.set("city", params.city);
  if (params?.category && params.category !== "Any") qs.set("category", params.category);
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
  latitude?: number | null;
  longitude?: number | null;
}): Promise<CollectionItem> {
  return apiFetch<CollectionItem>("/collection/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export async function createNamedCollection(name: string): Promise<{ id: string; name: string }> {
  return apiFetch<{ id: string; name: string }>("/collection/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
