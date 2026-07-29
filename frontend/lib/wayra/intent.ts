/**
 * Wayra intent classification and local fallbacks (mirrors app/services/wayra_intent.py).
 * Used by AIAssistantSidecar for fast App Guide answers and graceful travel degradation.
 */

import {
  classifyDiscoveryExpects,
  isDiscoveryIdentityQuestion,
  isDiscoveryLlmQuestion,
  isPlaceNameLlmQuestion,
  normalizeWayraQuery,
} from "@/lib/wayra/discovery";
import { resolvePlaceDisplayName } from "@/lib/wayra/place-region";

export type WayraMode = "app_guide" | "travel";

export type AppIntent =
  | "create_group"
  | "create_trip"
  | "plan_page_explainer"
  | "notifications"
  | "notification_settings"
  | "polls"
  | "splits"
  | "live_map"
  | "settings"
  | "profile"
  | "invites"
  | "buddy_trips"
  | "explore"
  | "memories";

const APP_INTENT_RESPONSES: Record<AppIntent, string> = {
  create_group:
    "Open Group in the left sidebar, then Travel Hub to start a coordinated workspace. Create your group, name it, and share the invite link or code so friends can join. That group becomes home for trips, polls, and shared expenses.",
  create_trip:
    "From the dashboard choose your trip workspace, or open Trips and tap New Trip. Add a title, dates, and destination, then invite your group so everyone shares polls, splits, and live coordination on the same itinerary.",
  plan_page_explainer:
    "Plan is Rovvy's booking and routing hub in one place. Open Plan in the sidebar to search Flights, Hotels, Routes, and Buses—compare options and keep planning next to your group context.",
  notifications:
    "Tap the bell icon in the top-right on any screen to open your notification feed, or go to Notifications (/notifications) for trip updates, invites, and group activity.",
  notification_settings:
    "Open Profile → Settings and look for notification preferences to control alerts, trip updates, and digests. Your inbox at the bell icon still shows everything you've received.",
  polls:
    "Inside an active trip, open the Polls tab → New Poll, add options, and share with the group. Everyone votes in one place; the creator can close the poll when you're ready to decide.",
  splits:
    "Open Split Activities or your trip's Expenses tab → Add Expense, enter who paid and the amount, then choose how to split. Balance Summary shows who owes whom; mark splits settled when done.",
  live_map:
    "Open Group → Live (or your trip's Live/Map tab) to share location, drop meet points, and run a countdown timer so everyone converges without endless texts.",
  settings:
    "Open Profile in the sidebar → Settings for account, security, notifications, and subscription. Changes there apply across Rovvy on every device you're signed into.",
  profile:
    "Tap Profile in the left sidebar to edit your name, bio, and avatar—click your photo to upload a new one. Posts, saved places, and trip highlights also live on your profile.",
  invites:
    "Open your group in Travel Hub and use Share invite link so friends join with one tap. You can regenerate the code from group settings if you need a fresh link.",
  buddy_trips:
    "Open Group → Buddy Trips (or Explore) to browse open trips from other travelers. Tap a listing and request to join—the host approves before you're added.",
  explore:
    "Explore is your discovery layer—trending destinations, events, activities, and weather cues. Filter by mood (beach, city, food), save places with the heart icon, and pull them into a trip later.",
  memories:
    "Your profile keeps posts and trip moments in one place. Open Profile → Posts or Memories to revisit what your group captured, and share highlights back to the travel feed.",
};

function hasAny(q: string, ...patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q));
}

export function normalizeQuery(message: string): string {
  return normalizeWayraQuery(message);
}

export type LiveSelectedPlaceContext = {
  name?: string | null;
  lat: number;
  lng: number;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

/** Rich place questions (culture, language, activities) need the LLM — not a coordinate stub. */
export function isLivePlaceDeepQuestion(message: string): boolean {
  if (isDiscoveryIdentityQuestion(message)) return false;
  if (isDiscoveryLlmQuestion(message)) return true;

  const q = normalizeQuery(message);
  if (!q) return false;

  const bulletLines = message
    .split("\n")
    .filter((line) => /^[\s\-*•]/.test(line.trim()) || /^\d+\./.test(line.trim())).length;
  const questionMarks = message.match(/\?/g)?.length ?? 0;

  if (bulletLines >= 2 || questionMarks >= 2) return true;

  return hasAny(
    q,
    /\bproperly\b/,
    /\bculture\b/,
    /\blanguage\b/,
    /\blanguages\b/,
    /\bwhat do people\b/,
    /\bpeople (do|use to|used to)\b/,
    /\bthings to do\b/,
    /\bactivities\b/,
    /\bhistory\b/,
    /\bfood\b/,
    /\bcustoms\b/,
    /\btell me about\b/,
    /\bdescribe (this|the|that)\b/,
    /\bwhat is it like\b/,
    /\bwhat s it like\b/,
    /\bwhat s here\b/,
    /\bwhat is here\b/,
    /\bwhat s at\b/,
    /\bwhat is this (location|place|spot)\b/,
    /\babout this location\b/,
    /\bnearby\b/,
    /\binteresting\b/,
    /\bworth visiting\b/,
    /\bwhat s special\b/,
    /\bwhat is special\b/,
    /\bwhat is the special\b/,
    /\bout there\b/,
    /\bwhat s out there\b/,
  );
}

/** Narrow instant reply: only "which pin did I drop?" / coordinate lookups. */
export function isLiveMapIdentityQuestion(message: string): boolean {
  if (isDiscoveryIdentityQuestion(message)) return true;

  const q = normalizeQuery(message);
  if (!q || isLivePlaceDeepQuestion(message)) return false;

  return hasAny(
    q,
    /\bwhat location did i\b/,
    /\bwhich location did i\b/,
    /\bwhere did i (pick|pin|drop|select|pitch)\b/,
    /\bwhat did i pick\b/,
    /\bwhat (place|pin|location|spot) did i\b/,
    /\bwhat are the coordinates\b/,
    /\bshow (me )?the coordinates\b/,
    /\bwhere is my pin\b/,
    /\bwhere s my pin\b/,
  );
}

/** User is asking about the pin / place currently on the Live map. */
export function isLiveMapContextQuestion(message: string): boolean {
  if (isLiveMapIdentityQuestion(message) || isLivePlaceDeepQuestion(message)) {
    return true;
  }

  const q = normalizeQuery(message);
  if (!q) return false;

  return hasAny(
    q,
    /\bwhat am i looking at\b/,
    /\babout (the|this|my) (pick|picked|pin|location|place|spot)\b/,
    /\b(pick|picked|pin) location\b/,
    /\bthis pin\b/,
    /\bthis location\b/,
    /\bthis place\b/,
    /\bmy picked\b/,
    /\bdropped pin\b/,
    /\bselected (place|location|pin|spot)\b/,
    /\bcoordinates\b/,
    /\bwhere is (this|my|the) (pin|place|location|spot)\b/,
    /\bwhat s on the map\b/,
    /\bon the map\b.{0,30}\b(pick|pin|place|location)\b/,
  );
}

/** Trip prep / warnings on Live — should go to LLM with map context, not App Guide. */
export function isLiveTravelPrepQuestion(message: string): boolean {
  const q = normalizeQuery(message);
  if (!q) return false;

  return hasAny(
    q,
    /\bplanning a trip to\b/,
    /\bwhat should i know\b/,
    /\bhow should i prepare\b/,
    /\btips and warnings\b/,
    /\bhere are the tips\b/,
    /\bbefore i go\b/,
    /\bprepare for\b/,
    /\bwhat should i plan\b/,
    /\bask wayra about this trip\b/,
    /\binternational border\b/,
    /\bborder crossing\b/,
    /\bfar from (my|your|the)\b/,
    /\bdriving ends at\b/,
    /\blast mile\b/,
    /\bstart solo live\b/,
  );
}

/** True when the user is asking how Rovvy works — safe for instant App Guide replies. */
export function isAppHowToQuestion(message: string): boolean {
  const q = normalizeQuery(message);
  if (!q) return false;

  return hasAny(
    q,
    /\bhow do i\b/,
    /\bhow to\b/,
    /\bhow can i\b/,
    /\bwhere do i (find|open|see|get)\b/,
    /\bwhat is the plan page\b/,
    /\bcreate (a )?group\b/,
    /\bcreate (a )?trip\b/,
    /\bnotification settings\b/,
    /\bshow me how\b/,
    /\bexplain (the|this) page\b/,
  );
}

export function isLivePage(page: string, context?: Record<string, unknown>): boolean {
  const p = (page || "").replace(/^\//, "").replace(/_/g, "/");
  if (p === "live" || p.startsWith("live/")) return true;
  const pathname = context?.pathname;
  return typeof pathname === "string" && (pathname === "/live" || pathname.startsWith("/live/"));
}

export function extractLiveSelectedPlace(
  context?: Record<string, unknown>,
): LiveSelectedPlaceContext | null {
  if (!context) return null;
  const raw = context.selectedPlace;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const lat = row.lat;
  const lng = row.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    name: typeof row.name === "string" ? row.name : null,
    lat,
    lng,
    category: typeof row.category === "string" ? row.category : null,
    address: typeof row.address === "string" ? row.address : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    country: typeof row.country === "string" ? row.country : null,
  };
}

function formatCoord(value: number, pos: string, neg: string): string {
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? pos : neg}`;
}

export function buildLiveSelectedPlaceReply(
  place: LiveSelectedPlaceContext,
  liveStage?: string | null,
): string {
  const label = resolvePlaceDisplayName(place.name, place);
  const latStr = formatCoord(place.lat, "N", "S");
  const lngStr = formatCoord(place.lng, "E", "W");
  const category = place.category?.trim();
  const address = place.address?.trim();

  const parts = [
    `You picked ${label} on the Live map at ${latStr}, ${lngStr}.`,
  ];
  if (category) parts.push(`Category: ${category}.`);
  if (address && !address.startsWith("Coordinates:")) {
    parts.push(`Address: ${address}.`);
  }

  if (liveStage === "destination_set") {
    parts.push("This spot is set as your destination.");
  } else if (liveStage === "place_preview") {
    parts.push(
      "You're previewing this spot — tap Set destination or Start Solo Live when you're ready.",
    );
  } else {
    parts.push("Ask me about the drive, warnings, or what to do here.");
  }

  return parts.join(" ");
}

/** Answer using Live map pin context when the user asks about their picked location. */
export function resolveLiveMapContextReply(
  message: string,
  page: string,
  context?: Record<string, unknown>,
): string | null {
  if (!isLiveMapIdentityQuestion(message)) return null;
  if (!isLivePage(page, context)) return null;

  const place = extractLiveSelectedPlace(context);
  if (!place) {
    return (
      "I don't see a picked place on the map yet. Tap the map or search for a destination, " +
      "then ask me again about that pin."
    );
  }

  const liveStage =
    typeof context?.liveStage === "string" ? context.liveStage : null;
  return buildLiveSelectedPlaceReply(place, liveStage);
}

/** Offline / API-fallback prep answer using Live route warnings in context. */
export function resolveLiveTravelPrepReply(
  message: string,
  page: string,
  context?: Record<string, unknown>,
): string | null {
  if (!isLiveTravelPrepQuestion(message)) return null;
  if (!isLivePage(page, context)) return null;

  const place = extractLiveSelectedPlace(context);
  const dest = place?.name?.trim() || "this destination";
  const lines: string[] = [`Here's how I'd prepare for ${dest}:`];

  const suggestions = context?.aiSuggestions;
  if (Array.isArray(suggestions)) {
    for (const row of suggestions) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as { message?: unknown }).message === "string"
      ) {
        lines.push(`• ${(row as { message: string }).message}`);
      }
    }
  }

  const route = context?.routePreview;
  if (route && typeof route === "object") {
    const r = route as Record<string, unknown>;
    if (typeof r.durationSeconds === "number" && r.durationSeconds > 0) {
      const hours = Math.max(1, Math.round(r.durationSeconds / 3600));
      lines.push(
        `• The drive is about ${hours} hr — plan fuel, rest stops, and overnight stays if needed.`,
      );
    }
    if (typeof r.distanceMeters === "number" && r.distanceMeters > 0) {
      const miles = (r.distanceMeters / 1609.344).toFixed(1);
      lines.push(`• Total distance is roughly ${miles} mi.`);
    }
    if (typeof r.borderNotice === "string" && r.borderNotice.trim()) {
      lines.push(`• Border: ${r.borderNotice.trim()} Carry passport/ID.`);
    }
    if (typeof r.lastMileNotice === "string" && r.lastMileNotice.trim()) {
      lines.push(`• Last mile: ${r.lastMileNotice.trim()}`);
    }
  }

  if (typeof context?.contextNotice === "string" && context.contextNotice.trim()) {
    lines.push(`• ${context.contextNotice.trim()}`);
  }

  if (lines.length === 1) {
    lines.push("• Check the route card warnings on Live before you start.");
  }

  lines.push("Tap Start Solo Live when you're ready to navigate.");
  return lines.join("\n");
}

export function classifyMode(message: string): WayraMode {
  const q = normalizeQuery(message);
  if (!q) return "app_guide";

  const discovery = classifyDiscoveryExpects(message);
  if (discovery === "app_guide") return "app_guide";
  if (discovery === "local" || discovery === "llm") return "travel";

  if (isPlaceNameLlmQuestion(message)) return "travel";

  if (isLiveMapContextQuestion(message)) return "travel";

  if (isLiveTravelPrepQuestion(message)) return "travel";

  if (
    hasAny(
      q,
      /\bwhat is this\b/,
      /\bwhat is it\b/,
      /\bwhat s this\b/,
      /\bwhat s it\b/,
      /\bis it a\b/,
      /\bis this a\b/,
    ) &&
    !hasAny(q, /\bthis app\b/, /\bthe app\b/, /\bwayra\b/, /\bplan page\b/)
  ) {
    return "travel";
  }

  const travelStrong = hasAny(
    q,
    /\bsuggest\b/,
    /\brecommend\b/,
    /\bbest places\b/,
    /\bplaces to visit\b/,
    /\bplaces to see\b/,
    /\bweekend (trip|getaway|escape)\b/,
    /\bwhere should i (go|travel)\b/,
    /\bthings to do in\b/,
    /\bitinerary\b/,
    /\btravel guide\b/,
    /\bcity break\b/,
    /\bhidden gems\b/,
    /\bvisit (tokyo|japan|paris|europe|italy|bali|goa)\b/,
  );

  const appStrong = hasAny(
    q,
    /\bhow do i\b/,
    /\bhow to\b/,
    /\bhow can i\b/,
    /\bwhere (do|can) i (find|see|open|get)\b/,
    /\bwhat is the\b/,
    /\bwhat is\b/,
    /\bwhat s the\b/,
    /\bwhat does\b/,
    /\bshow me how\b/,
    /\bexplain (the|this)\b/,
    /\bhelp me (use|with|find)\b/,
    /\bin the app\b/,
    /\bon rovvy\b/,
    /\bwayra\b/,
  );

  if (travelStrong && !appStrong) return "travel";
  if (appStrong && !travelStrong) return "app_guide";

  if (
    /\bplan page\b/.test(q) ||
    /\bplan tab\b/.test(q) ||
    (/\bplan\b/.test(q) && /\b(what is|what s|for|explain)\b/.test(q))
  ) {
    return "app_guide";
  }

  if (travelStrong) return "travel";

  if (
    hasAny(
      q,
      /\b(japan|tokyo|kyoto|europe|beach|mountain|abroad)\b/,
      /\bdestination\b/,
      /\bgetaway\b/,
      /\bfamily friendly\b/,
      /\bworth the trip\b/,
    ) &&
    !hasAny(q, /\b(create|delete|invite|notification|poll|split|setting|profile)\b/)
  ) {
    return "travel";
  }

  return "app_guide";
}

export function resolveAppIntent(message: string): AppIntent | null {
  const q = normalizeQuery(message);
  if (!q) return null;

  if (
    /\bplan page\b/.test(q) ||
    /\bplan tab\b/.test(q) ||
    (/\bplan\b/.test(q) && /\b(what is|what s|what for|used for|explain)\b/.test(q))
  ) {
    return "plan_page_explainer";
  }

  if (
    hasAny(
      q,
      /\bnotification settings?\b/,
      /\bnotification preferences?\b/,
      /\balert settings?\b/,
    )
  ) {
    return "notification_settings";
  }

  if (
    hasAny(
      q,
      /\bnotification\b/,
      /\bnotifications\b/,
      /\bnotify\b/,
      /\balerts?\b/,
      /\bbell icon\b/,
      /\bsee my (notifications|alerts)\b/,
    )
  ) {
    return "notifications";
  }

  if (
    hasAny(
      q,
      /\b(create|make|start|new|add)\b.{0,40}\bgroup\b/,
      /\bgroup\b.{0,40}\b(create|make|start|new)\b/,
      /\bnew group\b/,
    )
  ) {
    return "create_group";
  }

  if (
    hasAny(
      q,
      /\b(create|make|start|new|add)\b.{0,40}\btrip\b/,
      /\btrip\b.{0,40}\b(create|make|start|new)\b/,
      /\bnew trip\b/,
    )
  ) {
    return "create_trip";
  }

  if (hasAny(q, /\binvite\b/, /\binvitation\b/, /\binvite (link|code|friends)\b/)) {
    return "invites";
  }
  if (hasAny(q, /\bpoll\b/, /\bvote\b/, /\bvoting\b/)) return "polls";
  if (hasAny(q, /\bsplit\b/, /\bexpense\b/, /\bbalance\b/, /\bsettle\b/, /\bowe\b/)) {
    return "splits";
  }
  if (
    hasAny(
      q,
      /\bhow does live work\b/,
      /\bhow does solo live work\b/,
      /\bwhat does the pencil icon do\b/,
      /\bmeet point\b/,
      /\bmeeting point\b/,
      /\blocation shar/,
      /\bshare (my )?location\b/,
      /\bcountdown\b/,
      /\btimer\b/,
      /\bhow\b.{0,30}\blive tab\b/,
      /\bhow\b.{0,30}\blive map\b/,
      /\bopen live\b/,
      /\buse live\b/,
    ) ||
    (/\blive\b/.test(q) &&
      hasAny(q, /\bhow do i\b/, /\bhow to\b/, /\bhow can i\b/, /\bwhere do i\b/, /\bhow does\b/) &&
      !/\brovvy live\b/.test(q))
  ) {
    return "live_map";
  }
  if (hasAny(q, /\bbuddy trip\b/, /\bbuddy travel\b/, /\bjoin a trip\b/)) {
    return "buddy_trips";
  }
  if (hasAny(q, /\bexplore\b/, /\bdiscover\b/, /\bsaved places\b/, /\bsave (a )?destination\b/)) {
    return "explore";
  }
  if (hasAny(q, /\bmemories\b/, /\bposts\b/, /\bphoto\b/, /\balbum\b/)) {
    return "memories";
  }
  if (hasAny(q, /\bprofile\b/, /\bavatar\b/, /\bbio\b/)) return "profile";
  if (hasAny(q, /\bsetting\b/, /\bpassword\b/, /\baccount\b/, /\blogin\b/, /\bsubscription\b/)) {
    return "settings";
  }

  return null;
}

export function resolveAppGuideReply(message: string): string | null {
  const intent = resolveAppIntent(message);
  if (intent) return APP_INTENT_RESPONSES[intent];
  return null;
}

export function contextualAppFallback(page: string, activeTab?: string | null): string {
  const p = (page || "dashboard").replace(/_/g, "/").replace(/^\//, "") || "dashboard";
  const tab = (activeTab || "").trim();

  if (p.startsWith("dashboard") || p === "") {
    return (
      "On your command center you can start a trip, open Travel Hub for groups, " +
      "check open polls and splits, tap the bell for notifications, or open Plan to book transport. " +
      "Tell me which you want—groups, trips, Plan, polls, expenses, Live map, or Explore."
    );
  }
  if (p.startsWith("plan") || ["flights", "hotels", "routes", "buses"].includes(p)) {
    return (
      "You're in Plan—use Flights, Hotels, Routes, or Buses from the sidebar to compare options. " +
      "Ask me how to search any tab, or switch to a trip to align bookings with your group."
    );
  }
  if (p.startsWith("explore") || p.startsWith("activities")) {
    return (
      "Explore is for discovery—filter by vibe, save places you love, and send ideas to a trip poll. " +
      "Buddy Trips and Events are under Explore and Group when you're ready to coordinate."
    );
  }
  if (
    p.startsWith("group") ||
    p.startsWith("travel-hub") ||
    p.startsWith("buddy")
  ) {
    return (
      "This area is for people moving together—Travel Hub for chat and invites, Buddy Trips to find companions, " +
      "Live for maps and meet points. What should we set up first?"
    );
  }
  if (p.startsWith("live")) {
    return (
      "You're on Rovvy Live — pick a place on the map, then ask me about that pin, the route, or warnings. " +
      "Try: \"What location did I pick?\" after you drop a pin."
    );
  }
  if (p.startsWith("profile") || p.startsWith("settings")) {
    return (
      "Profile and Settings cover your identity, avatar, security, and notification preferences. " +
      "Say if you want to edit your profile, change alerts, or upgrade your plan."
    );
  }
  if (tab) {
    return (
      `You're on /${p} (${tab}). I can explain trips, groups, Plan, polls, splits, notifications, ` +
      "Live coordination, or Explore—what should we do next?"
    );
  }
  return (
    `You're on /${p}. I can walk you through groups, trips, Plan bookings, polls, splits, ` +
    "notifications (bell icon), Live map, or Explore—pick one and I'll give exact taps."
  );
}

function contextCity(context?: Record<string, unknown>): string | null {
  if (!context) return null;
  for (const key of ["city", "home_city", "location", "origin"]) {
    const val = context[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  const pathname = context.pathname;
  if (typeof pathname === "string" && pathname.toLowerCase().includes("chicago")) {
    return "Chicago";
  }
  return null;
}

export function resolveTravelFallback(
  message: string,
  context?: Record<string, unknown>,
): string | null {
  const q = normalizeQuery(message);
  if (!q) return null;

  const prefix =
    "Live travel AI is taking longer than usual, but here are a few ideas to get you started:\n\n";

  if (hasAny(q, /\bjapan\b/, /\btokyo\b/, /\bkyoto\b/)) {
    return (
      prefix +
      "Tokyo — neighborhoods, food halls, and modern culture.\n" +
      "Kyoto — temples, gardens, and traditional streets.\n" +
      "Osaka — street food and easy day trips.\n" +
      "Hiroshima — history plus Miyajima island.\n" +
      "Hokkaido — nature, skiing, and cooler summer escapes.\n\n" +
      "Save favorites in Explore, then run a group poll to pick bases and dates."
    );
  }

  if (hasAny(q, /\bweekend\b/, /\bgetaway\b/, /\bshort trip\b/, /\bweekend trip\b/)) {
    const city = (contextCity(context) || "").toLowerCase();
    if (city.includes("chicago") || hasAny(q, /\bchicago\b/, /\bmidwest\b/, /\bfrom chicago\b/)) {
      return (
        prefix +
        "Milwaukee — lakefront, breweries, and easy train access.\n" +
        "Lake Geneva — resort town and lake days within a couple of hours.\n" +
        "Galena — historic Main Street and bluff-country scenery.\n" +
        "Door County — coastal villages, cherries, and slow weekends.\n" +
        "Nashville — live music and food if you want a longer hop.\n\n" +
        "Sketch dates in a new trip, then poll your group before you book."
      );
    }
    return (
      prefix +
      "Pick a radius you are willing to drive or ride: a nearby city for food and culture, " +
      "a lake or coast for outdoors, or a small historic town for a slower pace.\n\n" +
      "In Rovvy, create a weekend trip, drop two or three options in a poll, and book from Plan once you align."
    );
  }

  if (hasAny(q, /\bbeach\b/, /\bcoast\b/, /\bsea\b/)) {
    return (
      prefix +
      "Look for shoulder-season beach towns with walkable centers, one water activity, " +
      "and a backup indoor plan for rain.\n\n" +
      "Save shore spots in Explore, then attach them to your trip map for the group."
    );
  }

  if (hasAny(q, /\bmountain\b/, /\bhike\b/, /\btrek\b/)) {
    return (
      prefix +
      "Choose elevation and daily mileage your group agrees on, check shoulder-season weather, " +
      "and book lodging near trailheads early.\n\n" +
      "Use Live meet points on hike day so everyone starts from the same pin."
    );
  }

  if (hasAny(q, /\bfood\b/, /\brestaurant\b/, /\bculinary\b/)) {
    return (
      prefix +
      "Anchor one must-try meal, one casual local spot, and one market or food hall—" +
      "that keeps groups happy without over-planning.\n\n" +
      "Save pins on the map and split the tab in Expenses when you settle up."
    );
  }

  if (hasAny(q, /\bsuggest\b/, /\brecommend\b/, /\bdestination\b/, /\bwhere should i go\b/)) {
    return (
      prefix +
      "Name your month, budget, and how far you will travel—city breaks favor museums and food, " +
      "coasts favor weather windows, mountains favor gear and lodging near trails.\n\n" +
      "Try Explore for inspiration, then vote in a trip poll before anyone books flights."
    );
  }

  return null;
}

/** UI mode: flying = travel, perched = app guide */
export function detectBirdState(message: string): "flying" | "perched" {
  return classifyMode(message) === "travel" ? "flying" : "perched";
}

export function localAssistantReply(
  message: string,
  page: string,
  activeTab?: string | null,
  context?: Record<string, unknown>,
): string | null {
  const liveMap = resolveLiveMapContextReply(message, page, context);
  if (liveMap) return liveMap;

  const livePrep = resolveLiveTravelPrepReply(message, page, context);
  if (livePrep) return livePrep;

  const mode = classifyMode(message);
  if (mode === "app_guide") {
    const app = resolveAppGuideReply(message);
    if (app) return app;
    return contextualAppFallback(page, activeTab);
  }
  return resolveTravelFallback(message, context);
}
