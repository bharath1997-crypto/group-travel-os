export type CollectionItem = {
  id: string;
  user_id: string;
  collection_id: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  category: string | null;
  subcategory: string | null;
  source: string;
  saved_from: string | null;
  note: string | null;
  stars: number;
  match_status: string;
  is_unsorted: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionListResponse = {
  items: CollectionItem[];
  total_count: number;
  unsorted_count: number;
  facets: {
    countries: string[];
    cities: string[];
    categories: string[];
  };
  city_counts: Record<string, number>;
};

export type ExtractLinkResponse = {
  source_title: string;
  source_label: string;
  candidates: Array<{
    name: string;
    city?: string | null;
    country?: string | null;
    category?: string | null;
    subcategory?: string | null;
    match_status?: string;
    saved_from?: string | null;
  }>;
  message?: string | null;
};

export type GroupMode = "city" | "category";
export type ViewMode = "grid" | "map";

export type CollectionSection = {
  title: string;
  count: number;
  meta: string;
  shared?: boolean;
  sharedExtra?: string;
  items: CollectionItem[];
};
