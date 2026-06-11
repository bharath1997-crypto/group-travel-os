export function formatCallsOutgoingLine(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === today.toDateString()) {
    return `Outgoing · Today ${timeStr}`;
  }
  const dayPart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Outgoing · ${dayPart}`;
}
