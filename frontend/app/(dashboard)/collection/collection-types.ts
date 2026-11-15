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
  tags?: string[];
  shared_by_user_id?: string | null;
  shared_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type CollectionSummary = {
  id: string;
  user_id: string;
  name: string;
  group_id: string | null;
  created_at: string;
};

export type CollectionItemPatch = Partial<{
  name: string;
  note: string | null;
  stars: number;
  city: string | null;
  country: string | null;
  category: string | null;
  subcategory: string | null;
  is_unsorted: boolean;
  match_status: string;
  collection_id: string | null;
  tags: string[];
}>;

export type CollectionListResponse = {
  items: CollectionItem[];
  total_count: number;
  unsorted_count: number;
  facets: {
    countries: string[];
    cities: string[];
    categories: string[];
    tags?: string[];
  };
  city_counts: Record<string, number>;
};

export type ExtractCandidate = {
  name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  subcategory?: string | null;
  match_status?: string;
  saved_from?: string | null;
  already_saved?: boolean;
};

export type LinkPreview = {
  platform?: string | null;
  author?: string | null;
  thumbnail_url?: string | null;
  video_id?: string | null;
};

export type Friend = { id: string; full_name: string; username?: string | null };

export type ExtractLinkResponse = {
  source_title: string;
  source_label: string;
  source_url?: string | null;
  candidates: ExtractCandidate[];
  link_only?: boolean;
  link_saved?: boolean;
  message?: string | null;
  preview?: LinkPreview | null;
};

export type GroupMode = "city" | "category";
export type ViewMode = "grid" | "map";

export type CollectionSection = {
  title: string;
  count: number;
  meta: string;
  items: CollectionItem[];
};
