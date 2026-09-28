import {
  DEMO_CHAT_COMMUNITY_ID,
  DEMO_CHAT_ROVVY_HELP_ID,
} from "@/lib/lounge/constants";
import type { ChatInfo, GroupOut, UserMe } from "@/lib/lounge/hub-types";

/** LoungeDock `/lounge/chats` row shape */
export type DockChat = {
  id: string;
  type: string;
  name: string | null;
  trip_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  avatar_url?: string | null;
  members?: { user_id: string; full_name?: string; avatar_url?: string | null }[];
  isBot?: boolean;
  isAnnouncement?: boolean;
  demoUnread?: number;
};

export type DockGroup = {
  id: string;
  name: string;
  members?: { user_id: string; full_name: string; avatar_url?: string | null }[];
};

export function dockUserToUserMe(
  user: { id: string; full_name: string } | null,
): UserMe | null {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name,
  };
}

export function dockGroupToGroupOut(g: DockGroup): GroupOut {
  return {
    id: g.id,
    name: g.name,
    description: null,
    members: (g.members ?? []).map((m) => ({
      id: m.user_id,
      user_id: m.user_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? null,
    })),
  };
}

export function dockChatToChatInfo(
  chat: DockChat,
  currentUserId?: string,
): ChatInfo {
  const isBot = Boolean(chat.isBot || chat.id === DEMO_CHAT_ROVVY_HELP_ID);
  const isAnnouncement = Boolean(
    chat.isAnnouncement || chat.id === DEMO_CHAT_COMMUNITY_ID,
  );

  const isGroupLike =
    chat.type === "group" ||
    chat.type === "trip" ||
    Boolean(chat.trip_id) ||
    chat.id.startsWith("group_");

  const group_id = chat.id.startsWith("group_")
    ? chat.id.slice("group_".length)
    : isGroupLike && !chat.id.startsWith("group_")
      ? chat.id
      : undefined;

  const memberIds = (chat.members ?? []).map((m) => m.user_id).filter(Boolean);
  const members =
    memberIds.length > 0
      ? memberIds
      : currentUserId
        ? [currentUserId]
        : [];

  const lastTs = chat.last_message_at
    ? new Date(chat.last_message_at).getTime()
    : undefined;
  const createdTs = chat.created_at
    ? new Date(chat.created_at).getTime()
    : Date.now();

  return {
    id: chat.id,
    name:
      chat.name?.trim() ||
      (isBot
        ? "Rovvy Help"
        : isAnnouncement
          ? "Community Updates"
          : isGroupLike
            ? "Group"
            : "Direct Chat"),
    type: isGroupLike ? "group" : "individual",
    group_id,
    members,
    created_by: chat.created_by ?? currentUserId ?? "",
    created_at: lastTs ?? createdTs,
    last_message: chat.last_message_preview ?? undefined,
    last_message_time: lastTs,
    isBot,
    isAnnouncement,
    demoUnread: chat.demoUnread,
    metadata: chat.avatar_url ? { avatar_url: chat.avatar_url } : undefined,
  };
}

export function dockChatsToChatInfoList(
  chats: DockChat[],
  currentUserId?: string,
): ChatInfo[] {
  return chats.map((c) => dockChatToChatInfo(c, currentUserId));
}
