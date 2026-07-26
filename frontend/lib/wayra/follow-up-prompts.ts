/**
 * Contextual follow-up chips below Wayra answers — sourced from discovery categories
 * in wyra/wayra_discovery_questions.jsonl.
 */

import {
  classifyDiscoveryExpects,
  isPlaceNameLlmQuestion,
  normalizeWayraQuery,
} from "@/lib/wayra/discovery";

export type FollowUpCategory =
  | "identity"
  | "place_at"
  | "whats_special"
  | "activities"
  | "culture_people"
  | "food_drink"
  | "when_to_go"
  | "how_long_itinerary"
  | "getting_there"
  | "safety_prep"
  | "cost_logistics"
  | "who_its_for"
  | "compare_decide"
  | "live_navigation"
  | "trip_prep"
  | "general";

/** One canonical chip template per discovery category ({place} = pin name or deictic). */
const CATEGORY_CHIP: Record<FollowUpCategory, string> = {
  identity: "Where exactly is {place}?",
  place_at: "What's at {place}?",
  whats_special: "What's special about {place}?",
  activities: "What can I do {place}?",
  culture_people: "What's the local culture like {place}?",
  food_drink: "Any must-try food {place}?",
  when_to_go: "Best time of year to visit {place}?",
  how_long_itinerary: "How long should I spend {place}?",
  getting_there: "How far is {place} from me?",
  safety_prep: "What should I pack for {place}?",
  cost_logistics: "What does it cost to visit {place}?",
  who_its_for: "Is {place} family friendly?",
  compare_decide: "Is {place} worth the trip?",
  live_navigation: "Navigate here now",
  trip_prep: "What should I prepare for this trip?",
  general: "Anything fun {place}?",
};

/** Related next questions after the user asks about category X. */
const FOLLOW_UPS_AFTER: Record<FollowUpCategory, FollowUpCategory[]> = {
  identity: ["whats_special", "activities", "getting_there"],
  place_at: ["activities", "culture_people", "food_drink"],
  whats_special: ["activities", "food_drink", "when_to_go"],
  activities: ["food_drink", "safety_prep", "how_long_itinerary"],
  culture_people: ["food_drink", "activities", "when_to_go"],
  food_drink: ["activities", "cost_logistics", "who_its_for"],
  when_to_go: ["activities", "safety_prep", "how_long_itinerary"],
  how_long_itinerary: ["activities", "getting_there", "cost_logistics"],
  getting_there: ["safety_prep", "activities", "live_navigation"],
  safety_prep: ["getting_there", "when_to_go", "trip_prep"],
  cost_logistics: ["who_its_for", "activities", "food_drink"],
  who_its_for: ["activities", "food_drink", "safety_prep"],
  compare_decide: ["whats_special", "activities", "when_to_go"],
  live_navigation: ["safety_prep", "getting_there", "activities"],
  trip_prep: ["safety_prep", "getting_there", "when_to_go"],
  general: ["whats_special", "activities", "getting_there"],
};

const INITIAL_LIVE_CATEGORIES: FollowUpCategory[] = [
  "place_at",
  "getting_there",
  "trip_prep",
];

function hasAny(q: string, ...patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q));
}

/** Classify the user's last message into a discovery category. */
export function classifyFollowUpCategory(message: string): FollowUpCategory {
  const q = normalizeWayraQuery(message);
  if (!q) return "general";

  if (isPlaceNameLlmQuestion(message) || hasAny(q, /^what s at /, /^what is at /)) {
    return "place_at";
  }

  const discovery = classifyDiscoveryExpects(message);
  if (discovery === "local") return "identity";

  if (
    hasAny(
      q,
      /\bprepare for this trip\b/,
      /\bwhat should i prepare\b/,
      /\bwhat should i know\b/,
      /\bhow should i prepare\b/,
      /\btips and warnings\b/,
    )
  ) {
    return "trip_prep";
  }

  if (hasAny(q, /\bnavigate\b/, /\breroute\b/, /\bstart navigation\b/, /\bset .* destination\b/)) {
    return "live_navigation";
  }

  if (hasAny(q, /^how far is/, /\bhow long is the drive\b/, /\bhow do i get to\b/, /\bbest route to\b/)) {
    return "getting_there";
  }

  if (hasAny(q, /\bspecial\b/, /\bhidden gem\b/, /\bworth stopping\b/, /\bunique\b/, /\bstory behind\b/)) {
    return "whats_special";
  }

  if (hasAny(q, /\bactivities\b/, /\bthings to do\b/, /\bwhat can i do\b/, /\bhikes\b/, /\battractions\b/, /\banything fun\b/)) {
    return "activities";
  }

  if (hasAny(q, /\bculture\b/, /\bcustoms\b/, /\blanguage\b/, /\betiquette\b/, /\blocal life\b/)) {
    return "culture_people";
  }

  if (hasAny(q, /\bfood\b/, /\beat\b/, /\brestaurant\b/, /\bcoffee\b/, /\bstreet food\b/)) {
    return "food_drink";
  }

  if (hasAny(q, /\bweather\b/, /\bseason\b/, /\bbest time\b/, /\bwhen should i avoid\b/)) {
    return "when_to_go";
  }

  if (hasAny(q, /\bhow long should i spend\b/, /\bitinerary\b/, /\bhalf day or full day\b/)) {
    return "how_long_itinerary";
  }

  if (hasAny(q, /\bpack for\b/, /\bsafety\b/, /\bwarning\b/, /\bprepare before\b/, /\bborder\b/)) {
    return "safety_prep";
  }

  if (hasAny(q, /\bcost\b/, /\bentry fee\b/, /\bpermit\b/, /\bfree or paid\b/, /\bparking at\b/)) {
    return "cost_logistics";
  }

  if (hasAny(q, /\bfamily friendly\b/, /\bgroup\b/, /\bsolo\b/, /\bkids\b/, /\bcouples\b/)) {
    return "who_its_for";
  }

  if (hasAny(q, /\bcompare\b/, /\boverrated\b/, /\bworth the trip\b/, /\bworth detouring\b/)) {
    return "compare_decide";
  }

  if (discovery === "llm") return "general";
  return "general";
}

/** Materialize {place} for named pins vs deictic "here" phrasing. */
export function materializeFollowUpChip(
  template: string,
  placeName?: string | null,
): string {
  const name = placeName?.trim();
  if (name) {
    if (template === "Navigate here now") return template;
    return template
      .replace(/\{place\}/g, name)
      .replace(/\?\?+/g, "?")
      .trim();
  }

  return template
    .replace(/What's at \{place\}\?/g, "What's here?")
    .replace(/What's special about \{place\}\?/g, "What's special around here?")
    .replace(/What can I do \{place\}\?/g, "What can I do around here?")
    .replace(/What's the local culture like \{place\}\?/g, "What's the local culture like here?")
    .replace(/Any must-try food \{place\}\?/g, "Any must-try food around here?")
    .replace(/Best time of year to visit \{place\}\?/g, "Best time of year to visit here?")
    .replace(/How long should I spend \{place\}\?/g, "How long should I spend here?")
    .replace(/How far is \{place\} from me\?/g, "How far is this from me?")
    .replace(/What should I pack for \{place\}\?/g, "What should I pack for here?")
    .replace(/What does it cost to visit \{place\}\?/g, "What does it cost to visit here?")
    .replace(/Is \{place\} family friendly\?/g, "Is this family friendly?")
    .replace(/Is \{place\} worth the trip\?/g, "Is this worth the trip?")
    .replace(/Where exactly is \{place\}\?/g, "Where exactly is this spot?")
    .replace(/Anything fun \{place\}\?/g, "Anything fun around here?")
    .replace(/\{place\}/g, "here")
    .trim();
}

export function buildFollowUpPrompts(input: {
  lastUserMessage?: string | null;
  placeName?: string | null;
  onLive?: boolean;
  limit?: number;
  exclude?: string[];
}): string[] {
  const limit = input.limit ?? 3;
  const exclude = new Set(
    (input.exclude ?? []).map((q) => normalizeWayraQuery(q)),
  );

  let categories: FollowUpCategory[];
  if (input.lastUserMessage?.trim()) {
    const current = classifyFollowUpCategory(input.lastUserMessage);
    categories = FOLLOW_UPS_AFTER[current] ?? FOLLOW_UPS_AFTER.general;
  } else if (input.onLive) {
    categories = INITIAL_LIVE_CATEGORIES;
  } else {
    categories = FOLLOW_UPS_AFTER.general;
  }

  const chips: string[] = [];
  for (const cat of categories) {
    const raw = CATEGORY_CHIP[cat];
    const chip = materializeFollowUpChip(raw, input.placeName);
    const norm = normalizeWayraQuery(chip);
    if (exclude.has(norm)) continue;
    if (chips.some((c) => normalizeWayraQuery(c) === norm)) continue;
    chips.push(chip);
    if (chips.length >= limit) break;
  }

  return chips;
}
