"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type TouchEvent,
} from "react";
import {
  BellOff,
  Calendar,
  Camera,
  Check,
  Loader2,
  MessageCircle,
  Search,
  Users,
  X,
} from "lucide-react";
import { apiFetch, apiFetchWithStatus, fetchWithTimeout } from "@/lib/api";
import {
  DEMO_CHAT_COMMUNITY_ID,
  DEMO_CHAT_ROVVY_HELP_ID,
  type GtCallHistoryEntry,
} from "@/lib/lounge/constants";
import { getUnreadCount as getUnreadCountLs, type ChatPrefs } from "@/lib/lounge/chat-prefs";
import {
  formatCallDurationFmt,
  formatCallHistorySubline,
  readCallHistoryLs,
} from "@/lib/lounge/storage";
import {
  DemoContactsSection,
  SwipeChatRow,
} from "@/components/lounge";
import { HubSpacePanel } from "@/components/lounge/hub/HubSpacePanel";
import WayraIcon from "@/components/ui/WayraIcon";
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  ThIconChevronLeft,
  ThIconChevronRight,
  ThIconMail,
  ThIconPlane,
} from "./HubIcons";
import { AdvancedScheduledCallModal, type ScheduledCallData } from "@/components/AdvancedScheduledCallModal";
import {
  CallParticipantSelector,
  type SelectableContact,
} from "@/components/CallParticipantSelector";
import { HUB_LIST_THEME as T } from "@/lib/lounge/hub-theme";
import type { DemoContactRow } from "@/lib/lounge/demo-contacts";
import type {
  ChatInfo,
  ContactPerson,
  GroupMemberOut,
  GroupOut,
  SelectedGroupParticipant,
  UserMe,
  UserSearchResultRow,
} from "@/lib/lounge/hub-types";
import {
  chatRowDisplayName,
  chatRowDmAvatarUrl,
  dmListPeerOnline,
  formatDisplayNameHub,
  formatListTimestamp,
  formatUserSearchMeta,
  memberOnlineRecently,
  normalizeConnectUserSearchQuery,
  initialsFromName,
  isAbortError,
  isValidEmailFormat,
  isInlineSvgDataUrlToSkipForPhoto,
  isLegacyDicebearUrl,
  listAvatarColor,
} from "@/lib/lounge/hub-utils";

type ContactRow = ContactPerson & { groupsTogether: number };

const {
  ACCENT,
  ADD_BY_EMAIL_ROW_BG,
  EMAIL_INVITE_AVATAR_BG,
  LIST_BORDER,
  LIST_ROW_HOVER,
  LIST_ROW_SELECTED,
  LIST_TEXT,
  LIST_TEXT_MUTED,
  TEXT,
  TEXT_MUTED,
  SECTION_LABEL,
  BRAND_ACCENT,
  RIGHT_PANEL_BG,
  BG,
  BORDER_SUB,
  MSG_BORDER,
  SURFACE,
  ONLINE,
} = T;

const DEMO_CHAT_ROVVY_HELP: ChatInfo = {
  id: DEMO_CHAT_ROVVY_HELP_ID,
  name: "Rovvy Help",
  type: "individual",
  members: [],
  created_by: "system",
  created_at: Date.now(),
  isBot: true,
  displayTime: "now",
  displayPreview: "Hi! Ask me anything about planning your trip",
  demoUnread: 1,
};

const DEMO_CHAT_COMMUNITY: ChatInfo = {
  id: DEMO_CHAT_COMMUNITY_ID,
  name: "Community Updates",
  type: "group",
  members: [],
  created_by: "system",
  created_at: Date.now(),
  isAnnouncement: true,
  displayTime: "Apr 22",
  displayPreview: "New feature: AI trip planner is now live",
  demoUnread: 3,
  listAvatarBg: "#2563EB",
  listInitials: "CU",
};

function getUnreadCount(chat: ChatInfo, pref?: ChatPrefs): number {
  return getUnreadCountLs(
    chat.id,
    chat.last_message_time ?? chat.created_at,
    chat.last_message ?? chat.displayPreview ?? null,
    chat.demoUnread,
    pref,
  );
}

function HubSearchField({
  value,
  onChange,
  placeholder = "Search chats...",
  tone = "dark",
  onFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** @default "Search chats..." */
  placeholder?: string;
  tone?: "dark" | "light" | "dock";
  onFocus?: () => void;
  className?: string;
}) {
  const isLight = tone === "light";
  const isDock = tone === "dock";

  if (isDock) {
    return (
      <div
        className={`flex h-9 w-full items-center gap-2 rounded-full px-3 text-left text-xs text-white/70 transition hover:bg-white/[0.18] ${className ?? ""}`}
        style={{ background: "rgba(255,255,255,0.14)" }}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-white/60" strokeWidth={2.5} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-xs text-white outline-none placeholder:text-white/50"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="text-sm leading-none text-white/50"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`shrink-0 px-4 py-2 ${className ?? ""}`}>
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-2"
        style={{
          background: isLight ? "#f3f4f6" : "#152030",
          borderColor: isLight ? "#e5e7eb" : "#2a3a50",
        }}
      >
        <span style={{ color: isLight ? LIST_TEXT_MUTED : TEXT_MUTED }} aria-hidden>
          <Search className="h-5 w-5 opacity-80" strokeWidth={1.5} />
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
          style={{
            color: isLight ? LIST_TEXT : TEXT,
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="text-lg leading-none"
            style={{ color: isLight ? LIST_TEXT_MUTED : TEXT_MUTED }}
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChatListRow72({
  active,
  onClick,
  avatar,
  name,
  preview,
  time,
  unread,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  name: string;
  preview: string;
  time: string;
  unread: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 border-b px-4 text-left transition-colors duration-150"
      style={{
        height: 72,
        borderBottom: `1px solid ${LIST_BORDER}`,
        background: active ? LIST_ROW_SELECTED : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = LIST_ROW_HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        {avatar}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="min-w-0 truncate text-[14px] font-medium"
            style={{ color: active ? "#ffffff" : LIST_TEXT }}
          >
            {name}
            {muted ? (
              <span
                className="ml-1 inline-flex items-center"
                style={{ color: active ? "rgba(255,255,255,0.72)" : "#64748b" }}
                title="Muted"
              >
                <BellOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </span>
            ) : null}
          </span>
          <span
            className="ml-auto shrink-0 text-[11px]"
            style={{ color: active ? "rgba(255,255,255,0.72)" : LIST_TEXT_MUTED }}
          >
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-[13px]"
            style={{
              color: active ? "rgba(255,255,255,0.82)" : LIST_TEXT_MUTED,
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {preview}
          </p>
          {unread > 0 ? (
            <span
              className="flex h-[18px] w-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: muted ? TEXT_MUTED : BRAND_ACCENT }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function HubChatsTab({
  groups,
  user,
  mainChatList,
  activeChatId,
  chatPrefs,
  onSelectChat,
  onNavigateToGroup,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
}: {
  groups: GroupOut[];
  user: UserMe | null;
  mainChatList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  onNavigateToGroup: (groupId: string) => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const syntheticGroupChats: ChatInfo[] = useMemo(() => {
    if (!user) return [];
    return groups
      .filter(
        (g) =>
          !mainChatList.some(
            (c) =>
              c.type === "group" &&
              (c.group_id === g.id || c.id === `group_${g.id}`),
          ),
      )
      .map((g) => {
        const ids = (g.members ?? []).map((m) => m.user_id);
        return {
          id: `group_${g.id}`,
          name: g.name,
          type: "group" as const,
          group_id: g.id,
          members: ids.length > 0 ? ids : [user.id],
          created_by: user.id,
          created_at: Date.now(),
          last_message_time: 0,
          last_message: "",
        } satisfies ChatInfo;
      });
  }, [groups, mainChatList, user]);

  const mergedFlat = useMemo(() => {
    const skipDemo = new Set<string>([
      DEMO_CHAT_ROVVY_HELP.id,
      DEMO_CHAT_COMMUNITY.id,
    ]);
    const list = mainChatList.filter((c) => !skipDemo.has(c.id));
    const comb = [...list, ...syntheticGroupChats];
    const sorted = [...comb].sort((a, b) => {
      const ga = a.type === "group" ? 1 : 0;
      const gb = b.type === "group" ? 1 : 0;
      if (gb !== ga) return gb - ga;
      const pa = chatPrefs[a.id]?.pinned ? 1 : 0;
      const pb = chatPrefs[b.id]?.pinned ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return (
        (b.last_message_time ?? b.created_at ?? 0) -
        (a.last_message_time ?? a.created_at ?? 0)
      );
    });
    return sorted;
  }, [mainChatList, syntheticGroupChats, chatPrefs]);

  const openContext = (chat: ChatInfo, clientX: number, clientY: number) => {
    setContextMenu({ x: clientX, y: clientY, chat });
  };

  const startLongPress = (chat: ChatInfo, ex: number, ey: number) => {
    if (chat.isBot || chat.isAnnouncement) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContext(chat, ex, ey);
      longPressTimerRef.current = null;
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderAvatar = (c: ChatInfo) => {
    if (c.isBot) {
      return (
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#E9ECEF] bg-[#F8F9FA]">
          <WayraIcon state="flying" size={0.5} variant="navy" animate={false} />
        </span>
      );
    }
    const rowLabel = chatRowDisplayName(c);
    const isGroup = c.type === "group";
    const gMeta = c.group_id
      ? groups.find((g) => g.id === c.group_id)
      : undefined;
    const onlineDm = user
      ? dmListPeerOnline(user, c, groups)
      : false;
    const dmAv = !isGroup ? chatRowDmAvatarUrl(c) : null;
    if (dmAv) {
      return (
        <div className="relative">
          <img
            src={dmAv}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            width={40}
            height={40}
          />
          {onlineDm ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ background: ONLINE }}
            />
          ) : null}
        </div>
      );
    }
    if (!isGroup) {
      return (
        <div className="relative">
          <InitialsAvatar name={rowLabel} size={40} />
          {onlineDm ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ background: ONLINE }}
            />
          ) : null}
        </div>
      );
    }
    return (
      <div className="relative">
        <InitialsAvatar name={rowLabel} size={40} />
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/10"
          style={{ background: BG, color: TEXT_MUTED }}
          aria-hidden
        >
          <Users className="h-2 w-2" strokeWidth={2.5} />
        </span>
      </div>
    );
  };

  const rowInner = (c: ChatInfo) => {
    const pref = chatPrefs[c.id];
    const unread = getUnreadCount(c, pref);
    const t = c.last_message_time ?? c.created_at ?? Date.now();
    let preview: string;
    if (c.displayPreview != null) {
      preview = c.displayPreview;
    } else {
      const raw = (c.last_message ?? "").trim();
      preview = raw
        ? `${c.type === "group" && c.last_message_sender ? `${c.last_message_sender}: ` : ""}${c.last_message ?? ""}`
        : "No messages yet — say hello!";
    }
    const timeStr =
      c.displayTime ?? formatListTimestamp(t);

    const isSyntheticGroupRow =
      c.type === "group" &&
      c.group_id &&
      !mainChatList.some((m) => m.id === c.id);
    const onRowActivate = () => {
      if (isSyntheticGroupRow && c.group_id) {
        onNavigateToGroup(c.group_id);
        return;
      }
      onSelectChat(c);
    };

    return (
      <ChatListRow72
        active={activeChatId === c.id}
        onClick={onRowActivate}
        avatar={renderAvatar(c)}
        name={chatRowDisplayName(c)}
        preview={preview}
        time={timeStr}
        unread={unread}
        muted={pref?.muted}
      />
    );
  };

  const wrapSwipe = (c: ChatInfo, inner: ReactNode) => {
    if (c.isBot || c.isAnnouncement) {
      return <li key={c.id}>{inner}</li>;
    }
    return (
      <li key={c.id}>
        <SwipeChatRow
          leftActions={[
            {
              label: "Read",
              bg: "#475569",
              onClick: () =>
                updateChatPref(c.id, { lastReadAt: Date.now() }),
            },
            {
              label: "Pin",
              bg: "#0369A1",
              onClick: () =>
                updateChatPref(c.id, {
                  pinned: !chatPrefs[c.id]?.pinned,
                }),
            },
          ]}
          rightActions={[
            {
              label: "Mute",
              bg: "#7F1D1D",
              onClick: () =>
                updateChatPref(c.id, {
                  muted: !chatPrefs[c.id]?.muted,
                }),
            },
            {
              label: "Archive",
              bg: "#44403C",
              onClick: () => updateChatPref(c.id, { archived: true }),
            },
            {
              label: "Delete",
              bg: "#DC2626",
              onClick: () => {
                markChatDeleted(c.id);
                showToast("Chat removed from this device", "success");
              },
            },
          ]}
        >
          <div
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) startLongPress(c, touch.clientX, touch.clientY);
            }}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              openContext(c, e.clientX, e.clientY);
            }}
          >
            {inner}
          </div>
        </SwipeChatRow>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ul className="m-0 min-h-0 flex-1 list-none custom-scrollbar overflow-y-auto pb-24 p-0">
        {mergedFlat.map((c) =>
          wrapSwipe(
            c,
            <div key={c.id} className="block w-full">
              {rowInner(c)}
            </div>,
          ),
        )}
        {mergedFlat.length === 0 ? (
          <li
            className="list-none px-4 py-8 text-center text-sm"
            style={{ color: LIST_TEXT_MUTED }}
          >
            No other conversations yet — use search to find people and groups
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function HubGroupsTab({
  searchQuery,
  onSearchChange,
  groups,
  user,
  groupsOnlyList,
  activeChatId,
  chatPrefs,
  onSelectChat,
  reloadGroups,
  onGroupCreated,
  onUnauthorized,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
  masterAbortRef,
  listHidden,
  openCreateRequestId,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  groups: GroupOut[];
  user: UserMe | null;
  groupsOnlyList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  reloadGroups: () => Promise<GroupOut[] | null>;
  onGroupCreated: (group: GroupOut) => void;
  onUnauthorized: () => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  masterAbortRef: MutableRefObject<AbortController | null>;
  listHidden?: boolean;
  openCreateRequestId?: number;
}) {
  const MODAL_CREATE_BG = "#1a1f35";
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [participantQuery, setParticipantQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResultRow[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<
    SelectedGroupParticipant[]
  >([]);
  const [groupKind, setGroupKind] = useState<"regular" | "travel">("regular");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const createSearchSeq = useRef(0);

  const resetCreateGroupModal = useCallback(() => {
    setCreateStep(1);
    setParticipantQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSelectedMembers([]);
    setGroupKind("regular");
    setNewGroupName("");
    setNewGroupDesc("");
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    if (openCreateRequestId == null || openCreateRequestId < 1) return;
    resetCreateGroupModal();
    setCreateOpen(true);
  }, [openCreateRequestId, resetCreateGroupModal]);

  useEffect(() => {
    if (!createOpen || createStep !== 1) return;
    const q = participantQuery.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++createSearchSeq.current;
      void (async () => {
        setSearchLoading(true);
        try {
          const res = await apiFetchWithStatus<UserSearchResultRow[]>(
            `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { signal: masterAbortRef.current?.signal },
          );
          if (createSearchSeq.current !== seq) return;
          if (res.status === 401) {
            onUnauthorized();
            return;
          }
          const rows = Array.isArray(res.data) ? res.data : [];
          setSearchResults(
            user
              ? rows.filter(
                  (r) => String(r.id) !== String(user.id),
                )
              : rows,
          );
        } catch {
          if (createSearchSeq.current === seq) setSearchResults([]);
        } finally {
          if (createSearchSeq.current === seq) setSearchLoading(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    participantQuery,
    createOpen,
    createStep,
    user,
    onUnauthorized,
    masterAbortRef,
  ]);

  const requestCloseCreateModal = useCallback(() => {
    if (creating) return;
    if (selectedMembers.length > 0) {
      if (!window.confirm("Discard group?")) return;
    }
    setCreateOpen(false);
    resetCreateGroupModal();
  }, [creating, selectedMembers.length, resetCreateGroupModal]);

  const selectedIdSet = useMemo(
    () => new Set(selectedMembers.map((m) => m.id)),
    [selectedMembers],
  );

  const addEmailByInvite = useCallback(() => {
    const t = participantQuery.trim();
    if (!isValidEmailFormat(t) || selectedIdSet.has(t)) return;
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.isEmailInvite && m.email === t)) return prev;
      const row: SelectedGroupParticipant = {
        id: t,
        full_name: t,
        email: t,
        username: null,
        profile_picture: null,
        avatar_url: null,
        friend_status: "none",
        isEmailInvite: true,
      };
      return [...prev, row];
    });
    setParticipantQuery("");
  }, [participantQuery, selectedIdSet]);

  const addParticipant = (row: UserSearchResultRow) => {
    if (selectedIdSet.has(row.id)) return;
    setSelectedMembers((prev) => [...prev, row as SelectedGroupParticipant]);
  };

  const removeParticipant = (id: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCreateGroup = useCallback(async () => {
    console.log("handleCreateGroup called", {
      newGroupName,
      selectedGroupType: groupKind,
      selectedMembers,
    });

    if (!newGroupName.trim()) {
      alert("Please enter a group name");
      return;
    }

    setCreating(true);

    const fetchSignal = masterAbortRef.current?.signal;
    try {
      const token = localStorage.getItem("gt_token");

      const createRes = await fetchWithTimeout(
        "http://localhost:8000/api/v1/groups",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newGroupName.trim(),
            description: newGroupDesc.trim() || undefined,
            group_type: groupKind,
          }),
          signal: fetchSignal,
        },
      );

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error("Create group failed:", createRes.status, err);
        alert(`Failed to create group: ${createRes.status}`);
        setCreating(false);
        return;
      }

      const newGroup = (await createRes.json()) as GroupOut;
      console.log("Group created:", newGroup);

      const realMembers = selectedMembers.filter((m) => !m.isEmailInvite);
      const authHeaders: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      let invitesSent = 0;
      for (const member of realMembers) {
        try {
          const inv = await fetchWithTimeout(
            `http://localhost:8000/api/v1/invitations/group/${newGroup.id}/invite`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ user_id: member.id }),
              signal: fetchSignal,
            },
          );
          if (inv.ok) invitesSent += 1;
        } catch (e) {
          if (isAbortError(e)) {
            return;
          }
          /* skip */
        }
      }

      setCreateOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setSelectedMembers([]);
      setGroupKind("regular");
      setCreateStep(1);
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      const list = await reloadGroups();
      const enriched =
        list?.find((g) => g.id === newGroup.id) ?? newGroup;
      onGroupCreated(enriched);

      if (realMembers.length === 0) {
        alert("Group created! Share the invite code to add members.");
      } else {
        alert(
          invitesSent === 1
            ? "Group created! Invitations sent to 1 member."
            : `Group created! Invitations sent to ${invitesSent} members.`,
        );
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error("Create group error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [
    newGroupName,
    newGroupDesc,
    groupKind,
    selectedMembers,
    reloadGroups,
    onGroupCreated,
    masterAbortRef,
  ]);

  const participantTrim = participantQuery.trim();
  const showAddByEmailRow =
    !searchLoading &&
    searchResults.length === 0 &&
    participantTrim.length > 0 &&
    isValidEmailFormat(participantTrim) &&
    !selectedIdSet.has(participantTrim);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? groupsOnlyList.filter((c) => c.name?.toLowerCase().includes(q))
    : groupsOnlyList;

  const openContext = (chat: ChatInfo, clientX: number, clientY: number) => {
    setContextMenu({ x: clientX, y: clientY, chat });
  };

  const startLongPress = (chat: ChatInfo, ex: number, ey: number) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContext(chat, ex, ey);
      longPressTimerRef.current = null;
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      {!listHidden ? (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HubSearchField value={searchQuery} onChange={onSearchChange} />
      <ul className="m-0 min-h-0 flex-1 list-none custom-scrollbar overflow-y-auto p-0 pb-14">
        {filtered.map((c) => {
          const gMeta = c.group_id
            ? groups.find((g) => g.id === c.group_id)
            : undefined;
          const online =
            user && gMeta
              ? memberOnlineRecently(gMeta.members ?? [], user.id)
              : false;
          const pref = chatPrefs[c.id];
          const unread = getUnreadCount(c, pref);
          const t = c.last_message_time ?? c.created_at ?? Date.now();
          const raw = (c.last_message ?? "").trim();
          const preview = raw
            ? `${c.last_message_sender ? `${c.last_message_sender}: ` : ""}${c.last_message ?? ""}`
            : "No messages yet — say hello!";
          const avatar = (
            <div className="relative">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white"
                style={{
                  background: gMeta
                    ? listAvatarColor(gMeta.name)
                    : listAvatarColor(c.name),
                }}
              >
                {initialsFromName(c.name)}
              </span>
              {online ? (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#0F172A]"
                  style={{ background: ONLINE }}
                />
              ) : null}
            </div>
          );
          const row = (
            <ChatListRow72
              active={activeChatId === c.id}
              onClick={() => onSelectChat(c)}
              avatar={avatar}
              name={c.name}
              preview={preview}
              time={formatListTimestamp(t)}
              unread={unread}
              muted={pref?.muted}
            />
          );
          return (
            <li key={c.id} className="list-none">
              <SwipeChatRow
                leftActions={[
                  {
                    label: "Read",
                    bg: "#475569",
                    onClick: () =>
                      updateChatPref(c.id, { lastReadAt: Date.now() }),
                  },
                  {
                    label: "Pin",
                    bg: "#0369A1",
                    onClick: () =>
                      updateChatPref(c.id, {
                        pinned: !chatPrefs[c.id]?.pinned,
                      }),
                  },
                ]}
                rightActions={[
                  {
                    label: "Mute",
                    bg: "#7F1D1D",
                    onClick: () =>
                      updateChatPref(c.id, {
                        muted: !chatPrefs[c.id]?.muted,
                      }),
                  },
                  {
                    label: "Archive",
                    bg: "#44403C",
                    onClick: () =>
                      updateChatPref(c.id, { archived: true }),
                  },
                  {
                    label: "Delete",
                    bg: "#DC2626",
                    onClick: () => {
                      markChatDeleted(c.id);
                      showToast("Chat removed from this device", "success");
                    },
                  },
                ]}
              >
                <div
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) startLongPress(c, touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContext(c, e.clientX, e.clientY);
                  }}
                >
                  {row}
                </div>
              </SwipeChatRow>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p
          className="px-4 py-8 text-center text-sm"
          style={{ color: TEXT_MUTED }}
        >
          No group chats yet
        </p>
      ) : null}
    </div>
      ) : null}
      {createOpen ? (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: "rgba(0,0,0,0.65)" }}
          role="presentation"
          onClick={() => {
            if (!creating) requestCloseCreateModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-create-group-title"
            className="box-border w-full max-w-md overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
            style={{
              background: MODAL_CREATE_BG,
              borderColor: MSG_BORDER,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-600/50 px-4 py-3">
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex justify-center gap-2">
                  {([1, 2, 3] as const).map((i) => {
                    const done = createStep > i;
                    const active = createStep === i;
                    return (
                      <span
                        key={i}
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={
                          active
                            ? { background: ACCENT }
                            : done
                              ? {
                                  border: `2px solid ${ACCENT}`,
                                  background: "transparent",
                                }
                              : { background: "#475569" }
                        }
                      />
                    );
                  })}
                </div>
                <p
                  className="mt-1.5 text-center text-[11px]"
                  style={{ color: TEXT_MUTED }}
                >
                  {createStep === 1
                    ? "Step 1 of 3 — Add Participants"
                    : createStep === 2
                      ? "Step 2 of 3 — Group Type"
                      : "Step 3 of 3 — Group Details"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={creating}
                onClick={() => requestCloseCreateModal()}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden px-4 pb-4 pt-1">
              <h2
                id="hub-create-group-title"
                className="text-center text-lg font-semibold text-white"
              >
                {createStep === 1
                  ? "Add Participants"
                  : createStep === 2
                    ? "What kind of group is this?"
                    : "Name your group"}
              </h2>

              <div className="relative mt-2 min-h-[min(50vh,320px)] sm:min-h-[300px]">
                {createStep === 1 ? (
                  <div className="box-border w-full min-w-0 px-0.5 pr-2">
                    {selectedMembers.length > 0 ? (
                      <div className="mb-3 max-h-24 flex-wrap gap-1.5 custom-scrollbar overflow-y-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMembers.map((m) => (
                            <div
                              key={m.id}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-1 pr-0.5"
                              style={{
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.05)",
                              }}
                            >
                              {m.isEmailInvite ? (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                                  style={{ background: EMAIL_INVITE_AVATAR_BG }}
                                  aria-hidden
                                >
                                  <ThIconMail size={12} className="text-white" />
                                </span>
                              ) : (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                  style={{
                                    background: listAvatarColor(m.full_name),
                                  }}
                                >
                                  {initialsFromName(m.full_name)}
                                </span>
                              )}
                              <span className="max-w-[120px] truncate text-xs text-slate-200">
                                {m.full_name}
                              </span>
                              <button
                                type="button"
                                aria-label={`Remove ${m.full_name}`}
                                onClick={() => removeParticipant(m.id)}
                                className="rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <input
                      value={participantQuery}
                      onChange={(e) => setParticipantQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full rounded-xl border px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <div
                      className="mt-2 min-h-[180px] custom-scrollbar overflow-y-auto rounded-xl border p-0.5"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    >
                      {participantQuery.trim().length < 1 ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          Type to find people
                        </p>
                      ) : searchLoading ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          Searching…
                        </p>
                      ) : !showAddByEmailRow && searchResults.length === 0 ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          No results
                        </p>
                      ) : (
                        <ul className="m-0 list-none p-0">
                          {searchResults.map((row) => {
                            const selected = selectedIdSet.has(row.id);
                            return (
                              <li key={row.id} className="list-none">
                                <button
                                  type="button"
                                  disabled={selected}
                                  onClick={() => addParticipant(row)}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/5 disabled:cursor-default"
                                >
                                  <span
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                                    style={{
                                      background: listAvatarColor(
                                        row.full_name,
                                      ),
                                    }}
                                  >
                                    {initialsFromName(row.full_name)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[15px] text-white">
                                      {row.full_name}
                                    </div>
                                    <div
                                      className="truncate text-xs"
                                      style={{ color: TEXT_MUTED }}
                                    >
                                      {formatUserSearchMeta(row)}
                                    </div>
                                  </div>
                                  {selected ? (
                                    <span
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                      style={{
                                        background: "rgba(34,197,94,0.2)",
                                        color: "#4ADE80",
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                          {showAddByEmailRow ? (
                            <li
                              key="__add_by_email"
                              className="list-none p-0.5"
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addEmailByInvite();
                                }}
                                onClick={addEmailByInvite}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2 py-2.5 text-left transition hover:opacity-95"
                                style={{
                                  borderColor: "#475569",
                                  background: ADD_BY_EMAIL_ROW_BG,
                                }}
                              >
                                <span
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                                  style={{ background: EMAIL_INVITE_AVATAR_BG }}
                                  aria-hidden
                                >
                                  <ThIconMail size={18} className="text-white" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-[15px] leading-snug text-white"
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    No account found — invite {participantTrim}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addEmailByInvite();
                                  }}
                                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                  style={{ background: ACCENT }}
                                >
                                  Add
                                </button>
                              </div>
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </div>
                    <p
                      className="mt-3 text-center text-sm"
                      style={{ color: TEXT_MUTED }}
                    >
                      {selectedMembers.length === 0
                        ? "No participants selected yet"
                        : selectedMembers.length === 1
                          ? "1 participant selected"
                          : `${selectedMembers.length} participants selected`}
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        disabled={selectedMembers.length === 0}
                        onClick={() => setCreateStep(2)}
                        className="h-11 w-full rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: ACCENT }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          Next
                          <ThIconChevronRight size={18} className="text-white" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        className="text-xs font-medium"
                        style={{ color: TEXT_MUTED }}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ) : null}
                {createStep === 2 ? (
                  <div className="box-border w-full min-w-0 px-0.5 pr-2">
                    <div className="mt-1 flex min-h-[280px] flex-col gap-3 sm:flex-row sm:min-h-[240px]">
                      <button
                        type="button"
                        onClick={() => setGroupKind("regular")}
                        className="flex min-h-[120px] flex-1 flex-col rounded-2xl border-2 p-3 text-left transition"
                        style={
                          groupKind === "regular"
                            ? {
                                borderColor: ACCENT,
                                background: "rgba(220, 38, 38, 0.12)",
                              }
                            : {
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.04)",
                              }
                        }
                      >
                        <MessageCircle className="h-7 w-7 text-white" strokeWidth={1.5} aria-hidden />
                        <span className="mt-1 text-[15px] font-semibold text-white">
                          Regular Group
                        </span>
                        <span
                          className="mt-1 text-xs leading-snug"
                          style={{ color: TEXT_MUTED }}
                        >
                          Ongoing chat group, like WhatsApp. No expiry.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupKind("travel")}
                        className="flex min-h-[120px] flex-1 flex-col rounded-2xl border-2 p-3 text-left transition"
                        style={
                          groupKind === "travel"
                            ? {
                                borderColor: ACCENT,
                                background: "rgba(220, 38, 38, 0.12)",
                              }
                            : {
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.04)",
                              }
                        }
                      >
                        <ThIconPlane size={28} className="text-white" aria-hidden />
                        <span className="mt-1 text-[15px] font-semibold text-white">
                          Travel Group
                        </span>
                        <span
                          className="mt-1 text-xs leading-snug"
                          style={{ color: TEXT_MUTED }}
                        >
                          Linked to a trip. Tracks expenses and balances.
                        </span>
                      </button>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateStep(3)}
                        className="h-11 w-full rounded-xl text-sm font-semibold text-white"
                        style={{ background: ACCENT }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          Next
                          <ThIconChevronRight size={18} className="text-white" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateStep(1)}
                        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-slate-300"
                        style={{ background: "transparent" }}
                      >
                        <ThIconChevronLeft size={18} className="text-slate-300" />
                        Back
                      </button>
                    </div>
                  </div>
                ) : null}
                {createStep === 3 ? (
                  <div className="box-border w-full min-w-0 pl-1">
                    <label className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Group name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder='e.g. "Goa Gang", "Family Crew", "Thailand 2026"'
                      maxLength={120}
                      className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Description (optional)
                    </label>
                    <textarea
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="What's this group for?"
                      maxLength={500}
                      rows={3}
                      className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Group photo (optional)
                    </p>
                    <div className="mt-1 flex flex-col items-center">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f || !f.type.startsWith("image/")) return;
                          setPhotoPreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(f);
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
                        style={{
                          borderColor: MSG_BORDER,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {photoPreviewUrl ? (
                          <img
                            src={photoPreviewUrl}
                            alt="Group photo preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-400" />
                        )}
                      </button>
                      <span
                        className="mt-1 text-center text-xs"
                        style={{ color: TEXT_MUTED }}
                      >
                        Add group photo
                      </span>
                    </div>

                    <div
                      className="mt-3 rounded-xl border px-2.5 py-2"
                      style={{ borderColor: MSG_BORDER, background: BG }}
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {selectedMembers.slice(0, 5).map((m) =>
                            m.isEmailInvite ? (
                            <span
                              key={m.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                              title={m.full_name}
                              style={{ background: EMAIL_INVITE_AVATAR_BG }}
                              aria-hidden
                            >
                              <ThIconMail size={12} className="text-white" />
                            </span>
                          ) : (
                            <span
                              key={m.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              title={m.full_name}
                              style={{ background: listAvatarColor(m.full_name) }}
                            >
                              {initialsFromName(m.full_name)}
                            </span>
                          ),
                        )}
                        {selectedMembers.length > 5 ? (
                          <span
                            className="text-xs font-medium"
                            style={{ color: TEXT_MUTED }}
                          >
                            +{selectedMembers.length - 5} more
                          </span>
                        ) : null}
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: "rgba(220, 38, 38, 0.2)",
                            color: "#FCA5A5",
                          }}
                        >
                          {groupKind === "travel" ? (
                            <span className="inline-flex items-center gap-0.5">
                              <ThIconPlane size={12} className="text-[#FCA5A5]" />
                              Travel
                            </span>
                          ) : (
                            "Regular"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        disabled={creating}
                        className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-slate-300"
                        style={{ background: "transparent" }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          <ThIconChevronLeft size={18} className="text-slate-300" />
                          Back
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={creating}
                        onClick={() => {
                          void handleCreateGroup();
                        }}
                        className="h-10 min-w-0 flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: ACCENT }}
                      >
                        {creating ? "Creating..." : "Create Group"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HubContactsTab({
  contacts,
  onMessage,
  onOpenDemo,
  currentUser,
}: {
  contacts: ContactRow[];
  onMessage: (p: ContactPerson) => void;
  onOpenDemo: (row: DemoContactRow | { kind: "self"; id: string; name: string; initials: string; bg: string; sub: string }) => void;
  currentUser: UserMe | null;
}) {
  return (
    <ul className="m-0 list-none p-0">
      <li className="list-none px-2">
        <DemoContactsSection
          variant="full"
          currentUserName={formatDisplayNameHub(currentUser?.full_name)}
          currentUserInitials={initialsFromName(currentUser?.full_name || "You")}
          currentUserBg={listAvatarColor(currentUser?.full_name || currentUser?.id || "me")}
          onOpenDemo={onOpenDemo}
        />
      </li>
      {contacts.length > 0 ? (
        <li
          className="list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: SECTION_LABEL, background: BG }}
        >
          From your groups
        </li>
      ) : null}
      {contacts.map((c) => (
        <li
          key={c.id}
          className="list-none border-b"
          style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
        >
          <div className="flex h-[72px] items-center gap-3 px-4">
            {c.avatar_url &&
            c.avatar_url.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(c.avatar_url) &&
            !isLegacyDicebearUrl(c.avatar_url) ? (
              <img
                src={c.avatar_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                width={40}
                height={40}
              />
            ) : (
              <InitialsAvatar name={c.full_name} size={40} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-white">
                {c.full_name}
              </p>
              <p
                className="truncate text-[12px]"
                style={{ color: TEXT_MUTED }}
              >
                in {c.groupsTogether} group
                {c.groupsTogether === 1 ? "" : "s"} together
              </p>
            </div>
            <button
              type="button"
              onClick={() => onMessage(c)}
              className="h-7 shrink-0 rounded-full px-3 text-[11px]"
              style={{
                border: `0.5px solid ${MSG_BORDER}`,
                color: TEXT_MUTED,
                background: "transparent",
              }}
            >
              Message
            </button>
          </div>
        </li>
      ))}
      {contacts.length === 0 ? (
        <li
          className="list-none px-4 py-8 text-center text-sm"
          style={{ color: TEXT_MUTED }}
        >
          No contacts from your groups yet.
        </li>
      ) : null}
    </ul>
  );
}

function CallsSvgPhone20({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CallsSvgVideo20({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CallsSvgVideo32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CallsSvgLink32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CallsSvgKeypad32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="3" width="4" height="4" rx="1" />
      <rect x="10" y="3" width="4" height="4" rx="1" />
      <rect x="17" y="3" width="4" height="4" rx="1" />
      <rect x="3" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="17" y="10" width="4" height="4" rx="1" />
      <rect x="3" y="17" width="4" height="4" rx="1" />
      <rect x="10" y="17" width="4" height="4" rx="1" />
      <rect x="17" y="17" width="4" height="4" rx="1" />
    </svg>
  );
}

function CallsSvgCalendar32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CallsSvgLock14() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="inline-block shrink-0 align-middle"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CallsConnectRightPanel({
  showCallToast,
  activeChat,
  user,
  onStartVideoCall,
  mainChatList,
  groups,
  startOutgoingCall,
}: {
  showCallToast: (message: string) => void;
  activeChat: ChatInfo | null;
  user: UserMe | null;
  onStartVideoCall: () => void;
  mainChatList: ChatInfo[];
  groups: GroupOut[];
  startOutgoingCall: (type: "audio" | "video", peer: { id: string; name: string; avatar: string | null }) => void;
}) {
  const cream = "#f5ede4";
  const copyLink = "https://travello.app/call/join";
  
  // Modal states
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantModalMode, setParticipantModalMode] = useState<"start" | "link" | "schedule">("start");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCallData[]>([]);
  const [preCallMessage, setPreCallMessage] = useState("");
  const [selectedCallParticipants, setSelectedCallParticipants] = useState<string[]>([]);

  // Load scheduled calls from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gt_scheduled_calls_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Filter out past calls
        const now = Date.now();
        const filtered = parsed.filter((s: ScheduledCallData) => new Date(s.scheduledAt).getTime() > now - 3600000);
        setScheduledCalls(filtered);
      }
    } catch {
      setScheduledCalls([]);
    }
  }, []);

  // Build selectable contacts list
  const selectableContacts = useMemo(() => {
    const contacts: SelectableContact[] = [];
    
    // Add individual chats (DMs)
    mainChatList
      .filter((c) => c.type === "individual" && !c.isBot && !c.isDemo && !c.isAnnouncement)
      .forEach((c) => {
        const peerId = c.members.find((m) => m !== user?.id);
        if (peerId) {
          contacts.push({
            id: peerId,
            name: chatRowDisplayName(c),
            avatar: chatRowDmAvatarUrl(c),
            type: "individual",
            subtitle: "Direct message",
            isOnline: false, // Will be populated from presence data if available
          });
        }
      });
    
    // Add groups
    groups.forEach((g) => {
      contacts.push({
        id: `group_${g.id}`,
        name: g.name,
        type: "group",
        subtitle: `${g.members?.length || 0} members`,
        members: g.members?.map((m: GroupMemberOut) => m.user_id),
      });
    });
    
    return contacts;
  }, [mainChatList, groups, user?.id]);

  const handleStartCallClick = () => {
    setParticipantModalMode("start");
    setParticipantModalOpen(true);
  };

  const handleNewLinkClick = () => {
    setParticipantModalMode("link");
    setParticipantModalOpen(true);
  };

  const handleScheduleClick = () => {
    setScheduleModalOpen(true);
  };

  const handleParticipantConfirm = (selectedIds: string[], message?: string) => {
    setSelectedCallParticipants(selectedIds);
    setPreCallMessage(message || "");
    setParticipantModalOpen(false);

    if (participantModalMode === "start") {
      // For video call, start with first selected participant
      const firstId = selectedIds[0];
      if (firstId) {
        const contact = selectableContacts.find((c) => c.id === firstId);
        if (contact) {
          startOutgoingCall("video", {
            id: contact.id,
            name: contact.name,
            avatar: contact.avatar || null,
          });
          
          // If there's a pre-call message, show a toast about it
          if (message) {
            showCallToast("Call started with message preview");
          }
        }
      }
    } else if (participantModalMode === "link") {
      // Copy link and notify about sending to selected participants
      navigator.clipboard.writeText(copyLink).then(() => {
        showCallToast(`Link copied! Will notify ${selectedIds.length} participant(s)`);
        
        // Here you would typically send the link + message via chat API
        if (message) {
          console.log("Sending call link with message to:", selectedIds, "Message:", message);
        }
      });
    }
  };

  const handleScheduleCall = (data: Omit<ScheduledCallData, "id" | "createdAt">) => {
    const newCall: ScheduledCallData = {
      ...data,
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...scheduledCalls, newCall];
    setScheduledCalls(updated);
    localStorage.setItem("gt_scheduled_calls_v1", JSON.stringify(updated));
    
    showCallToast(`Call scheduled for ${new Date(data.scheduledAt).toLocaleString()}`);
    
    // Here you would:
    // 1. Send notifications to all participants
    // 2. Pin the scheduled call in chat histories
    // 3. Set up reminder notifications
    console.log("Scheduled call:", newCall);
  };

  // Check for upcoming calls and show reminders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      scheduledCalls.forEach((call) => {
        const callTime = new Date(call.scheduledAt).getTime();
        
        // Check if any reminder should trigger
        call.reminders.forEach((reminderMinutes) => {
          const reminderTime = callTime - reminderMinutes * 60000;
          const windowStart = reminderTime - 30000; // 30 sec window
          const windowEnd = reminderTime + 30000;
          
          if (now >= windowStart && now <= windowEnd) {
            showCallToast(`📞 "${call.title}" starts ${reminderMinutes === 0 ? "now" : `in ${reminderMinutes} min`}!`);
          }
        });
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [scheduledCalls, showCallToast]);

  return (
    <>
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ background: cream }}
      >
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-4"
          style={{ background: cream }}
        >
          {/* Clean 3-button layout - plain and simple, no phone dialer */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Start call - pill style */}
              <button
                type="button"
                onClick={handleStartCallClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgVideo32 />
                Start call
              </button>

              {/* New call link - pill style */}
              <button
                type="button"
                onClick={handleNewLinkClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgLink32 />
                New call link
              </button>

              {/* Schedule call - pill style */}
              <button
                type="button"
                onClick={handleScheduleClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgCalendar32 />
                Schedule call
              </button>
            </div>

            {/* Show upcoming scheduled calls */}
            {scheduledCalls.length > 0 && (
              <div className="mt-4 w-full max-w-sm rounded-lg border p-3" style={{ borderColor: "#d1c4b0", background: "#fff" }}>
                <p className="mb-2 text-xs font-medium" style={{ color: "#6b7280" }}>
                  Upcoming calls
                </p>
                {scheduledCalls.slice(0, 3).map((call) => (
                  <div key={call.id} className="mb-2 flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "#8b5cf620" }}>
                      <CallsSvgCalendarSmall />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium" style={{ color: "#1e2a3a" }}>{call.title}</p>
                      <p className="text-xs" style={{ color: "#8896a0" }}>
                        {new Date(call.scheduledAt).toLocaleString(undefined, { 
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs" style={{ color: "#8896a0" }}>
              Quick actions for your meetings
            </p>
          </div>
        </div>
        <p
          className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-4 pb-6 text-center text-[12px] leading-snug"
          style={{ color: "#8896a0" }}
        >
          <CallsSvgLock14 />
          <span>Your calls are end-to-end encrypted</span>
        </p>
      </div>

      {/* Participant Selector Modal */}
      <CallParticipantSelector
        isOpen={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        contacts={selectableContacts}
        mode={participantModalMode}
        onConfirm={handleParticipantConfirm}
        currentUserId={user?.id || ""}
      />

      {/* Advanced Scheduled Call Modal */}
      <AdvancedScheduledCallModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        contacts={selectableContacts}
        onSchedule={handleScheduleCall}
        currentUserId={user?.id || ""}
      />
    </>
  );
}

// Helper component for scheduled call list
function CallsSvgCalendarSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function HubCallsTab({
  showCallToast,
  mainChatList,
  callHistory,
  onOpenHistoryRow,
  onStartAudioCall,
  onStartVideoCall,
  handleUnauthorized,
  masterAbortRef,
}: {
  showCallToast: (message: string) => void;
  mainChatList: ChatInfo[];
  callHistory: GtCallHistoryEntry[];
  onOpenHistoryRow: (e: GtCallHistoryEntry) => void;
  onStartAudioCall: (
    userId: string,
    name: string,
    avatar: string | null,
  ) => void;
  onStartVideoCall: (
    userId: string,
    name: string,
    avatar: string | null,
  ) => void;
  handleUnauthorized: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
}) {
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<UserSearchResultRow[]>([]);
  const [friendsLoadDone, setFriendsLoadDone] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const r = await apiFetchWithStatus<UserSearchResultRow[]>(
          "/social/friends",
          { signal: ac.signal },
        );
        if (r.status === 401) {
          handleUnauthorized();
          return;
        }
        if (r.status === 200 && Array.isArray(r.data)) {
          setFriends(r.data);
        } else {
          setFriends([]);
        }
      } catch {
        setFriends([]);
      } finally {
        setFriendsLoadDone(true);
      }
    })();
    return () => ac.abort();
  }, [handleUnauthorized]);

  const historySorted = useMemo(
    () => [...callHistory].sort((a, b) => b.timestamp - a.timestamp),
    [callHistory],
  );
  const qLower = q.trim().toLowerCase();
  const friendsTop3 = useMemo(() => friends.slice(0, 3), [friends]);
  const favoriteRows = useMemo(() => {
    if (!qLower) return friendsTop3;
    return friendsTop3.filter((f) =>
      (f.full_name || "").toLowerCase().includes(qLower),
    );
  }, [friendsTop3, qLower]);
  const historyRows = useMemo(() => {
    if (!qLower) return historySorted;
    return historySorted.filter((h) =>
      h.user_name.toLowerCase().includes(qLower),
    );
  }, [historySorted, qLower]);

  const nameCol = LIST_TEXT;
  const muted = LIST_TEXT_MUTED;
  const iconCol = BRAND_ACCENT;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3"
        style={{ background: "#ffffff", borderColor: LIST_BORDER }}
      >
        <span
          className="text-[16px] font-bold"
          style={{ color: LIST_TEXT }}
        >
          Calls
        </span>
        <button
          type="button"
          aria-label="New call"
          className="flex h-9 w-9 items-center justify-center"
          style={{ color: iconCol }}
          onClick={() => showCallToast("Calls coming soon")}
        >
          <CallsSvgPhone20 />
        </button>
      </div>
      <HubSearchField
        value={q}
        onChange={setQ}
        placeholder="Search calls..."
        tone="light"
      />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {friendsLoadDone && favoriteRows.length > 0 ? (
          <div>
            <p
              className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase"
              style={{ color: muted }}
            >
              Favorites
            </p>
            <ul className="m-0 list-none p-0">
              {favoriteRows.map((f) => {
                const url =
                  f.profile_picture?.trim() && !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) && !isLegacyDicebearUrl(f.profile_picture)
                    ? f.profile_picture
                    : f.avatar_url?.trim() && !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) && !isLegacyDicebearUrl(f.avatar_url)
                      ? f.avatar_url
                      : null;
                return (
                  <li
                    key={f.id}
                    className="border-b"
                  style={{ borderColor: LIST_BORDER }}
                  >
                    <div
                      className="flex items-center gap-3 px-4"
                      style={{ minHeight: 72 }}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                          width={46}
                          height={46}
                        />
                      ) : (
                        <InitialsAvatar
                          name={f.full_name || "?"}
                          size={46}
                        />
                      )}
                      <span
                        className="min-w-0 flex-1 truncate text-sm font-bold"
                        style={{ color: nameCol }}
                      >
                        {f.full_name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label="Video call"
                          className="flex h-9 w-9 items-center justify-center"
                          style={{ color: iconCol }}
                          onClick={() => {
                            const url =
                              f.profile_picture?.trim() &&
                              !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) &&
                              !isLegacyDicebearUrl(f.profile_picture)
                                ? f.profile_picture
                                : f.avatar_url?.trim() &&
                                    !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) &&
                                    !isLegacyDicebearUrl(f.avatar_url)
                                  ? f.avatar_url
                                  : null;
                            onStartVideoCall(f.id, f.full_name, url);
                          }}
                        >
                          <CallsSvgVideo20 />
                        </button>
                        <button
                          type="button"
                          aria-label="Voice call"
                          className="flex h-9 w-9 items-center justify-center"
                          style={{ color: iconCol }}
                          onClick={() => {
                            const url =
                              f.profile_picture?.trim() &&
                              !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) &&
                              !isLegacyDicebearUrl(f.profile_picture)
                                ? f.profile_picture
                                : f.avatar_url?.trim() &&
                                    !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) &&
                                    !isLegacyDicebearUrl(f.avatar_url)
                                  ? f.avatar_url
                                  : null;
                            onStartAudioCall(f.id, f.full_name, url);
                          }}
                        >
                          <CallsSvgPhone20 />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <p
          className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase"
          style={{ color: muted }}
        >
          Recent
        </p>
        {historySorted.length > 0 && historyRows.length === 0 && qLower ? (
          <p className="px-4 py-2 text-sm" style={{ color: muted }}>
            No matching calls
          </p>
        ) : null}
        {friendsLoadDone && historySorted.length === 0 && !qLower ? (
          <div className="flex flex-col items-center justify-center px-6 pb-8 pt-4 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center"
              style={{ color: iconCol }}
            >
              <svg
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <p className="mt-3 text-sm font-medium" style={{ color: nameCol }}>
              No recent calls
            </p>
            <p className="mt-1 text-sm" style={{ color: muted }}>
              Your call history will appear here
            </p>
          </div>
        ) : null}
        {historyRows.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {historyRows.map((e) => {
              const ch = mainChatList.find(
                (c) =>
                  c.type === "individual" &&
                  c.members.includes(e.user_id),
              );
              const photo =
                ch &&
                chatRowDmAvatarUrl(ch) &&
                !isInlineSvgDataUrlToSkipForPhoto(
                  chatRowDmAvatarUrl(ch) ?? "",
                ) &&
                !isLegacyDicebearUrl(chatRowDmAvatarUrl(ch) ?? "")
                  ? chatRowDmAvatarUrl(ch)
                  : null;
              return (
                <li
                  key={`${e.user_id}-${e.timestamp}`}
                  className="border-b"
                  style={{ borderColor: LIST_BORDER }}
                >
                  <div
                    className="flex h-[72px] items-center gap-3 px-4"
                    style={{ minHeight: 72 }}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => onOpenHistoryRow(e)}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                          width={46}
                          height={46}
                        />
                      ) : (
                        <InitialsAvatar name={e.user_name} size={46} />
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p
                          className="truncate text-sm font-bold"
                          style={{
                            color:
                              e.direction === "missed" ? "#e8956d" : nameCol,
                          }}
                        >
                          {e.user_name}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{ color: muted }}
                        >
                          {formatCallHistorySubline(e)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Call"
                      className="flex h-9 w-9 shrink-0 items-center justify-center"
                      style={{ color: iconCol }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onStartAudioCall(
                          e.user_id,
                          e.user_name,
                          photo,
                        );
                      }}
                    >
                      <CallsSvgPhone20 />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function HubUpdatesTab() {
  return <HubSpacePanel />;
}
export {
  CallsConnectRightPanel,
  HubSearchField,
  ChatListRow72,
  HubChatsTab,
  HubGroupsTab,
  HubContactsTab,
  HubCallsTab,
  HubUpdatesTab,
};
