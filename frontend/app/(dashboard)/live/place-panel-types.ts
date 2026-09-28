export type DepthTier = 0 | 1 | 2;

export type GroupTag = {
  label: string;
  tone: "neutral" | "warn";
};

export type Photo = {
  id: string;
  key_prefix: string;
  w: number;
  h: number;
};

export type ReviewStub = {
  author_initials: string;
  author_name: string;
  text: string;
  visited_at: string;
  wait_minutes: number | null;
};

export type Hours = {
  is_open: boolean;
  closes_at?: string | null;
  opens_at?: string | null;
};

export type Place = {
  gers_id: string;
  name: string;
  category: string;
  category_label: string;
  lat: number;
  lon: number;
  neighborhood: string | null;
  city_slug: string | null;
  address: string | null;
  depth_tier: DepthTier;
  short_description: string | null;
  description_source: string | null;
  description_url: string | null;
  website: string | null;
  instagram: string | null;
  hours: Hours | null;
  claimed: boolean;
  photos: Photo[];
  would_return_pct: number | null;
  review_count: number;
  group_tags: GroupTag[];
  latest_review: ReviewStub | null;
  bookable: boolean;
  next_slot: string | null;
  slots_tonight: number | null;
  updated_at: string;
};

/** Minimum fields available instantly from a map feature tap. */
export type PlaceSeed = Pick<
  Place,
  "gers_id" | "name" | "category" | "category_label" | "lat" | "lon"
>;

export type PlaceDistance = {
  miles: number;
  driveMinutes: number;
  /** When true, label uses group centroid wording. */
  fromGroupCentre: boolean;
};
