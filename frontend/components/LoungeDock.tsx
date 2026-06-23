"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Send,
  Search,
  Plus,
  Paperclip,
  Mic,
  Smile,
  Sparkles,
  Cloud,
  Phone,
  Video,
  SquarePen,
  Menu,
  FileText,
  MapPin,
  BarChart,
  Reply,
  Info,
  Image as ImageIcon,
  DollarSign,
  Ban,
  CheckCheck,
  Star,
  Contact as ContactIcon,
  CalendarDays,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { initFirebase } from "@/lib/firebase-client";
import { ref, onValue, push, set, off, remove, get, update, type Database } from "firebase/database";
import {
  AdvancedScheduledCallModal,
  type ScheduledCallData,
} from "@/components/AdvancedScheduledCallModal";
import { ConnectSettingsPopup } from "@/components/lounge/ConnectSettingsPopup";
import { ConnectSettingsPanel } from "@/components/lounge/ConnectSettingsPanel";
import {
  readChatPrefs,
  updateChatPref as patchChatPrefLs,
  markChatDeleted as markChatDeletedLs,
  readDeletedChats,
  GT_SCHEDULED_CALLS,
  type ChatPrefs,
} from "@/lib/lounge/chat-prefs";
import { readJsonLs, writeJsonLs } from "@/lib/lounge/storage";
import WayraIcon from "@/components/ui/WayraIcon";
import { SplitExpenseModal } from "@/components/lounge/SplitExpenseModal";
import { CallOverlay } from "@/components/lounge/CallOverlay";
import { useLoungeCalls } from "@/components/lounge/useLoungeCalls";
import { type DemoChatView } from "@/components/lounge/DemoDmChatPanel";
import { LoungeChatWindow } from "@/components/lounge/LoungeChatWindow";
import { HubTabBar, type HubTabId } from "@/components/lounge/hub/HubTabBar";
import {
  HubCallsTab,
  HubChatsTab,
  HubGroupsTab,
  HubSearchField,
  HubUpdatesTab,
} from "@/components/lounge/hub/TravelHubTabs";
import { HubSearchResults } from "@/components/lounge/hub/HubSearchResults";
import { HubChatContextMenu } from "@/components/lounge/hub/HubChatContextMenu";
import { ConnectProfileDrawer } from "@/components/lounge/hub/ConnectProfileDrawer";
import { useHubConnectSearch } from "@/components/lounge/useHubConnectSearch";
import { DemoContactsSection } from "@/components/lounge/DemoContactsSection";
import {
  dockChatToChatInfo,
  dockGroupToGroupOut,
  dockUserToUserMe,
  type DockChat,
} from "@/lib/lounge/dock-adapters";
import { dmListPeerOnline, loungeChatDisplayName } from "@/lib/lounge/hub-utils";
import type {
  ChatInfo,
  ContactPerson,
  GroupMemberOut,
  GroupOut,
  UserMe,
} from "@/lib/lounge/hub-types";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { isDemoChatId } from "@/lib/lounge/demo-contacts";
import { readBuddyFavourites, toggleBuddyFavourite } from "@/lib/lounge/buddy-favourites";
import {
  LOUNGE_URL_CONNECT,
  LOUNGE_URL_CREATE_GROUP,
  OPEN_LOUNGE_EVENT,
  type OpenLoungeDetail,
} from "@/lib/open-lounge";
import type { UserSearchResultRow } from "@/lib/lounge/hub-types";
import {
  DEMO_CHAT_ROVVY_HELP_ID,
  DEMO_CHAT_COMMUNITY_ID,
  QUICK_REACTION_CHIPS,
  type GtCallHistoryEntry,
  type StarredMessage,
} from "@/lib/lounge/constants";
import {
  readCallHistoryLs,
  readStarredMessagesLs,
  writeStarredMessagesLs,
} from "@/lib/lounge/storage";

type Contact = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
};

type Member = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_admin: boolean;
};

type Chat = {
  id: string;
  type: string; // "direct" | "group" | "trip"
  name: string | null;
  trip_id: string | null;
  created_by: string | null;
  created_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  avatar_url: string | null;
  members: Member[];
};

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  text: string;
  timestamp: number;
  type?: string;
  wayra_visible?: boolean;
  location_details?: {
    place_name: string | null;
    city: string | null;
    country: string | null;
    latitude: number;
    longitude: number;
    thumbnail: string;
    confidence: string;
  };
  metadata?: any;
};

export function LoungeDock() {
  const pathname = usePathname();
  const isLiveMapPage = pathname === "/live";
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openChatIds, setOpenChatIds] = useState<string[]>([]);
  const [minimizedChatIds, setMinimizedChatIds] = useState<string[]>([]);
  const [openChatMetas, setOpenChatMetas] = useState<Record<string, ChatInfo>>({});
  const [focusedChatId, setFocusedChatId] = useState<string | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [demoChatViews, setDemoChatViews] = useState<Record<string, DemoChatView>>({});
  const [recordingChatId, setRecordingChatId] = useState<string | null>(null);
  const [splitChatId, setSplitChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    full_name: string;
    username?: string | null;
  } | null>(null);
  const [firebaseDb, setFirebaseDb] = useState<Database | null>(null);

  // Search & Navigation
  const [activeTab, setActiveTab] = useState<HubTabId>("chats");
  const [buddyFavourites, setBuddyFavourites] = useState<string[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createGroupRequestId, setCreateGroupRequestId] = useState(0);
  const [showNewChatOverlay, setShowNewChatOverlay] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [settingsScreen, setSettingsScreen] = useState<
    "menu" | "settings" | "starred" | "connect"
  >("menu");
  const [loungeIntent, setLoungeIntent] = useState<OpenLoungeDetail | null>(
    null,
  );

  // Attachments and Recording State
  const [showAttachMenu, setShowAttachMenu] = useState<Record<string, boolean>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const docInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Backup Settings
  const [backupInterval, setBackupInterval] = useState("24h");
  const [wifiOnly, setWifiOnly] = useState(true);

  // Wayra status tracking
  const [wayraStatus, setWayraStatus] = useState<Record<string, { enabled: boolean; off_since: string | null }>>({});

  // P1/P2 features
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [callHistory, setCallHistory] = useState<GtCallHistoryEntry[]>([]);
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    chat: ChatInfo;
  } | null>(null);
  const masterAbortRef = useRef<AbortController | null>(null);
  const [callToast, setCallToast] = useState<string | null>(null);
  const [chatPrefs, setChatPrefs] = useState<Record<string, ChatPrefs>>({});
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCallData[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dockToast, setDockToast] = useState<string | null>(null);

  // Firebase Ref
  const firebaseInstance = useRef<ReturnType<typeof initFirebase> | null>(null);
  const firebaseListeners = useRef<Record<string, () => void>>({});

  const loungeCalls = useLoungeCalls({
    db: firebaseDb,
    userId: currentUser?.id ?? null,
    userName: currentUser?.full_name ?? null,
    onToast: (msg) => {
      setCallToast(msg);
      setDockToast(msg);
    },
    onHistoryUpdate: (entries) => setCallHistory((prev) => [...entries, ...prev].slice(0, 200)),
  });

  // Fetch initial data
  useEffect(() => {
    // 1. Fetch current user
    apiFetch<{ id: string; full_name: string; username?: string | null }>(
      "/auth/me",
    )
      .then((user) => setCurrentUser(user))
      .catch(() => {});

    // 2. Fetch chats
    fetchChats();

    // 3. Fetch contacts
    apiFetch<Contact[]>("/lounge/contacts")
      .then((data) => setContacts(data))
      .catch(() => {});

    // 4. Bootstrap (groups + connections — same as full-page lounge)
    apiFetch<{
      groups?: { id: string; name: string; members?: { user_id: string; full_name: string }[] }[];
      connections?: Contact[];
    }>("/connect/bootstrap")
      .then((boot) => {
        if (boot.groups) {
          setGroups(boot.groups.map((g) => dockGroupToGroupOut(g)));
        }
        if (boot.connections?.length) {
          setContacts((prev) => {
            const map = new Map(prev.map((c) => [c.id, c]));
            for (const c of boot.connections!) {
              if (!map.has(c.id)) map.set(c.id, c);
            }
            return [...map.values()];
          });
        }
      })
      .catch(() => {});

    setCallHistory(readCallHistoryLs());
    setStarredMessages(readStarredMessagesLs());
    setChatPrefs(readChatPrefs());
    setDeletedChatIds(readDeletedChats());
    setScheduledCalls(readJsonLs<ScheduledCallData[]>(GT_SCHEDULED_CALLS, []));
    setBuddyFavourites(readBuddyFavourites());

    // Initialize Firebase Client
    const fb = initFirebase();
    firebaseInstance.current = fb;
    if (fb.ok && fb.db) setFirebaseDb(fb.db);

    // Toggle and open events
    const handleToggle = () => {
      setIsOpen((prev) => !prev);
    };
    const handleOpenLounge = (e: Event) => {
      setIsOpen(true);
      const detail = (e as CustomEvent<OpenLoungeDetail | undefined>).detail;
      if (detail && Object.keys(detail).length > 0) {
        setLoungeIntent(detail);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const urlConnect = params.get(LOUNGE_URL_CONNECT)?.trim();
    const urlCreateGroup = params.get(LOUNGE_URL_CREATE_GROUP);
    if (urlConnect || urlCreateGroup) {
      params.delete(LOUNGE_URL_CONNECT);
      params.delete(LOUNGE_URL_CREATE_GROUP);
      params.delete("u");
      const qs = params.toString();
      const path = window.location.pathname;
      window.history.replaceState(null, "", qs ? `${path}?${qs}` : path);
      setIsOpen(true);
      setLoungeIntent({
        ...(urlConnect ? { connectUserId: urlConnect } : {}),
        ...(urlCreateGroup ? { createGroup: true } : {}),
      });
    }

    window.addEventListener("toggle-rovvy-lounge", handleToggle);
    window.addEventListener(OPEN_LOUNGE_EVENT, handleOpenLounge);

    return () => {
      window.removeEventListener("toggle-rovvy-lounge", handleToggle);
      window.removeEventListener(OPEN_LOUNGE_EVENT, handleOpenLounge);

      // Clean up firebase subscriptions
      Object.values(firebaseListeners.current).forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const fetchChats = async () => {
    try {
      const data = await apiFetch<Chat[]>("/lounge/chats");
      setChats(data);
    } catch {}
  };

  // Subscribe to Firebase user_chats to keep chats list in real-time sync with main page
  useEffect(() => {
    const fb = firebaseInstance.current;
    if (!fb || !fb.ok || !fb.db || !currentUser) return;
    const db = fb.db;

    const userChatsRef = ref(db, `user_chats/${currentUser.id}`);
    
    // Store unsubscribers for info listeners
    const infoUnsubs: (() => void)[] = [];

    const unsubscribeUserChats = onValue(userChatsRef, (snapshot) => {
      const val = snapshot.val() as Record<string, boolean> | null;
      const chatIds = val ? Object.keys(val) : [];

      // Unsubscribe previous info listeners
      infoUnsubs.forEach((unsub) => unsub());
      infoUnsubs.length = 0;

      const mergedChats: Record<string, Chat> = {};

      if (chatIds.length === 0) {
        return;
      }

      chatIds.forEach((chatId) => {
        const infoRef = ref(db, `chats/${chatId}/info`);
        const unsubInfo = onValue(infoRef, (snapInfo) => {
          if (!snapInfo.exists()) return;
          const infoVal = snapInfo.val();

          // Map members
          const firebaseMembers = infoVal.members || [];
          const membersList: Member[] = (Array.isArray(firebaseMembers) ? firebaseMembers : Object.values(firebaseMembers)).map((uid: any) => {
            const userId = typeof uid === "string" ? uid : uid?.user_id || "";
            let fullName = "Unknown User";
            if (userId === currentUser.id) {
              fullName = currentUser.full_name;
            } else {
              const matchedContact = contacts.find((c) => c.id === userId);
              fullName = matchedContact ? matchedContact.full_name : (uid?.full_name || userId);
            }
            return {
              id: userId,
              user_id: userId,
              full_name: fullName,
              avatar_url: null,
              is_admin: false,
            };
          });

          // Determine name
          let chatName = infoVal.name || null;
          if (!chatName && infoVal.type === "individual") {
            const otherMember = membersList.find((m) => m.user_id !== currentUser.id);
            chatName = otherMember
              ? otherMember.full_name
              : currentUser.full_name || "You";
          }

          const chatObj: Chat = {
            id: chatId,
            type: infoVal.type === "individual" ? "direct" : infoVal.type,
            name: chatName,
            trip_id: infoVal.trip_id || null,
            created_by: infoVal.created_by || null,
            created_at: infoVal.created_at ? new Date(infoVal.created_at).toISOString() : new Date().toISOString(),
            last_message_preview: infoVal.last_message || null,
            last_message_at: infoVal.last_message_time ? new Date(infoVal.last_message_time).toISOString() : null,
            avatar_url: infoVal.avatar_url || null,
            members: membersList,
          };

          mergedChats[chatId] = chatObj;

          // Convert to array and sort by last message time
          const sortedList = Object.values(mergedChats).sort((a, b) => {
            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return timeB - timeA;
          });

          setChats(sortedList);
        });

        infoUnsubs.push(() => off(infoRef, "value", unsubInfo));
      });
    });

    return () => {
      off(userChatsRef, "value", unsubscribeUserChats);
      infoUnsubs.forEach((unsub) => unsub());
    };
  }, [currentUser, contacts, firebaseInstance.current]);

  const toggleWayra = async (chatId: string) => {
    const currentStatus = wayraStatus[chatId];
    if (!currentStatus) return;
    const newEnabled = !currentStatus.enabled;
    try {
      const res = await apiFetch<{ status: string; enabled: boolean }>(`/wayra/group/${chatId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.status === "success") {
        setWayraStatus((prev) => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            enabled: res.enabled,
            off_since: res.enabled ? null : new Date().toISOString(),
          },
        }));
      }
    } catch {
      showToast("Only group administrators can toggle Wayra AI settings.");
    }
  };

  const isSpecialChat = (chatId: string) =>
    chatId === DEMO_CHAT_ROVVY_HELP_ID ||
    chatId === DEMO_CHAT_COMMUNITY_ID ||
    isDemoChatId(chatId);

  const openDemoChat = (
    row: DemoChatView | {
      kind: "self";
      id: string;
      name: string;
      initials: string;
      bg: string;
      sub: string;
    },
  ) => {
    const view: DemoChatView = {
      id: row.id,
      name: row.name,
      kind: row.kind === "self" ? "self" : row.kind,
      initials: row.initials,
      bg: row.bg,
    };
    setDemoChatViews((prev) => ({ ...prev, [row.id]: view }));
    void openChatWindow(row.id);
    setShowNewChatOverlay(false);
    setShowSettingsOverlay(false);
    setActiveTab("chats");
    setIsOpen(true);
  };

  const showToast = (msg: string) => {
    setDockToast(msg);
    globalThis.setTimeout(() => setDockToast(null), 3000);
  };

  const showToastHub = (msg: string, _type?: "success" | "error") => {
    showToast(msg);
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("gt_token");
    window.location.href = "/login";
  }, []);

  const updateChatPref = useCallback((chatId: string, patch: Partial<ChatPrefs>) => {
    const next = patchChatPrefLs(chatId, patch);
    setChatPrefs(next);
  }, []);

  const closeChatWindow = useCallback((chatId: string) => {
    setOpenChatIds((prev) => prev.filter((id) => id !== chatId));
    setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));
    setOpenChatMetas((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setFocusedChatId((cur) => (cur === chatId ? null : cur));
    setDemoChatViews((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    if (recordingChatId === chatId) {
      setRecordingChatId(null);
      setIsRecording(false);
    }
    if (firebaseListeners.current[chatId]) {
      firebaseListeners.current[chatId]();
      delete firebaseListeners.current[chatId];
    }
  }, [recordingChatId]);

  const markChatDeleted = useCallback(
    (chatId: string) => {
      const deleted = markChatDeletedLs(chatId);
      setDeletedChatIds(deleted);
      closeChatWindow(chatId);
    },
    [closeChatWindow],
  );

  const reloadGroups = useCallback(async (): Promise<GroupOut[] | null> => {
    try {
      const boot = await apiFetch<{
        groups?: { id: string; name: string; members?: { user_id: string; full_name: string }[] }[];
      }>("/connect/bootstrap");
      if (boot.groups) {
        const mapped = boot.groups.map((g) => dockGroupToGroupOut(g));
        setGroups(mapped);
        return mapped;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const hubUser = useMemo(
    () => dockUserToUserMe(currentUser),
    [currentUser],
  );

  const mainChatList = useMemo(() => {
    let list = chats
      .filter(
        (c) =>
          !deletedChatIds.includes(c.id) && !chatPrefs[c.id]?.archived,
      )
      .map((c) => dockChatToChatInfo(c as DockChat, currentUser?.id));

    return list;
  }, [chats, deletedChatIds, chatPrefs, currentUser]);

  const groupsOnlyList = useMemo(
    () => mainChatList.filter((c) => c.type === "group"),
    [mainChatList],
  );

  const pullRefresh = usePullToRefresh(async () => {
    await fetchChats();
    showToast("Chats refreshed");
  });

  const initGroupChat = useCallback(
    async (
      database: Database,
      group: GroupOut,
      members: GroupMemberOut[],
      current: UserMe,
    ) => {
      const chatId = `group_${group.id}`;
      const chatRef = ref(database, `chats/${chatId}/info`);
      try {
        const snapshot = await get(chatRef);
        const memberIds = members.map((m) => m.user_id);
        if (!snapshot.exists()) {
          await set(chatRef, {
            id: chatId,
            name: group.name,
            type: "group",
            group_id: group.id,
            members: memberIds,
            created_by: current.id,
            created_at: Date.now(),
            last_message: "",
            last_message_time: Date.now(),
            last_message_sender: "",
          });
          for (const uid of memberIds) {
            await set(ref(database, `user_chats/${uid}/${chatId}`), true);
          }
        } else {
          await update(chatRef, { members: memberIds });
        }
      } catch (e) {
        console.warn("initGroupChat", e);
      }
    },
    [],
  );

  const resolveHubChatInfo = useCallback(
    (chatId: string): ChatInfo | null => {
      if (!chatId) return null;
      if (chatId === DEMO_CHAT_ROVVY_HELP_ID) {
        return {
          id: DEMO_CHAT_ROVVY_HELP_ID,
          name: "Rovvy Help",
          type: "individual",
          members: [],
          created_by: "system",
          created_at: Date.now(),
          isBot: true,
        };
      }
      if (chatId === DEMO_CHAT_COMMUNITY_ID) {
        return {
          id: DEMO_CHAT_COMMUNITY_ID,
          name: "Community Updates",
          type: "individual",
          members: [],
          created_by: "system",
          created_at: Date.now(),
          isAnnouncement: true,
        };
      }

      const cached = openChatMetas[chatId];
      if (cached) return cached;

      const fromMain = mainChatList.find((c) => c.id === chatId);
      if (fromMain) {
        if (fromMain.type === "group" && fromMain.group_id) {
          const g = groups.find((x) => x.id === fromMain.group_id);
          if (
            g?.name &&
            (!fromMain.name?.trim() || fromMain.name === "Direct Chat")
          ) {
            return { ...fromMain, name: g.name };
          }
        }
        return fromMain;
      }

      if (chatId.startsWith("group_")) {
        const gid = chatId.slice("group_".length);
        const g = groups.find((x) => x.id === gid);
        if (g && currentUser) {
          const ids = (g.members ?? []).map((m) => m.user_id);
          return {
            id: chatId,
            name: g.name,
            type: "group",
            group_id: g.id,
            members: ids.length > 0 ? ids : [currentUser.id],
            created_by: currentUser.id,
            created_at: Date.now(),
          };
        }
      }

      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return null;
      const info = dockChatToChatInfo(chat as DockChat, currentUser?.id);
      if (info.type === "group" && info.group_id) {
        const g = groups.find((x) => x.id === info.group_id);
        if (
          g?.name &&
          (!info.name?.trim() ||
            info.name === "Direct Chat" ||
            info.name === "Group")
        ) {
          return { ...info, name: g.name };
        }
      }
      return info;
    },
    [mainChatList, groups, chats, currentUser, openChatMetas],
  );

  const openChatWindow = async (chatId: string, chatMeta?: ChatInfo) => {
    setContextMenu(null);

    if (isDemoChatId(chatId) && !demoChatViews[chatId]) {
      return;
    }

    if (chatMeta) {
      setOpenChatMetas((prev) => ({ ...prev, [chatId]: chatMeta }));
    }
    setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));

    if (isSpecialChat(chatId)) {
      updateChatPref(chatId, { lastReadAt: Date.now() });
      setOpenChatIds((prev) =>
        prev.includes(chatId)
          ? [...prev.filter((id) => id !== chatId), chatId]
          : [...prev, chatId],
      );
      setFocusedChatId(chatId);
      setIsOpen(true);
      setShowNewChatOverlay(false);
      setShowSettingsOverlay(false);
      setSearchQuery("");
      return;
    }

    const chat = chats.find((c) => c.id === chatId);
    const resolved =
      chatMeta ?? resolveHubChatInfo(chatId);
    const isGroupLike =
      resolved?.type === "group" ||
      chatId.startsWith("group_") ||
      Boolean(
        chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id),
      );

    if (isGroupLike) {
      if (chatId.startsWith("group_") && hubUser) {
        const gid = chatId.slice("group_".length);
        const g = groups.find((x) => x.id === gid);
        const fb = firebaseInstance.current;
        if (g && fb?.ok && fb.db) {
          void initGroupChat(fb.db, g, g.members ?? [], hubUser);
        }
      }
      apiFetch<{ enabled: boolean; off_since: string | null }>(
        `/wayra/group/${chatId}/status`,
      )
        .then((status) => {
          setWayraStatus((prev) => ({ ...prev, [chatId]: status }));
        })
        .catch(() => {});
    }

    // Load restore messages (from Google Drive via backend endpoint)
    try {
      const restoreRes = await apiFetch<{ messages: Message[] }>(`/lounge/drive/restore/${chatId}`);
      if (restoreRes && restoreRes.messages) {
        setMessages((prev) => ({
          ...prev,
          [chatId]: restoreRes.messages,
        }));
      }
    } catch {}

    // Subscribe to real-time Firebase messages
    subscribeToFirebase(chatId);

    updateChatPref(chatId, { lastReadAt: Date.now() });
    setOpenChatIds((prev) =>
      prev.includes(chatId)
        ? [...prev.filter((id) => id !== chatId), chatId]
        : [...prev, chatId],
    );
    setFocusedChatId(chatId);
    setIsOpen(true);
    setShowNewChatOverlay(false);
    setShowSettingsOverlay(false);
  };

  const onSelectHubChat = useCallback(
    (c: ChatInfo) => {
      if (c.isBot || c.id === DEMO_CHAT_ROVVY_HELP_ID) {
        void openChatWindow(DEMO_CHAT_ROVVY_HELP_ID);
        updateChatPref(DEMO_CHAT_ROVVY_HELP_ID, { lastReadAt: Date.now() });
        return;
      }
      if (c.isAnnouncement || c.id === DEMO_CHAT_COMMUNITY_ID) {
        void openChatWindow(DEMO_CHAT_COMMUNITY_ID);
        updateChatPref(DEMO_CHAT_COMMUNITY_ID, { lastReadAt: Date.now() });
        return;
      }
      void openChatWindow(c.id, c);
    },
    [updateChatPref],
  );

  const closeSearchOverlay = useCallback(() => {
    setSearchQuery("");
  }, []);

  const searchActive =
    searchQuery.trim().length > 0 &&
    !showSettingsOverlay &&
    !showNewChatOverlay;

  const openDirectChatFromPerson = useCallback(
    async (p: ContactPerson) => {
      try {
        const chat = await apiFetch<Chat>("/lounge/chats/direct", {
          method: "POST",
          body: JSON.stringify({ user_id: p.id }),
        });
        await fetchChats();
        void openChatWindow(chat.id);
        setActiveTab("chats");
        closeSearchOverlay();
      } catch {
        showToastHub("Could not start chat", "error");
      }
    },
    [closeSearchOverlay, showToastHub],
  );

  const activeHubChat = useMemo(
    (): ChatInfo | null =>
      focusedChatId ? resolveHubChatInfo(focusedChatId) : null,
    [focusedChatId, resolveHubChatInfo],
  );

  const hubSearch = useHubConnectSearch({
    open: searchQuery.trim().length >= 2,
    searchQuery,
    groups,
    mainChatList,
    userId: currentUser?.id,
    db: firebaseDb,
    masterAbortRef,
    handleUnauthorized,
    showToast: showToastHub,
    onOpenDirectChat: openDirectChatFromPerson,
    onOpenGroupChat: onSelectHubChat,
    onCloseOverlay: closeSearchOverlay,
    reloadGroups,
  });

  useEffect(() => {
    if (!currentUser?.id || !loungeIntent) return;

    const intent = loungeIntent;
    setLoungeIntent(null);

    if (intent.createGroup) {
      setCreateGroupRequestId((n) => n + 1);
    }

    if (intent.openProfile) {
      hubSearch.setSearchProfileFor(intent.openProfile);
    }

    if (intent.connectUserId) {
      void (async () => {
        try {
          const d = await apiFetch<{
            id: string;
            full_name: string;
            username: string | null;
            profile_picture?: string | null;
            avatar_url?: string | null;
          }>(`/users/${intent.connectUserId}`);
          hubSearch.setSearchProfileFor({
            id: String(d.id),
            full_name: d.full_name,
            username: d.username,
            profile_picture: d.profile_picture ?? null,
            avatar_url: d.avatar_url ?? null,
            friend_status: "none",
          });
        } catch {
          /* profile may be unavailable */
        }
      })();
    }

    if (intent.openDmUserId) {
      void openDirectChatFromPerson({
        id: intent.openDmUserId,
        full_name: "Chat",
        username: null,
        avatar_url: null,
      });
    }
  }, [
    currentUser?.id,
    loungeIntent,
    hubSearch.setSearchProfileFor,
    openDirectChatFromPerson,
  ]);

  const subscribeToFirebase = (chatId: string) => {
    const fb = firebaseInstance.current;
    if (!fb || !fb.ok || !fb.db) return;

    // Remove existing listener if any
    if (firebaseListeners.current[chatId]) {
      firebaseListeners.current[chatId]();
    }

    const messagesRef = ref(fb.db, `chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Message[] = Object.values(data);
        list.sort((a, b) => a.timestamp - b.timestamp);

        setMessages((prev) => {
          const current = prev[chatId] || [];
          // Merge lists by checking duplicate IDs
          const existingIds = new Set(current.map((m) => m.id));
          const newMsgs = list.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [chatId]: [...current, ...newMsgs],
          };
        });
      }
    });

    firebaseListeners.current[chatId] = () => off(messagesRef, "value", unsubscribe);
  };

  const handleSend = async (
    chatId: string,
    replyToMsg?: Message | null,
  ) => {
    let text = inputTexts[chatId]?.trim();
    if (!text || !currentUser) return;

    if (replyToMsg) {
      text = `↩ ${replyToMsg.sender_name}: ${replyToMsg.text.slice(0, 60)}${replyToMsg.text.length > 60 ? "…" : ""}\n${text}`;
    }

    // Clear input first
    setInputTexts((prev) => ({ ...prev, [chatId]: "" }));

    const messageId = uuidv4();
    const timestamp = Date.now();
    
    const isWayraEnabled = wayraStatus[chatId]?.enabled !== false;
    const chat = chats.find((c) => c.id === chatId);
    const isGroup = chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id);

    const newMsg: Message = {
      id: messageId,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      text,
      timestamp,
      wayra_visible: isGroup ? isWayraEnabled : true,
    };

    // 1. Deliver instantly via Firebase RTDB
    const fb = firebaseInstance.current;
    if (fb && fb.ok && fb.db) {
      try {
        const msgRef = ref(fb.db, `chats/${chatId}/messages/${messageId}`);
        await set(msgRef, newMsg);
      } catch {}
    }

    // Update state locally
    setMessages((prev) => {
      const current = prev[chatId] || [];
      if (current.some((m) => m.id === messageId)) return prev;
      return {
        ...prev,
        [chatId]: [...current, newMsg],
      };
    });

    // 2. Perform background sync to backend drive cache
    try {
      const allMsgs = [...(messages[chatId] || []), newMsg];
      await apiFetch("/lounge/drive/sync", {
        method: "POST",
        body: JSON.stringify({
          chat_id: chatId,
          messages: allMsgs,
        }),
      });
    } catch {}

    // 3. Mentions & URL detection
    if (isGroup && chat) {
      const hasMention = text.toLowerCase().includes("@wayra");
      if (hasMention) {
        apiFetch<{ response: string | null }>(`/wayra/group/${chat.trip_id || chat.id}/mention`, {
          method: "POST",
          body: JSON.stringify({ message: text, chat_id: chatId }),
        }).catch(() => {});
      }

      // Detect URL
      apiFetch<{ is_travel_url: boolean; url: string }>("/wayra/group/detect-url", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      }).then(async (res) => {
        if (res.is_travel_url && fb && fb.ok && fb.db) {
          const extRes = await apiFetch<any>("/wayra/group/extract-location", {
            method: "POST",
            body: JSON.stringify({ url: res.url }),
          });
          if (extRes && extRes.place_name) {
            const previewMsgId = uuidv4();
            const previewText = `📍 Location detected: ${extRes.place_name} (${extRes.city || ""}, ${extRes.country || ""})`;
            const previewMsg: Message = {
              id: previewMsgId,
              sender_id: "wayra_ai",
              sender_name: "Wayra AI",
              text: previewText,
              timestamp: Date.now(),
              type: "location_preview",
              wayra_visible: true,
              location_details: extRes,
            };
            const msgRef = ref(fb.db, `chats/${chatId}/messages/${previewMsgId}`);
            await set(msgRef, previewMsg);
          }
        }
      }).catch(() => {});
    }
  };

  const sendAttachmentMessage = async (chatId: string, type: string, text: string, metadata?: any) => {
    if (!currentUser) return;
    const messageId = uuidv4();
    const timestamp = Date.now();
    
    const isWayraEnabled = wayraStatus[chatId]?.enabled !== false;
    const chat = chats.find((c) => c.id === chatId);
    const isGroup = chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id);

    const newMsg: Message = {
      id: messageId,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      text,
      timestamp,
      type,
      wayra_visible: isGroup ? isWayraEnabled : true,
      metadata,
    };

    // 1. Deliver instantly via Firebase RTDB
    const fb = firebaseInstance.current;
    if (fb && fb.ok && fb.db) {
      try {
        const msgRef = ref(fb.db, `chats/${chatId}/messages/${messageId}`);
        await set(msgRef, newMsg);
      } catch {}
    }

    // Update state locally
    setMessages((prev) => {
      const current = prev[chatId] || [];
      if (current.some((m) => m.id === messageId)) return prev;
      return {
        ...prev,
        [chatId]: [...current, newMsg],
      };
    });

    // 2. Perform background sync to backend drive cache
    try {
      const allMsgs = [...(messages[chatId] || []), newMsg];
      await apiFetch("/lounge/drive/sync", {
        method: "POST",
        body: JSON.stringify({
          chat_id: chatId,
          messages: allMsgs,
        }),
      });
    } catch {}
  };

  const startVoiceRecording = async (chatId: string) => {
    try {
      setRecordingChatId(chatId);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          void sendAttachmentMessage(chatId, "audio", "", {
            url: base64Data,
            duration: recordingDuration,
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      showToast("Could not access microphone. Check browser permissions.");
    }
  };

  const stopVoiceRecording = (cancel: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingChatId(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (cancel) {
        // Discard
        mediaRecorderRef.current.onstop = null;
      }
      mediaRecorderRef.current.stop();
    }
  };

  // Create Direct Chat
  const startDirectChat = async (targetUserId: string) => {
    try {
      const chat = await apiFetch<Chat>("/lounge/chats/direct", {
        method: "POST",
        body: JSON.stringify({ user_id: targetUserId }),
      });
      await fetchChats();
      void openChatWindow(chat.id);
      setActiveTab("chats");
    } catch {}
  };

  // Update Settings
  const updateSettings = async (interval: string, wifi: boolean) => {
    setBackupInterval(interval);
    setWifiOnly(wifi);
    try {
      await apiFetch("/lounge/settings/backup", {
        method: "PATCH",
        body: JSON.stringify({ interval, wifi_only: wifi }),
      });
    } catch {}
  };

  // Helper function to generate client UUID
  const uuidv4 = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const toggleChatPref = (chatId: string, key: "pinned" | "muted" | "archived") => {
    const cur = chatPrefs[chatId]?.[key] ?? false;
    updateChatPref(chatId, { [key]: !cur });
    setContextMenu(null);
    const labels: Record<string, [string, string]> = {
      pinned: ["Chat pinned", "Chat unpinned"],
      muted: ["Chat muted", "Chat unmuted"],
      archived: ["Chat archived", "Chat unarchived"],
    };
    showToast(!cur ? labels[key][0] : labels[key][1]);
  };

  const toggleBuddyFav = (contactId: string) => {
    const next = toggleBuddyFavourite(contactId);
    setBuddyFavourites(next);
    showToast(next.includes(contactId) ? "Added to favourites" : "Removed from favourites");
  };

  const deleteChatFromList = (chatId: string) => {
    markChatDeleted(chatId);
    setContextMenu(null);
    showToast("Chat removed from list");
  };

  const blockChatUser = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    const peer = chat?.members?.find((m) => m.user_id !== currentUser?.id);
    if (!peer) return;
    try {
      await apiFetch("/social/block", {
        method: "POST",
        body: JSON.stringify({ user_id: peer.user_id }),
      });
      showToast(`${peer.full_name} blocked`);
      deleteChatFromList(chatId);
    } catch {
      showToast("Could not block user");
    }
  };

  const handleScheduleCall = (data: Omit<ScheduledCallData, "id" | "createdAt">) => {
    const entry: ScheduledCallData = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...scheduledCalls];
    setScheduledCalls(next);
    writeJsonLs(GT_SCHEDULED_CALLS, next);
    setShowScheduleModal(false);
    showToast("Call scheduled");
  };

  const handleFileSelect = async (
    chatId: string,
    file: File,
    type: "image" | "video" | "document",
  ) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      void sendAttachmentMessage(chatId, type, file.name, {
        url: base64,
        name: file.name,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    setShowAttachMenu((prev) => ({ ...prev, [chatId]: false }));
  };

  const handleShareLocation = (chatId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      void sendAttachmentMessage(chatId, "location", "Shared location", {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
    setShowAttachMenu((prev) => ({ ...prev, [chatId]: false }));
  };

  const handleSplitSubmit = (amount: number, splitEqually: boolean) => {
    if (!splitChatId) return;
    const sym = "₹";
    const t = splitEqually
      ? `Split ${sym}${amount.toFixed(2)} equally`
      : `Split ${sym}${amount.toFixed(2)}`;
    void sendAttachmentMessage(splitChatId, "split", t, {
      amount,
      currency: "INR",
      split_equally: splitEqually,
    });
    setSplitChatId(null);
  };

  const starMessage = (chatId: string, msg: Message) => {
    const entry: StarredMessage = {
      chatId,
      messageId: msg.id,
      text: msg.text,
      senderName: msg.sender_name,
      timestamp: msg.timestamp,
    };
    const next = [entry, ...starredMessages.filter((s) => s.messageId !== msg.id)].slice(0, 100);
    setStarredMessages(next);
    writeStarredMessagesLs(next);
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    return c.full_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const dockSettingsOpen =
    showSettingsOverlay && settingsScreen === "settings";
  const showDockWidget = true;

  return (
    <div
      className={`fixed bottom-0 right-2 sm:right-[40px] pointer-events-none select-none max-md:inset-x-0 max-md:top-0 max-md:bottom-auto max-md:right-0 max-md:left-0 ${
        isLiveMapPage ? "z-[160]" : "z-[80]"
      }`}
    >
      <div className="flex flex-row-reverse items-end gap-3 max-md:flex-col max-md:items-stretch">
      {/* MAIN DOCK WIDGET — hidden on Live map until opened from the rail */}
      {showDockWidget ? (
      <div
        className={`bg-slate-900 text-white shadow-2xl rounded-t-xl flex flex-col border border-slate-700/50 pointer-events-auto select-text overflow-hidden transition-all duration-300 ease-in-out max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:rounded-none max-md:rounded-b-2xl max-md:border-x-0 max-md:border-t-0 max-md:transition-transform max-md:duration-300 max-md:ease-out ${
          isOpen
            ? `w-[340px] md:w-[360px] max-md:translate-y-0 ${
                dockSettingsOpen
                  ? "h-[min(90vh,720px)]"
                  : "h-[480px] md:h-[500px] max-md:h-[min(88vh,640px)]"
              }`
            : "w-[290px] h-11 max-md:-translate-y-[calc(100%-2.75rem)]"
        }`}
      >
        {!isOpen ? (
          <div
            className="h-11 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between cursor-pointer border-b border-slate-800/80 hover:bg-slate-800 w-full max-md:border-b-0"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Rovvy Lounge
              </span>
            </div>
            <ChevronUp size={16} className="max-md:hidden" />
            <ChevronDown size={16} className="hidden max-md:block" />
          </div>
        ) : (
          <div className="h-14 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800/80">
            <div className="min-w-0">
              <p className="text-[14px] font-bold tracking-tight text-white leading-tight">
                Rovvy Lounge
              </p>
              <p className="text-[10px] font-medium text-white/60 leading-none mt-0.5">
                Messages, calls, and updates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsOverlay((prev) => {
                    const next = !prev;
                    if (next) setSettingsScreen("menu");
                    return next;
                  });
                  setShowNewChatOverlay(false);
                }}
                className={`p-1.5 rounded transition-colors ${
                  showSettingsOverlay ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
                title="Lounge Connect"
              >
                <Menu size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewChatOverlay((prev) => !prev);
                  setShowSettingsOverlay(false);
                  setActiveTab("chats");
                }}
                className={`p-1.5 rounded transition-colors ${
                  showNewChatOverlay ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
                title="New Chat"
              >
                <SquarePen size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown size={16} className="max-md:hidden" />
                <ChevronUp size={16} className="hidden max-md:block" />
              </button>
            </div>
          </div>
        )}

        {isOpen && (
              <>
                {/* Search Bar - styled exactly like main Lounge search bar */}
                {!showSettingsOverlay && !showNewChatOverlay && (
                  <div className="shrink-0 border-b border-slate-800/60 bg-slate-950 px-3 py-2">
                    <HubSearchField
                      tone="dock"
                      placeholder="Search chats, people, and groups..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                    />
                  </div>
                )}

                {/* Tab Bar - below search bar */}
                {!showSettingsOverlay && !showNewChatOverlay ? (
                  <HubTabBar
                    variant="dock"
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={["chats", "calls", "updates"]}
                  />
                ) : null}

                {/* List Content */}
                <div
                  ref={pullRefresh.scrollRef}
                  className={`flex-1 bg-white ${
                    dockSettingsOpen
                      ? "flex min-h-0 flex-col overflow-hidden"
                      : "overflow-y-auto p-2 divide-y divide-stone-100"
                  }`}
                  style={{
                    transform: pullRefresh.pullDist ? `translateY(${pullRefresh.pullDist * 0.35}px)` : undefined,
                    transition: pullRefresh.pullDist ? "none" : "transform 0.2s ease-out",
                  }}
                  onTouchStart={(e) => {
                    if (activeTab === "chats" && !searchActive) {
                      pullRefresh.onTouchStart(e);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (activeTab === "chats" && !searchActive) {
                      pullRefresh.onTouchMove(e);
                    }
                  }}
                  onTouchEnd={() => {
                    if (activeTab === "chats" && !searchActive) {
                      pullRefresh.onTouchEnd();
                    }
                  }}
                >
                  {searchActive ? (
                    <HubSearchResults
                      tone="dock"
                      searchQuery={searchQuery}
                      loading={hubSearch.searchOverlayLoading}
                      overlayChats={hubSearch.overlayChats}
                      overlayContacts={hubSearch.overlayContacts}
                      overlayPeople={hubSearch.overlayPeople}
                      discoverGroupsList={hubSearch.discoverGroupsList}
                      groups={groups}
                      onOpenGroupChat={hubSearch.openGroupChatFromSearch}
                      onOpenDirectChat={openDirectChatFromPerson}
                      onViewProfile={hubSearch.setSearchProfileFor}
                      userSearchActionId={hubSearch.userSearchActionId}
                      onConnect={hubSearch.connectUserSearchRow}
                      onAccept={hubSearch.acceptUserSearchRow}
                      onMessageBuddy={hubSearch.messageUserSearchRow}
                      onBlock={hubSearch.blockUserSearch}
                      buddiesMenuOpenId={hubSearch.buddiesMenuOpenId}
                      onBuddiesMenuOpenIdChange={hubSearch.setBuddiesMenuOpenId}
                      onJoinDiscoverGroup={hubSearch.joinDiscoverGroup}
                      showToast={showToastHub}
                      onDismiss={closeSearchOverlay}
                    />
                  ) : null}
                  {!searchActive && pullRefresh.pullDist > 20 && activeTab === "chats" ? (
                    <div className="pointer-events-none py-1 text-center text-[10px] text-stone-500">
                      {pullRefresh.pullDist >= 60 ? "Release to refresh" : "Pull to refresh"}
                    </div>
                  ) : null}
                  {!searchActive && showSettingsOverlay && settingsScreen === "settings" ? (
                    <ConnectSettingsPanel
                      variant="dock"
                      user={
                        currentUser
                          ? {
                              id: currentUser.id,
                              full_name: currentUser.full_name,
                              username: currentUser.username,
                            }
                          : null
                      }
                      onClose={() => setSettingsScreen("menu")}
                      onExit={() => {
                        setSettingsScreen("menu");
                        setShowSettingsOverlay(false);
                      }}
                      showToast={showToast}
                      onLogout={() => {
                        localStorage.removeItem("gt_token");
                        window.location.href = "/login";
                      }}
                      onShareInvite={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}/join`,
                          );
                          showToast("Invite link copied");
                        } catch {
                          showToast("Could not copy link");
                        }
                      }}
                    />
                  ) : null}
                  {!searchActive && showSettingsOverlay && settingsScreen !== "settings" && (
                    <div className="p-3 text-slate-900 space-y-4">
                      {settingsScreen === "menu" ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                            <div>
                              <p className="text-xs font-bold text-[#0F766E]">Connect</p>
                              <p className="text-[10px] text-stone-500 font-medium">
                                {currentUser?.full_name?.trim() || "Travel Hub User"}
                              </p>
                            </div>
                            <button
                              onClick={() => setShowSettingsOverlay(false)}
                              className="text-stone-400 hover:text-stone-600 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <nav className="flex flex-col text-xs font-semibold space-y-1">
                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] transition-colors"
                              onClick={() => {
                                setShowSettingsOverlay(false);
                                setShowNewChatOverlay(true);
                              }}
                            >
                              New chat
                            </button>
                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] transition-colors"
                              onClick={() => {
                                setShowSettingsOverlay(false);
                                setCreateGroupRequestId((n) => n + 1);
                              }}
                            >
                              New group
                            </button>
                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] transition-colors"
                              onClick={() => {
                                setShowSettingsOverlay(false);
                                setActiveTab("chats");
                              }}
                            >
                              Contacts
                            </button>
                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] transition-colors"
                              onClick={() => setSettingsScreen("connect")}
                            >
                              Privacy &amp; blocked
                            </button>
                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] transition-colors flex items-center justify-between"
                              onClick={() => setSettingsScreen("starred")}
                            >
                              <span>Starred</span>
                              {starredMessages.length > 0 ? (
                                <span className="text-[9px] font-bold text-[#0F766E]">{starredMessages.length}</span>
                              ) : null}
                            </button>

                            <div className="h-px bg-stone-100 my-1" />

                            <button
                              type="button"
                              className="w-full text-left py-2 px-2.5 rounded-lg text-slate-700 hover:bg-teal-50 hover:text-[#0F766E] font-bold transition-colors"
                              onClick={() => setSettingsScreen("settings")}
                            >
                              Settings
                            </button>
                          </nav>
                        </div>
                      ) : settingsScreen === "connect" ? (
                        <ConnectSettingsPopup
                          onClose={() => setSettingsScreen("menu")}
                          onToast={showToast}
                        />
                      ) : settingsScreen === "starred" ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setSettingsScreen("menu")} className="p-0.5 text-stone-400">
                                <ChevronLeft size={16} className="text-[#0F766E]" />
                              </button>
                              <span className="text-xs font-bold text-[#0F766E]">Starred messages</span>
                            </div>
                            <button onClick={() => setShowSettingsOverlay(false)} className="text-stone-400 p-1">
                              <X size={14} />
                            </button>
                          </div>
                          {starredMessages.length === 0 ? (
                            <p className="py-6 text-center text-xs text-stone-500">No starred messages yet</p>
                          ) : (
                            starredMessages.map((s) => (
                              <div key={s.messageId} className="rounded-lg border border-stone-100 bg-stone-50 p-2">
                                <p className="text-[10px] font-bold text-[#0F766E]">{s.senderName}</p>
                                <p className="text-xs text-slate-800 mt-0.5 line-clamp-2">{s.text}</p>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSettingsScreen("menu")}
                                className="text-stone-400 hover:text-stone-600 p-0.5 rounded-full hover:bg-stone-50"
                                title="Back to Connect Menu"
                              >
                                <ChevronLeft size={16} className="text-[#0F766E]" />
                              </button>
                              <span className="text-xs font-bold text-[#0F766E]">Lounge Settings</span>
                            </div>
                            <button
                              onClick={() => setShowSettingsOverlay(false)}
                              className="text-stone-400 hover:text-stone-600 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wide text-[#0F766E] mb-2 flex items-center gap-1.5">
                              <Cloud size={14} />
                              <span>Google Drive Backup</span>
                            </h4>
                            <p className="text-[10px] text-stone-500 font-medium mb-3 leading-relaxed">
                              All messages are delivered in real-time and deleted from Rovvy servers. You can back up messages to your own Google Drive.
                            </p>

                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Backup Interval
                            </label>
                            <select
                              value={backupInterval}
                              onChange={(e) => updateSettings(e.target.value, wifiOnly)}
                              className="w-full text-xs border border-stone-250 p-2 rounded-lg outline-none focus:border-[#0F766E] text-slate-900 font-semibold mb-3 bg-white"
                            >
                              <option value="6h">Every 6 Hours</option>
                              <option value="12h">Every 12 Hours</option>
                              <option value="24h">Daily (24 Hours)</option>
                            </select>

                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-stone-600">
                                Back up on Wi-Fi Only
                              </span>
                              <input
                                type="checkbox"
                                checked={wifiOnly}
                                onChange={(e) => updateSettings(backupInterval, e.target.checked)}
                                className="h-4 w-4 text-[#0F766E] focus:ring-[#0F766E] border-stone-300 rounded"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!searchActive && !showSettingsOverlay && activeTab === "chats" && showNewChatOverlay && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-2 mb-2 bg-slate-50 rounded-lg">
                        <span className="text-xs font-bold text-[#0F766E]">Start New Chat</span>
                        <button
                          onClick={() => setShowNewChatOverlay(false)}
                          className="text-stone-400 hover:text-stone-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Create Group Button */}
                      <button
                        onClick={() => setCreateGroupRequestId((n) => n + 1)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs font-bold transition-all mb-2 border border-teal-100"
                      >
                        <Plus size={16} />
                        <span>Create Group Chat</span>
                      </button>

                      <div className="relative flex items-center mb-2">
                        <Search size={14} className="absolute left-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 text-xs text-slate-900 pl-8 pr-3 py-1.5 rounded-lg border border-stone-250 outline-none focus:border-[#0F766E] font-medium"
                        />
                      </div>

                      <DemoContactsSection
                        currentUserName={currentUser?.full_name}
                        currentUserInitials={currentUser?.full_name?.charAt(0) || "Y"}
                        onOpenDemo={openDemoChat}
                      />

                      {filteredContacts.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-xs font-semibold">
                          No contacts found
                        </div>
                      ) : (
                        filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => {
                              startDirectChat(contact.id);
                              setShowNewChatOverlay(false);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                {contact.full_name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {contact.full_name}
                                </p>
                                <p className="text-[9px] text-stone-500 font-medium">
                                  @{contact.username || "user"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBuddyFav(contact.id);
                              }}
                              className="p-1 text-stone-400 hover:text-amber-500"
                              aria-label="Favourite"
                            >
                              <Star
                                size={14}
                                className={buddyFavourites.includes(contact.id) ? "fill-amber-400 text-amber-400" : ""}
                              />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {!searchActive && !showSettingsOverlay && !showNewChatOverlay && activeTab === "chats" ? (
                    <HubChatsTab
                      groups={groups}
                      user={hubUser}
                      mainChatList={mainChatList}
                      activeChatId={focusedChatId ?? undefined}
                      chatPrefs={chatPrefs}
                      onSelectChat={onSelectHubChat}
                      onNavigateToGroup={(gid) => {
                        const existing = mainChatList.find(
                          (c) => c.type === "group" && c.group_id === gid,
                        );
                        if (existing) {
                          void openChatWindow(existing.id, existing);
                          return;
                        }
                        const g = groups.find((x) => x.id === gid);
                        if (!g || !currentUser) return;
                        const ids = (g.members ?? []).map((m) => m.user_id);
                        void openChatWindow(`group_${g.id}`, {
                          id: `group_${g.id}`,
                          name: g.name,
                          type: "group",
                          group_id: g.id,
                          members: ids.length > 0 ? ids : [currentUser.id],
                          created_by: currentUser.id,
                          created_at: Date.now(),
                        });
                      }}
                      updateChatPref={updateChatPref}
                      markChatDeleted={markChatDeleted}
                      showToast={showToastHub}
                      setContextMenu={setContextMenu}
                      longPressTimerRef={longPressTimerRef}
                    />
                  ) : null}

                  {!searchActive && !showSettingsOverlay && activeTab === "calls" ? (
                    <HubCallsTab
                      showCallToast={showToast}
                      mainChatList={mainChatList}
                      callHistory={callHistory}
                      onOpenHistoryRow={(e) => {
                        const c = mainChatList.find(
                          (x) =>
                            x.type === "individual" &&
                            x.members.includes(e.user_id),
                        );
                        if (c) {
                          setActiveTab("chats");
                          void openChatWindow(c.id);
                        }
                      }}
                      onStartAudioCall={(userId, name, avatar) =>
                        loungeCalls.startOutgoingCall("audio", {
                          id: userId,
                          name,
                          avatar,
                        })
                      }
                      onStartVideoCall={(userId, name, avatar) =>
                        loungeCalls.startOutgoingCall("video", {
                          id: userId,
                          name,
                          avatar,
                        })
                      }
                      handleUnauthorized={handleUnauthorized}
                      masterAbortRef={masterAbortRef}
                    />
                  ) : null}

                  {!searchActive && !showSettingsOverlay && activeTab === "updates" ? (
                    <HubUpdatesTab
                      currentUser={hubUser}
                      activeChatId={focusedChatId ?? undefined}
                      chatPrefs={chatPrefs}
                      onSelectChat={onSelectHubChat}
                    />
                  ) : null}
                </div>
              </>
        )}
      </div>
      ) : null}

      {openChatIds.map((chatId) => {
        const chatInfo = resolveHubChatInfo(chatId);
        const dockChat = chats.find((c) => c.id === chatId);
        const isGroup =
          chatInfo?.type === "group" ||
          Boolean(
            dockChat &&
              (dockChat.type === "group" ||
                dockChat.type === "trip" ||
                dockChat.trip_id),
          );
        const callLabel = loungeChatDisplayName(chatInfo, {
          selfId: currentUser?.id,
          selfName: currentUser?.full_name,
          groups,
        });
        const peerId = chatInfo?.members.find((m) => m !== currentUser?.id);
        const peerContact = peerId
          ? contacts.find((c) => c.id === peerId)
          : undefined;
        return (
          <LoungeChatWindow
            key={chatId}
            chatId={chatId}
            chatInfo={chatInfo}
            demoChatView={demoChatViews[chatId] ?? null}
            groups={groups}
            contacts={contacts.map((c) => ({
              id: c.id,
              full_name: c.full_name,
              username: c.username,
              avatar_url: c.avatar_url,
            }))}
            chatPrefs={chatPrefs}
            currentUser={currentUser}
            messages={messages[chatId] ?? []}
            inputText={inputTexts[chatId] ?? ""}
            onInputTextChange={(value) =>
              setInputTexts((prev) => ({ ...prev, [chatId]: value }))
            }
            onClose={() => closeChatWindow(chatId)}
            minimized={minimizedChatIds.includes(chatId)}
            onToggleMinimized={() => {
              setMinimizedChatIds((prev) =>
                prev.includes(chatId)
                  ? prev.filter((id) => id !== chatId)
                  : [...prev, chatId],
              );
              setFocusedChatId(chatId);
            }}
            onSend={(replyTo) => void handleSend(chatId, replyTo ?? null)}
            onSendAttachment={(type, text, metadata) =>
              void sendAttachmentMessage(chatId, type, text, metadata)
            }
            onFileSelect={(file, type) => void handleFileSelect(chatId, file, type)}
            onShareLocation={() => handleShareLocation(chatId)}
            onStarMessage={(msg) => starMessage(chatId, msg as Message)}
            onBlockUser={() => void blockChatUser(chatId)}
            onLeaveGroupSuccess={(gid) => {
              closeChatWindow(`group_${gid}`);
              closeChatWindow(chatId);
              void reloadGroups();
            }}
            onOpenSplit={() => {
              setSplitChatId(chatId);
              setShowSplitModal(true);
            }}
            onToggleWayra={() => toggleWayra(chatId)}
            onToast={showToast}
            onVoiceCall={() => {
              if (!peerId) {
                showToast("No one to call in this chat");
                return;
              }
              loungeCalls.startOutgoingCall("audio", {
                id: peerId,
                name: callLabel,
                avatar: peerContact?.avatar_url ?? null,
              });
            }}
            onVideoCall={() => {
              if (!peerId) {
                showToast("No one to call in this chat");
                return;
              }
              loungeCalls.startOutgoingCall("video", {
                id: peerId,
                name: callLabel,
                avatar: peerContact?.avatar_url ?? null,
              });
            }}
            onScheduleCall={() => {
              setFocusedChatId(chatId);
              setShowScheduleModal(true);
            }}
            onOpenDirectChat={openDirectChatFromPerson}
            onClearChat={() => {
              setMessages((prev) => ({ ...prev, [chatId]: [] }));
              showToast("Chat cleared");
            }}
            onToggleFavorite={() => {
              const cur = chatPrefs[chatId]?.favorite ?? false;
              updateChatPref(chatId, { favorite: !cur });
              showToast(cur ? "Removed from favorites" : "Added to favorites");
            }}
            onToggleMute={() => {
              const cur = chatPrefs[chatId]?.muted ?? false;
              updateChatPref(chatId, { muted: !cur });
              showToast(cur ? "Unmuted" : "Muted");
            }}
            reloadGroups={reloadGroups}
            handleUnauthorized={handleUnauthorized}
            masterAbortRef={masterAbortRef}
            scheduleVersion={scheduleVersion}
            onScheduleChanged={() => setScheduleVersion((v) => v + 1)}
            peerOnline={
              chatInfo && hubUser
                ? dmListPeerOnline(hubUser, chatInfo, groups)
                : null
            }
            wayraStatus={wayraStatus[chatId]}
            isGroup={isGroup}
            firebaseDb={firebaseDb}
            isRecording={recordingChatId === chatId && isRecording}
            recordingDuration={recordingDuration}
            onStartRecording={() => void startVoiceRecording(chatId)}
            onStopRecording={stopVoiceRecording}
            onTyping={() => setFocusedChatId(chatId)}
            longPressTimerRef={longPressTimerRef}
          />
        );
      })}
      </div>

      <CallOverlay
        callState={loungeCalls.callState}
        currentCall={loungeCalls.currentCall}
        callDurationSec={loungeCalls.callDurationSec}
        isMuted={loungeCalls.isMuted}
        isCameraOff={loungeCalls.isCameraOff}
        isSharingScreen={loungeCalls.isSharingScreen}
        localStream={loungeCalls.localStream}
        remoteStream={loungeCalls.remoteStream}
        audioOutputDevices={loungeCalls.audioOutputDevices}
        onAccept={() => void loungeCalls.acceptIncomingCall()}
        onDecline={() => void loungeCalls.declineIncomingCall()}
        onHangup={() => loungeCalls.hangupCall()}
        onToggleMute={loungeCalls.toggleMute}
        onToggleCamera={loungeCalls.toggleCamera}
        onShareScreen={() => void loungeCalls.shareScreen()}
        onListAudioOutputs={() => void loungeCalls.listAudioOutputs()}
        onSetAudioOutput={(id) => void loungeCalls.setAudioOutput(id)}
        onBindRemoteAudio={loungeCalls.bindRemoteAudioElement}
      />

      <SplitExpenseModal
        open={showSplitModal}
        currencySymbol="₹"
        onClose={() => {
          setShowSplitModal(false);
          setSplitChatId(null);
        }}
        onSubmit={handleSplitSubmit}
      />

      {(callToast || dockToast) ? (
        <div className="fixed bottom-24 right-4 z-[310] rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {dockToast || callToast}
          <button type="button" onClick={() => { setCallToast(null); setDockToast(null); }} className="ml-2 text-white/60">✕</button>
        </div>
      ) : null}

      <AdvancedScheduledCallModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.full_name,
          avatar: c.avatar_url,
          type: "individual" as const,
          subtitle: c.username ? `@${c.username}` : undefined,
        }))}
        currentUserId={currentUser?.id ?? ""}
        onSchedule={handleScheduleCall}
      />

      <ConnectProfileDrawer
        profile={hubSearch.searchProfileFor}
        onClose={() => hubSearch.setSearchProfileFor(null)}
        activeChat={activeHubChat}
        peerOnline={hubSearch.profilePanelPeerOnline}
        subTab={hubSearch.searchProfileSubTab}
        onSubTabChange={hubSearch.setSearchProfileSubTab}
        reportDialogOpen={hubSearch.profileReportDialogOpen}
        onReportDialogOpenChange={hubSearch.setProfileReportDialogOpen}
        userSearchActionId={hubSearch.userSearchActionId}
        onConnect={hubSearch.connectUserSearchRow}
        onAccept={hubSearch.acceptUserSearchRow}
        onBlock={hubSearch.blockUserSearch}
        onOpenInChatSearch={() => {
          if (focusedChatId) void openChatWindow(focusedChatId);
        }}
        onOpenSearchOverlay={() => {
          hubSearch.setSearchProfileFor(null);
          setActiveTab("chats");
        }}
        showToast={showToastHub}
      />

      <HubChatContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        tone="dock"
        chatPrefs={chatPrefs}
        updateChatPref={updateChatPref}
        onDeleteChat={markChatDeleted}
        showToast={showToastHub}
      />

      <HubGroupsTab
        listHidden
        openCreateRequestId={createGroupRequestId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        groups={groups}
        user={hubUser}
        groupsOnlyList={groupsOnlyList}
        activeChatId={focusedChatId ?? undefined}
        chatPrefs={chatPrefs}
        onSelectChat={onSelectHubChat}
        reloadGroups={reloadGroups}
        onGroupCreated={(group) => {
          setGroups((prev) => {
            const i = prev.findIndex((g) => g.id === group.id);
            if (i >= 0) {
              const next = [...prev];
              next[i] = group;
              return next;
            }
            return [group, ...prev];
          });
          setActiveTab("chats");
        }}
        onUnauthorized={handleUnauthorized}
        updateChatPref={updateChatPref}
        markChatDeleted={markChatDeleted}
        showToast={showToastHub}
        setContextMenu={setContextMenu}
        longPressTimerRef={longPressTimerRef}
        masterAbortRef={masterAbortRef}
      />
    </div>
  );
}
