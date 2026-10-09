/** Fixture data ported from Rovvy Explore v6.dc.html — visual verification source. */

export type ExplorePhotoCredit = {
  attribution: string | null;
  license: string | null;
  sourceUrl: string | null;
};

export type ExploreSlotDetail = {
  id: string;
  source: string;
  meta: string;
  title: string;
  price: string;
  note: string;
  rating: string;
  area: string;
  body: string;
  tags: string[];
  amount: number;
  sourceUrl?: string | null;
  editorial?: boolean;
  priceKnown?: boolean;
  imageUrl?: string | null;
  openingHours?: string | null;
  hoursSource?: string | null;
  address?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageCredit?: ExplorePhotoCredit | null;
  listingKind?: "event" | "place";
};

export type ExploreSlotCard = ExploreSlotDetail & {
  kind: "slot";
  imageHeight: number;
  imageLabel: string;
  imageUrl?: string | null;
  useMapCrop?: boolean;
  mapCropLat?: number;
  mapCropLng?: number;
  badge?: string;
  badgeVariant?: "urgency" | "neutral" | "accent" | "light";
  summary?: string;
  reason?: string;
  overlayTitle?: boolean;
};

export type ExploreAskCard = {
  kind: "ask";
  id: string;
  variant: "primary" | "outline" | "cream" | "wayra-dark";
  prompt: string;
  subtitle: string;
  icon?: "sparkle" | "people" | "weather";
};

export type ExploreLiveCard = {
  kind: "live";
  id: string;
};

export type ExploreFeedItem = ExploreSlotCard | ExploreAskCard | ExploreLiveCard;

export type ExploreStat = {
  count: string;
  label: string;
  accent?: boolean;
};

export type ExploreRankingRow = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  availability: string;
};

export type ExploreCityReel = {
  id: string;
  name: string;
  region: string;
  slots: string;
  badge?: string;
  badgeVariant?: "here" | "trending" | "accent" | "light";
  social?: string;
};

export type ExploreWayraPlan = {
  id: string;
  tier: string;
  price: string;
  highlighted?: boolean;
  steps: { time: string; label: string; connector?: string }[];
};

export const EXPLORE_CITY = "Chicago";
export const EXPLORE_SLOTS_LIVE = 128;

export const EXPLORE_SLOT_DETAILS: Record<string, ExploreSlotDetail> = {
  greenmill: {
    id: "greenmill",
    source: "Eventbrite",
    meta: "Sat 9:00 PM · Uptown · Music",
    title: "Blues night at the Green Mill",
    price: "$30",
    note: "all-in · $26 + $4 fees",
    rating: "—",
    area: "Uptown, Broadway & Lawrence",
    body: "A jazz room that hasn't changed since 1907. Doors 8:30, set at 9, standing space at the back for a group of six. Cash bar, no cover for the second set.",
    tags: ["90 min", "21+", "Cash bar", "Red line, 4 min"],
    amount: 30,
  },
  fulton: {
    id: "fulton",
    source: "Resy",
    meta: "Sat 7:00 PM · West Loop · Food",
    title: "Long table, Fulton Kitchen",
    price: "$32",
    note: "avg spend · no booking fee",
    rating: "—",
    area: "West Loop, Fulton Market",
    body: "One long shared table down the middle of the room. Wood-fire menu, family style. The 7 PM seating is the only one that takes eight; confirm the deposit with the provider.",
    tags: ["2 hours", "Family style", "Veg options", "Quiet enough to talk"],
    amount: 32,
  },
  jazz: {
    id: "jazz",
    source: "Venue direct",
    meta: "Sat 7:00 PM · Millennium Park",
    title: "Jazz in the Park, closing night",
    price: "Free",
    note: "no ticket needed",
    rating: "—",
    area: "Millennium Park, Pritzker Pavilion",
    body: "Last night of the summer series. Bring a blanket, arrive by 6:30 for lawn space near the front. Food trucks on Randolph stay open till 11.",
    tags: ["No ticket", "All ages", "Outdoor", "22° clear"],
    amount: 0,
  },
  kayak: {
    id: "kayak",
    source: "Venue direct",
    meta: "Sun 10:00 AM · Navy Pier",
    title: "Kayak the harbour",
    price: "$38",
    note: "all-in · $34 + $4 gear",
    rating: "—",
    area: "Navy Pier, south dock",
    body: "Two hours on flat water with the skyline behind you. Gear, dry bag and a guide included. No experience needed, minimum two paddlers.",
    tags: ["2 hours", "Gear included", "Min 2 people", "Calm water"],
    amount: 38,
  },
  comedy: {
    id: "comedy",
    source: "Ticketmaster",
    meta: "Sat 8:00 PM · West Loop · Comedy",
    title: "Late set at the Warehouse",
    price: "$41",
    note: "all-in · cheapest of 3 sites",
    rating: "—",
    area: "West Loop, Randolph St",
    body: "Touring headliner, two openers, 90 minutes with no interval. Two-drink minimum applies and the back rows have restricted sightlines.",
    tags: ["90 min", "18+", "2-drink min", "Loud"],
    amount: 41,
  },
  listening: {
    id: "listening",
    source: "OpenStreetMap",
    meta: "Open till 2 AM · Avondale · Bar",
    title: "Listening bar, twelve seats",
    price: "~$18",
    note: "typical spend · walk-in",
    rating: "—",
    area: "Avondale, Belmont Ave",
    body: "Twelve seats, vinyl only, conversation kept low by house rule. No reservations — arrive before 10 or wait. Reservations open Thursdays for the back room.",
    tags: ["Walk-in", "No cover", "Quiet", "Cash preferred"],
    amount: 18,
  },
  skydeck: {
    id: "skydeck",
    source: "Venue direct",
    meta: "Sat 6:00 PM · Loop · Landmark",
    title: "Skydeck at golden hour",
    price: "$32",
    note: "all-in · timed entry",
    rating: "—",
    area: "Loop, Wacker Drive",
    body: "Book the slot 40 minutes before sunset — the light is worth the queue. Groups of six enter together on one timed ticket.",
    tags: ["60 min", "All ages", "Indoor", "Timed entry"],
    amount: 32,
  },
  tacos: {
    id: "tacos",
    source: "Rovvy editorial",
    meta: "Sat 1:00 PM · Pilsen · Food",
    title: "Taco crawl, five stops",
    price: "~$28",
    note: "per person across five stops",
    rating: "—",
    area: "Pilsen, 18th Street",
    body: "Five counters in walking distance, one order each. Built for groups up to ten — no reservations needed anywhere on the route.",
    tags: ["3 hours", "Walkable", "Groups to 10", "Cash helps"],
    amount: 28,
  },
  artic: {
    id: "artic",
    source: "Venue direct",
    meta: "Sun 11:00 AM · Loop · Art",
    title: "Art Institute, group entry",
    price: "$26",
    note: "all-in · skip the line",
    rating: "—",
    area: "Loop, Michigan Ave",
    body: "Timed group entry skips the main queue. Two hours covers the Impressionist wing and the modern galleries without rushing. Rovvy holds this as the rain swap for Saturday.",
    tags: ["2 hours", "All ages", "Indoor", "Rain swap"],
    amount: 26,
  },
};

export const EXPLORE_STATS: ExploreStat[] = [
  { count: "128", label: "Events" },
  { count: "96", label: "Food & drink" },
  { count: "41", label: "Live music" },
  { count: "34", label: "Outdoors" },
  { count: "22", label: "Landmarks" },
  { count: "19", label: "Free tonight", accent: true },
];

export const EXPLORE_VIBES = [
  "Somewhere loud",
  "Somewhere we can talk",
  "Cheap and good",
  "Worth dressing up for",
  "First date",
  "Nobody's seen it",
  "Last-minute OK",
];

export const EXPLORE_WAYRA_PLANS: ExploreWayraPlan[] = [
  {
    id: "low-key",
    tier: "Low-key",
    price: "$48 ea",
    steps: [
      { time: "6:30", label: "Ramen counter, Avondale" },
      { time: "", label: "↓ 9 min walk", connector: "walk" },
      { time: "8:30", label: "Listening bar set" },
    ],
  },
  {
    id: "best-fit",
    tier: "Best fit",
    price: "$62 ea",
    highlighted: true,
    steps: [
      { time: "7:00", label: "Long table, Fulton Kitchen" },
      { time: "", label: "↓ 8 min walk", connector: "walk" },
      { time: "9:00", label: "Blues at the Green Mill" },
    ],
  },
  {
    id: "big-night",
    tier: "Big night",
    price: "$96 ea",
    steps: [
      { time: "6:00", label: "Skydeck at golden hour" },
      { time: "", label: "↓ 12 min transit", connector: "walk" },
      { time: "8:00", label: "Arena show, upper bowl" },
    ],
  },
];

/** Design-reference rows for the three-column explore picks table (not live inventory). */
export const EXPLORE_RANKING: ExploreRankingRow[] = [
  {
    id: "listening",
    title: "Listening bar, twelve seats",
    subtitle: "Avondale · Bar · open till 2 AM",
    price: "~$18",
    availability: "Check provider",
  },
  {
    id: "kayak",
    title: "Kayak the harbour",
    subtitle: "Navy Pier · Outdoors · Sun 10 AM",
    price: "$38",
    availability: "Check provider",
  },
  {
    id: "jazz",
    title: "Jazz in the Park, closing night",
    subtitle: "Millennium Park · Music · Sat 7 PM",
    price: "Free",
    availability: "Check provider",
  },
  {
    id: "greenmill",
    title: "Blues night at the Green Mill",
    subtitle: "Uptown · Music · Sat 9 PM",
    price: "$30",
    availability: "Check provider",
  },
  {
    id: "tacos",
    title: "Taco crawl, five stops",
    subtitle: "Pilsen · Food · Sat 1 PM · groups to 10",
    price: "~$28",
    availability: "Check provider",
  },
  {
    id: "fulton",
    title: "Long table, Fulton Kitchen",
    subtitle: "West Loop · Food · Sat 7 PM · seats 8",
    price: "$32",
    availability: "Check provider",
  },
];

export const EXPLORE_CITY_REEL: ExploreCityReel[] = [
  {
    id: "chicago",
    name: "Chicago",
    region: "IL",
    slots: "128 slots live",
    badge: "You're here",
    badgeVariant: "here",
    social: "2 friends here",
  },
  {
    id: "new-york",
    name: "New York",
    region: "NY",
    slots: "350 slots live",
    badge: "Trending",
    badgeVariant: "trending",
    social: "Sam went in June",
  },
  {
    id: "new-orleans",
    name: "New Orleans",
    region: "LA",
    slots: "96 slots live",
    badge: "Festival week",
    badgeVariant: "accent",
    social: "Cheapest weekend of the year",
  },
  {
    id: "austin",
    name: "Austin",
    region: "TX",
    slots: "142 slots live",
    social: "Live music every night",
  },
  {
    id: "denver",
    name: "Denver",
    region: "CO",
    slots: "88 slots live",
    badge: "2 hr flight",
    badgeVariant: "light",
    social: "Trails open till October",
  },
];

export const EXPLORE_FEED: ExploreFeedItem[] = [
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.greenmill,
    imageHeight: 178,
    imageLabel: "780×530",
    badgeVariant: "neutral",
    reason: "Provider listing available for Saturday night",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.jazz,
    imageHeight: 206,
    imageLabel: "780×620",
    badgeVariant: "neutral",
    overlayTitle: true,
    summary: "Lawn seating · food trucks till 11",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.comedy,
    imageHeight: 164,
    imageLabel: "780×490",
    badge: "Also on 2 sites",
    badgeVariant: "neutral",
    summary: "90 min · two-drink minimum · 18+",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.skydeck,
    imageHeight: 192,
    imageLabel: "780×580",
    summary: "Best 40 min before sunset · timed entry",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.fulton,
    imageHeight: 132,
    imageLabel: "780×400",
    badgeVariant: "neutral",
    summary: "Seats 2–8 · confirm deposit with provider",
    reason: "Only the 7 PM seating takes six",
  },
  { kind: "live", id: "live-late" },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.kayak,
    imageHeight: 150,
    imageLabel: "780×450",
    badgeVariant: "neutral",
    summary: "Two hours · gear included · min 2 paddlers",
  },
  {
    kind: "ask",
    id: "ask-under25",
    variant: "outline",
    prompt: "Something to do tonight under $25",
    subtitle: "Try a budget or vibe filter on live listings",
    icon: "sparkle",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.listening,
    imageHeight: 126,
    imageLabel: "780×380",
    badgeVariant: "neutral",
    summary: "No cover · vinyl only · quiet room",
    reason: 'Matches "somewhere we can talk" · 9 min from dinner',
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.tacos,
    imageHeight: 142,
    imageLabel: "780×430",
    summary: "Walkable route · fits groups to 10",
  },
  {
    kind: "ask",
    id: "ask-rain",
    variant: "cream",
    prompt: "Indoor ideas for tomorrow afternoon",
    subtitle: "Explore indoor listings and confirm details with providers",
    icon: "weather",
  },
  {
    kind: "slot",
    ...EXPLORE_SLOT_DETAILS.artic,
    imageHeight: 158,
    imageLabel: "780×470",
    badge: "Rain swap",
    badgeVariant: "accent" as const,
    summary: "Timed tickets · skip the line",
  },
];

export const EXPLORE_PROMPT_SUGGESTIONS = [
  "Saturday night, six of us, under $70",
  "Live music near dinner, walkable",
  "Something free tonight",
];

export const EXPLORE_WHEN_OPTIONS = ["Tonight", "Tomorrow", "This weekend", "Next week"];

export function slotDetail(id: string | null): ExploreSlotDetail | null {
  if (!id) return null;
  return EXPLORE_SLOT_DETAILS[id] ?? null;
}
