import { readJsonLs, writeJsonLs } from "./storage";

export const CHAT_PREFS_KEY = "travelhub_chat_prefs_v1";
export const DELETED_CHATS_KEY = "travelhub_deleted_chats_v1";
export const GT_SCHEDULED_CALLS = "gt_scheduled_calls_v1";

/** Simple per-chat reminder rows used by travel-hub info panels */
export type ScheduleCallReminder = {
  id: string;
  chatId: string;
  chatName: string;
  title: string;
  at: number;
};

export function readScheduleCallReminders(): ScheduleCallReminder[] {
  return readJsonLs<ScheduleCallReminder[]>(GT_SCHEDULED_CALLS, []);
}

export function appendScheduleCallReminder(
  entry: Omit<ScheduleCallReminder, "id"> & { id?: string },
): ScheduleCallReminder[] {
  const list = readScheduleCallReminders();
  const row: ScheduleCallReminder = {
    id:
      entry.id ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatId: entry.chatId,
    chatName: entry.chatName,
    title: entry.title,
    at: entry.at,
  };
  const next = [...list, row];
  writeJsonLs(GT_SCHEDULED_CALLS, next);
  return next;
}

export type ChatPrefs = {
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
  favorite?: boolean;
  lastReadAt?: number;
};

export function readChatPrefs(): Record<string, ChatPrefs> {
  return readJsonLs<Record<string, ChatPrefs>>(CHAT_PREFS_KEY, {});
}

export function writeChatPrefs(prefs: Record<string, ChatPrefs>): void {
  writeJsonLs(CHAT_PREFS_KEY, prefs);
}

export function updateChatPref(
  chatId: string,
  partial: Partial<ChatPrefs>,
): Record<string, ChatPrefs> {
  const all = readChatPrefs();
  all[chatId] = { ...all[chatId], ...partial };
  writeChatPrefs(all);
  return all;
}

export function readDeletedChats(): string[] {
  return readJsonLs<string[]>(DELETED_CHATS_KEY, []);
}

export function markChatDeleted(chatId: string): string[] {
  const deleted = [...new Set([...readDeletedChats(), chatId])];
  writeJsonLs(DELETED_CHATS_KEY, deleted);
  return deleted;
}

export function getUnreadCount(
  chatId: string,
  lastMessageTime: number | null | undefined,
  lastMessage: string | null | undefined,
  demoUnread?: number,
  pref?: ChatPrefs,
): number {
  if (demoUnread != null) {
    if (pref?.lastReadAt) return 0;
    return demoUnread;
  }
  const t = lastMessageTime ?? 0;
  const readAt = pref?.lastReadAt ?? 0;
  if (t <= readAt) return 0;
  if (!(lastMessage ?? "").trim()) return 0;
  return 1;
}
