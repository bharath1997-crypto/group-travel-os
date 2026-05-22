/**
 * Wayra intent classification and local fallbacks (mirrors app/services/wayra_intent.py).
 * Used by AIAssistantSidecar for fast App Guide answers and graceful travel degradation.
 */

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
  return message
    .toLowerCase()
    .trim()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ");
}

export function classifyMode(message: string): WayraMode {
  const q = normalizeQuery(message);
  if (!q) return "app_guide";

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
      /\blive\b/,
      /\bmeet point\b/,
      /\bmeeting point\b/,
      /\blocation shar/,
      /\bshare (my )?location\b/,
      /\bcountdown\b/,
      /\btimer\b/,
    )
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
    p.startsWith("buddy") ||
    p.startsWith("live")
  ) {
    return (
      "This area is for people moving together—Travel Hub for chat and invites, Buddy Trips to find companions, " +
      "Live for maps and meet points. What should we set up first?"
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
  const mode = classifyMode(message);
  if (mode === "app_guide") {
    const app = resolveAppGuideReply(message);
    if (app) return app;
    return contextualAppFallback(page, activeTab);
  }
  return resolveTravelFallback(message, context);
}
