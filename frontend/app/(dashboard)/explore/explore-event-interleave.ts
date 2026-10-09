import type { ExploreSlot } from "./explore-hub-data";

export function exploreEventProviderInterleaveKey(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("eventbrite")) return "eventbrite";
  if (s.includes("ticketmaster") || s.includes("ticketweb")) return "ticketmaster";
  return "other";
}

const INTERLEAVE_ORDER = ["ticketmaster", "eventbrite", "other"] as const;

/** Within each calendar day, round-robin Ticketmaster / Eventbrite / other (deterministic). */
export function interleaveEventSlotsByDayAndProvider(eventSlots: ExploreSlot[]): ExploreSlot[] {
  const byDay = new Map<string, ExploreSlot[]>();
  for (const slot of eventSlots) {
    const day = slot.eventDateIso || "";
    const list = byDay.get(day) ?? [];
    list.push(slot);
    byDay.set(day, list);
  }

  const sortedDays = [...byDay.keys()].sort();
  const result: ExploreSlot[] = [];

  for (const day of sortedDays) {
    const dayEvents = byDay.get(day)!;
    const queues = new Map<string, ExploreSlot[]>();
    for (const slot of dayEvents) {
      const key = exploreEventProviderInterleaveKey(slot.source);
      const q = queues.get(key) ?? [];
      q.push(slot);
      queues.set(key, q);
    }

    const keys: string[] = [];
    for (const k of INTERLEAVE_ORDER) {
      if (queues.has(k)) keys.push(k);
    }
    for (const k of queues.keys()) {
      if (!keys.includes(k)) keys.push(k);
    }

    let round = 0;
    for (;;) {
      let pushed = false;
      for (const k of keys) {
        const q = queues.get(k)!;
        if (round < q.length) {
          result.push(q[round]!);
          pushed = true;
        }
      }
      if (!pushed) break;
      round += 1;
    }
  }

  return result;
}
