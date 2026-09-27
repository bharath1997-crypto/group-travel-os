import { apiFetch } from "@/lib/api";

export type FlightProviderConnectivity = "information_only" | "sandbox_connected" | "live_search_connected";

export type FlightProviderDirectoryItem = {
  catalog_id: number;
  slug: string;
  provider_name: string;
  provider_type: string;
  passenger_search_fit: string;
  connectivity_status: FlightProviderConnectivity;
  api_access_status: string;
  commercial_permission_status: string;
  source_status: string;
  source: string;
  notes: string;
};

export type FlightProviderDirectoryResponse = {
  total: number;
  page: number;
  page_size: number;
  provider_types: string[];
  connected_sources: number;
  items: FlightProviderDirectoryItem[];
};

export function getFlightProviderDirectory(params: { query?: string; providerType?: string; passengerOnly?: boolean; page?: number; pageSize?: number; }): Promise<FlightProviderDirectoryResponse> {
  const search = new URLSearchParams();
  if (params.query) search.set("q", params.query);
  if (params.providerType) search.set("provider_type", params.providerType);
  if (params.passengerOnly) search.set("passenger_only", "true");
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.pageSize ?? 24));
  return apiFetch(`/flights/provider-directory?${search.toString()}`);
}
