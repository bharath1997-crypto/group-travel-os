import type { ExploreSlot } from "./explore-hub-data";
import { calendarStripDateRange, formatIsoDate, isoDatesInRange } from "./explore-hub-dates";
import {
  isExploreEventListing,
  isExploreFoodAndDrinkListing,
  isExploreFreeInWhenRange,
  isExploreLandmarkListing,
  isExploreLiveMusicListing,
  isExploreOutdoorsListing,
  eventDateInActiveScope,
} from "./explore-hub-listing-predicates";

export type ExploreCalendarDaySummary = {
  iso: string;
  weekdayLabel: string;
  dayNum: number;
  eventCount: number;
  musicCount: number;
  outdoorCount: number;
  foodCount: number;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventDayIso(slot: ExploreSlot): string | null {
  const day = (slot.eventDateIso || "").split("T")[0]?.slice(0, 10);
  return day && day.length >= 10 ? day : null;
}

/** Dated events match when/day; places always stay in surroundings pool. */
export function slotVisibleInTimeScope(
  slot: ExploreSlot,
  scope: { when: string; calendarDayIso: string | null },
): boolean {
  if (slot.exploreListingKind === "place") return true;
  if (!isExploreEventListing(slot)) return false;
  return eventDateInActiveScope(slot.eventDateIso, scope.when, scope.calendarDayIso);
}

export function filterSlotsByTimeScope(
  slots: ExploreSlot[],
  when: string,
  calendarDayIso: string | null,
): ExploreSlot[] {
  const scope = { when, calendarDayIso };
  return slots.filter((slot) => slotVisibleInTimeScope(slot, scope));
}

export function buildCalendarDaySummaries(
  slots: ExploreSlot[],
  when: string,
  calendarRange = calendarStripDateRange(),
): ExploreCalendarDaySummary[] {
  const eventSlots = slots.filter(isExploreEventListing);
  return isoDatesInRange(calendarRange.dateFrom, calendarRange.dateTo).map((iso) => {
    const d = new Date(`${iso}T12:00:00`);
    const onDay = eventSlots.filter((slot) => eventDayIso(slot) === iso);
    const scoped = { when, calendarDayIso: iso };
    const musicCount = onDay.filter(
      (s) => isExploreLiveMusicListing(s) && slotVisibleInTimeScope(s, scoped),
    ).length;
    const outdoorCount = onDay.filter(
      (s) => isExploreOutdoorsListing(s) && slotVisibleInTimeScope(s, scoped),
    ).length;
    const foodCount = onDay.filter(
      (s) => isExploreFoodAndDrinkListing(s) && slotVisibleInTimeScope(s, scoped),
    ).length;
    return {
      iso,
      weekdayLabel: WEEKDAY[d.getDay()] ?? "",
      dayNum: d.getDate(),
      eventCount: onDay.length,
      musicCount,
      outdoorCount,
      foodCount,
    };
  });
}

export function calendarDayHasInventory(summary: ExploreCalendarDaySummary): boolean {
  return summary.eventCount > 0;
}

export function formatCalendarSelectedLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAY[d.getDay()]} ${formatIsoDate(d)}`;
}

export function freeEventsOnCalendarDay(slots: ExploreSlot[], iso: string, when: string): number {
  return slots.filter(
    (s) =>
      isExploreEventListing(s) &&
      eventDayIso(s) === iso &&
      isExploreFreeInWhenRange(s, when, iso),
  ).length;
}
