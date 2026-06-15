import type { TripOut } from "./hub-types";

export function daysDiff(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86400000));
}

export function formatTripHeaderDates(t: TripOut): string {
  const a = t.start_date
    ? new Date(t.start_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
  const b = t.end_date
    ? new Date(t.end_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
  return `${a} – ${b}`;
}

export function groupTripStatusPill(t: TripOut): {
  bg: string;
  text: string;
  dotColor: string;
} {
  const st = String(t.status || "").toLowerCase();
  const now = new Date();
  if (st === "ongoing" && t.end_date) {
    const d = daysDiff(new Date(t.end_date), now);
    return {
      bg: "rgba(29, 158, 117, 0.25)",
      text: `ONGOING · ${d} day${d === 1 ? "" : "s"} to go`,
      dotColor: "#1d9e75",
    };
  }
  if ((st === "planning" || st === "confirmed") && t.start_date) {
    const d = daysDiff(new Date(t.start_date), now);
    return {
      bg: "rgba(59, 130, 246, 0.2)",
      text: `UPCOMING · starts in ${d} day${d === 1 ? "" : "s"}`,
      dotColor: "#60a5fa",
    };
  }
  if (st === "completed" || st === "cancelled") {
    return {
      bg: "rgba(107, 114, 128, 0.25)",
      text: "COMPLETED",
      dotColor: "#9ca3af",
    };
  }
  return {
    bg: "rgba(107, 114, 128, 0.25)",
    text: t.status || "—",
    dotColor: "#9ca3af",
  };
}
