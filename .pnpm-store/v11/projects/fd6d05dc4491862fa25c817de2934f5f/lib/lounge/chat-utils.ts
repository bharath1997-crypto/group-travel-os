import type { ChatMessage } from "./hub-types";

export function shouldShowDateSeparator(
  messages: ChatMessage[],
  index: number,
): boolean {
  if (index === 0) return true;
  const curr = messages[index];
  const prev = messages[index - 1];
  if (!curr?.timestamp || !prev?.timestamp) return true;
  return (
    new Date(curr.timestamp).toDateString() !==
    new Date(prev.timestamp).toDateString()
  );
}

export function getDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getGroupWaDateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function groupReadReceipt(
  msg: ChatMessage,
  me: string,
): "sent" | "delivered" | "read" {
  const rb = msg.read_by || {};
  const otherReaders = Object.keys(rb).filter((k) => k !== me && rb[k]);
  if (otherReaders.length > 0) return "read";
  return "delivered";
}
