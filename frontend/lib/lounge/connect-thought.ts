import { GT_LOUNGE_STATUS, type LoungeStatus } from "@/lib/lounge/stickers";
import { readJsonLs, writeJsonLs } from "@/lib/lounge/storage";

export const THOUGHT_EMOJIS = ["😊", "🤩", "❤️", "🙏", "✈️", "🎉", "💭", "🌅"] as const;

export function readMyThought(userId: string): LoungeStatus | null {
  const all = readJsonLs<LoungeStatus[]>(GT_LOUNGE_STATUS, []);
  return all.find((s) => s.userId === userId) ?? null;
}

export function saveMyThought(
  userId: string,
  userName: string,
  text: string,
): LoungeStatus {
  const entry: LoungeStatus = {
    userId,
    userName: userName.trim() || "You",
    text: text.trim(),
    updatedAt: Date.now(),
  };
  const all = readJsonLs<LoungeStatus[]>(GT_LOUNGE_STATUS, []);
  const next = [entry, ...all.filter((s) => s.userId !== userId)].slice(0, 20);
  writeJsonLs(GT_LOUNGE_STATUS, next);
  return entry;
}

export function clearMyThought(userId: string): void {
  const all = readJsonLs<LoungeStatus[]>(GT_LOUNGE_STATUS, []);
  writeJsonLs(
    GT_LOUNGE_STATUS,
    all.filter((s) => s.userId !== userId),
  );
}

export function thoughtPreview(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
