/**
 * Wayra messenger — session greeting, timestamps, chat location attachments.
 */

export type WayraChatLocation = {
  label: string;
  lat: number;
  lng: number;
  source: "map_pin" | "gps" | "manual";
};

export type WayraTripHint = {
  title: string;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

export type WayraMessengerProfile = {
  full_name?: string | null;
  trips?: WayraTripHint[];
};

export const WAYRA_SESSION_GREETING_KEY = "rovvy_wayra_session_greeted";

/** Formal honorific from profile name — "Ram Kumar" → "Mr. Kumar". */
export function honorificName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "there";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  const last = parts[parts.length - 1]!;
  return `Mr. ${last}`;
}

function parseTripDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Trips whose start or end falls within the current calendar week. */
export function tripsThisWeek(
  trips: WayraTripHint[],
  now = new Date(),
): WayraTripHint[] {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  return trips.filter((trip) => {
    const start = parseTripDate(trip.start_date);
    const end = parseTripDate(trip.end_date);
    if (start && start >= weekStart && start <= weekEnd) return true;
    if (end && end >= weekStart && end <= weekEnd) return true;
    if (start && end && start <= weekStart && end >= weekEnd) return true;
    return false;
  });
}

export function buildWayraSessionGreeting(input: {
  fullName?: string | null;
  trips?: WayraTripHint[];
  placeLabel?: string | null;
  onLive?: boolean;
}): string {
  const honorific = honorificName(input.fullName);
  const lines: string[] = [
    `Hey — hi ${honorific}. I'm Wayra, your Rovvy travel assistant.`,
  ];

  if (input.fullName?.trim()) {
    lines.push(
      `Your profile name is ${input.fullName.trim()} — I'll keep that in mind as we chat.`,
    );
  }

  if (input.onLive && input.placeLabel?.trim()) {
    lines.push(
      `You're on Live with ${input.placeLabel.trim()} selected. Ask about this place, the route, or what's nearby.`,
    );
  } else if (input.onLive) {
    lines.push(
      "You're on Live — pick a place on the map and I'll answer about that pin.",
    );
  }

  const weekTrips = tripsThisWeek(input.trips ?? []);
  if (weekTrips.length > 0) {
    const first = weekTrips[0]!;
    const dest = first.destination?.trim();
    if (weekTrips.length === 1) {
      lines.push(
        dest
          ? `You have a trip this week — ${first.title} to ${dest}. Want help preparing?`
          : `You have a trip this week: ${first.title}. Want help preparing?`,
      );
    } else {
      lines.push(
        `You have ${weekTrips.length} trips this week. The next one is ${first.title}${dest ? ` (${dest})` : ""}.`,
      );
    }
  } else {
    lines.push(
      "What are your plans today? Any weekend trips or holidays you're thinking about?",
    );
  }

  lines.push(
    "To ask about nearby places, tap + in the chat box and attach your location — then try pharmacies, food, or anything around you.",
  );

  return lines.join("\n\n");
}

/** WhatsApp-style time under each bubble (client display only). */
export function formatWayraMessageTime(
  createdAt: number,
  now = Date.now(),
): string {
  const d = new Date(createdAt);
  const sameDay =
    d.getFullYear() === new Date(now).getFullYear() &&
    d.getMonth() === new Date(now).getMonth() &&
    d.getDate() === new Date(now).getDate();

  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function readWayraSessionGreeted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(WAYRA_SESSION_GREETING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWayraSessionGreeted(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WAYRA_SESSION_GREETING_KEY, "1");
  } catch {
    /* ignore quota */
  }
}

export function chatLocationFromPlace(place: {
  name?: string | null;
  lat: number;
  lng: number;
}): WayraChatLocation {
  return {
    label: place.name?.trim() || "Dropped pin",
    lat: place.lat,
    lng: place.lng,
    source: "map_pin",
  };
}
