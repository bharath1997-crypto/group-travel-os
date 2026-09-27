/**
 * Live map discovery question routing (from wyra/wayra_discovery_questions.jsonl).
 * Classifies pin-context questions into local (free), LLM (travel), or app_guide.
 */

export type DiscoveryExpects = "local" | "llm" | "app_guide";

/** Shared normalization for Wayra intent + discovery routing. */
export function normalizeWayraQuery(message: string): string {
  return message
    .toLowerCase()
    .trim()
    .replace(/[''']/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuery(message: string): string {
  return normalizeWayraQuery(message);
}

const LEAD_INS = [
  "one more thing, ",
  "please advise: ",
  "could you tell me ",
  "i'd like to know ",
  "quick q: ",
  "real quick, ",
  "tell me, ",
  "curious, ",
  "actually, ",
  "btw ",
  "ok so ",
  "hey ",
  "hmm ",
  "yo ",
  "wait ",
  "so ",
];

/** Deictic references to the active map pin / surroundings. */
export const DEICTIC_PATTERN =
  "(?:where i dropped the pin|wat is dis place|this part of town|this location|around here|over here|ova here|out there|this region|this reigon|this place|this plce|this spot|this zone|this area|dis area|dis spot|this arwa|this pin on the map|\\bhear\\b|\\bhere\\b)";

const DEICTIC_RE = new RegExp(DEICTIC_PATTERN, "i");

/** Strip conversational lead-ins (may repeat). */
export function stripDiscoveryLeadIn(message: string): string {
  let q = message.toLowerCase().trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const lead of LEAD_INS) {
      if (q.startsWith(lead)) {
        q = q.slice(lead.length).trim();
        changed = true;
        break;
      }
    }
  }
  return q;
}

/** Normalize for skeleton-style pattern checks. */
export function normalizeDiscoveryQuery(message: string): string {
  let q = normalizeQuery(stripDiscoveryLeadIn(message));
  q = q.replace(new RegExp(DEICTIC_PATTERN, "gi"), "{here}");
  if (!APP_CONTEXT_RE.test(q)) {
    q = q.replace(/\b(this|it)\b/gi, "{here}");
  }
  return q.replace(/\s+/g, " ").trim();
}

/** True when the user points at the map pin with this/it (not the Rovvy app). */
const APP_CONTEXT_RE =
  /\b(this app|the app|on rovvy|in rovvy|wayra|plan page|plan tab)\b/i;

const PIN_PRONOUN_RE =
  /\b(what is (this|it)|what s (this|it)|is (this|it) a)\b/i;

export function hasLiveDeicticReference(message: string): boolean {
  const q = normalizeQuery(stripDiscoveryLeadIn(message));
  if (APP_CONTEXT_RE.test(q)) return false;
  if (DEICTIC_RE.test(q)) return true;
  return PIN_PRONOUN_RE.test(q);
}

function matchesAny(q: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q));
}

const APP_GUIDE_PATTERNS: RegExp[] = [
  /^how does live work$/,
  /^how does solo live work$/,
  /^how do i start a trip$/,
  /^how do i share my location$/,
  /^how do i split expenses$/,
  /^how do i create a group$/,
  /^how do i invite friends to vote$/,
  /^how do i book after voting$/,
  /^how do i switch travel modes$/,
  /^what does the pencil icon do$/,
  /^can you tell me how does live work$/,
  /^can you tell me how does solo live work$/,
];

/** Identity / pin label questions — answered locally from selectedPlace context. */
const IDENTITY_PATTERNS: RegExp[] = [
  /^can you tell me what {here} is$/,
  /^is {here} a town or just a landmark$/,
  /^what am i looking at {here}$/,
  /^what county state is {here} in$/,
  /^what is {here}$/,
  /^what is {here} called$/,
  /^what region is {here} in$/,
  /^what s the name of {here}$/,
  /^what s {here}$/,
  /^where exactly is {here}$/,
  /^what s this pin on the map$/,
];

/** Rich discovery — needs LLM + map context. */
const LLM_PATTERNS: RegExp[] = [
  // activities
  /^any hikes {here}$/,
  /^anything fun {here}$/,
  /^best attractions {here}$/,
  /^good food spots {here}$/,
  /^nightlife {here}$/,
  /^outdoor stuff to do {here}$/,
  /^things to do near {here}$/,
  /^what activities are {here}$/,
  /^what can i do {here}$/,
  /^what should i not miss {here}$/,
  // whats_special
  /^any hidden gems {here}$/,
  /^any local legends about {here}$/,
  /^is there anything cool {here}$/,
  /^what makes {here} worth stopping for$/,
  /^what s special about {here}$/,
  /^what s the best kept secret {here}$/,
  /^what s the story behind {here}$/,
  /^what s unique {here}$/,
  /^why is {here} famous$/,
  /^why should i visit {here}$/,
  // culture_people
  /^any cultural norms {here}$/,
  /^any customs i should know {here}$/,
  /^are people friendly {here}$/,
  /^what language do they speak {here}$/,
  /^what should i know about the people {here}$/,
  /^what s etiquette like {here}$/,
  /^what s local life like {here}$/,
  /^what s the local culture like {here}$/,
  // food_drink
  /^any must try food {here}$/,
  /^any street food {here}$/,
  /^best place to eat near {here}$/,
  /^best restaurants near {here}$/,
  /^good coffee spots {here}$/,
  /^what do locals eat {here}$/,
  /^what s the local specialty {here}$/,
  /^where can i grab a bite {here}$/,
  // when_to_go
  /^any weather warnings {here}$/,
  /^best time of year to visit {here}$/,
  /^is it too hot cold {here} right now$/,
  /^is {here} good to visit right now$/,
  /^what season is best {here}$/,
  /^what s the weather like {here}$/,
  /^when should i avoid {here}$/,
  /^when s peak season {here}$/,
  // how_long_itinerary
  /^can you plan a 2 day trip {here}$/,
  /^how long should i spend {here}$/,
  /^how much time do i need {here}$/,
  /^is {here} a half day or full day$/,
  /^is {here} worth a full day$/,
  /^quick stop or should i stay overnight {here}$/,
  /^what s a good itinerary for {here}$/,
  // getting_there
  /^best route to {here}$/,
  /^can i walk to {here}$/,
  /^how do i get to {here}$/,
  /^how far is {here}$/,
  /^how long is the drive to {here}$/,
  /^is there parking near {here}$/,
  /^is {here} accessible by car$/,
  /^what s the last mile like {here}$/,
  // safety_prep
  /^any safety concerns {here}$/,
  /^any warnings about {here}$/,
  /^is {here} in the desert or mountains$/,
  /^is {here} near a border$/,
  /^is {here} safe$/,
  /^should i be careful {here}$/,
  /^what do i need to prepare before going {here}$/,
  /^what should i pack for {here}$/,
  // cost_logistics
  /^any entry fees {here}$/,
  /^do i need a permit for {here}$/,
  /^do i need to book ahead for {here}$/,
  /^is there parking at {here}$/,
  /^is {here} free or paid$/,
  /^what does it cost to visit {here}$/,
  // who_its_for
  /^good for couples {here}$/,
  /^is {here} accessible for someone with limited mobility$/,
  /^is {here} family friendly$/,
  /^is {here} good for a group$/,
  /^is {here} good for a solo trip$/,
  /^is {here} good for kids$/,
  /^would my dog like {here}$/,
  // compare_decide
  /^how does {here} compare to other spots nearby$/,
  /^is {here} better than nearby spots$/,
  /^is {here} overrated$/,
  /^is {here} worth the trip from {here}$/,
  /^should i go to {here} or somewhere else$/,
  /^worth detouring for {here}$/,
  // live_navigation
  /^add {here} as a stop$/,
  /^any route warnings to {here}$/,
  /^how s traffic to {here}$/,
  /^navigate {here} now$/,
  /^reroute to {here}$/,
  /^set {here} as my destination$/,
  /^start navigation to {here}$/,
];

/**
 * Live UI chips and place-name phrasing — LLM without deictic "here".
 * Mirrors follow-up chips from follow-up-prompts.ts ({place} → .+).
 */
const PLACE_NAME_LLM_PATTERNS: RegExp[] = [
  /^what s at .+$/,
  /^what is at .+$/,
  /^what s in .+$/,
  /^what is in .+$/,
  /^what s special about .+$/,
  /^what can i do .+$/,
  /^what s the local culture like .+$/,
  /^any must try food .+$/,
  /^best time of year to visit .+$/,
  /^how long should i spend .+$/,
  /^what should i pack for .+$/,
  /^what does it cost to visit .+$/,
  /^anything fun .+$/,
  /^where exactly is .+$/,
  /^how far is this from me$/,
  /^how far is .+ from me$/,
  /^how long is the drive to .+$/,
  /^what should i prepare for this trip$/,
  /^what should i know about this trip$/,
  /^is this family friendly$/,
  /^is .+ family friendly$/,
  /^is this worth the trip$/,
  /^is .+ worth the trip$/,
];

function isPlaceNameLlmSkeleton(q: string): boolean {
  if (!q) return false;
  if (/\b(rovvy|wayra|the app|this app|plan page|plan tab)\b/.test(q)) return false;
  if (/\b(how do i|create a group|notification|poll|split expense)\b/.test(q)) return false;
  return matchesAny(q, PLACE_NAME_LLM_PATTERNS);
}

function skeletonForMatch(message: string): string {
  let q = normalizeDiscoveryQuery(message);
  q = q.replace(/['’]/g, " ");
  q = q.replace(/\bcounty\/state\b/g, "county state");
  q = q.replace(/\b2-day\b/g, "2 day");
  q = q.replace(/\bmust-try\b/g, "must try");
  q = q.replace(/\bhot\/cold\b/g, "hot cold");
  return q.replace(/\s+/g, " ").replace(/\?$/, "").trim();
}

function isIdentitySkeleton(q: string): boolean {
  if (
    /\b(special|unique|story|famous|hidden gem|worth visiting|worth stopping|fertile|soil|farmland|terrain|geography|wetland|desert|forest|grassland|tundra|taiga|steppe)\b/.test(
      q,
    )
  ) {
    return false;
  }
  return matchesAny(q, IDENTITY_PATTERNS);
}

/** Route a Live discovery question to local, LLM, or app_guide. Null if not discovery-shaped. */
export function classifyDiscoveryExpects(message: string): DiscoveryExpects | null {
  const skeleton = skeletonForMatch(message);

  if (matchesAny(skeleton, APP_GUIDE_PATTERNS)) {
    return "app_guide";
  }

  if (isIdentitySkeleton(skeleton)) {
    return "local";
  }

  if (isPlaceNameLlmSkeleton(skeleton)) {
    return "llm";
  }

  if (!hasLiveDeicticReference(message)) {
    return null;
  }

  if (matchesAny(skeleton, LLM_PATTERNS)) {
    return "llm";
  }

  // Deictic question on Live that isn't identity → LLM (culture, timing, etc.).
  if (hasLiveDeicticReference(message)) {
    return "llm";
  }

  return null;
}

export function isDiscoveryIdentityQuestion(message: string): boolean {
  return classifyDiscoveryExpects(message) === "local";
}

export function isDiscoveryLlmQuestion(message: string): boolean {
  return classifyDiscoveryExpects(message) === "llm";
}

export function isDiscoveryAppGuideQuestion(message: string): boolean {
  return classifyDiscoveryExpects(message) === "app_guide";
}

export function isPlaceNameLlmQuestion(message: string): boolean {
  return isPlaceNameLlmSkeleton(skeletonForMatch(message));
}
