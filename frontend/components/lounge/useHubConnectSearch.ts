"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { onValue, ref, type Database } from "firebase/database";

import { apiFetchWithStatus } from "@/lib/api";
import { normalizeConnectUserSearchQuery } from "@/lib/lounge/hub-utils";
import type {
  ChatInfo,
  ContactPerson,
  GroupOut,
  UserSearchResultRow,
} from "@/lib/lounge/hub-types";
import type { ConnectProfileSubTab } from "@/components/lounge/hub/ConnectProfileDrawer";

export type UseHubConnectSearchOptions = {
  open: boolean;
  searchQuery: string;
  groups: GroupOut[];
  mainChatList: ChatInfo[];
  userId: string | null | undefined;
  db: Database | null;
  masterAbortRef: MutableRefObject<AbortController | null>;
  handleUnauthorized: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  onOpenDirectChat: (p: ContactPerson) => void | Promise<void>;
  onOpenGroupChat: (c: ChatInfo) => void;
  onCloseOverlay: () => void;
  reloadGroups: () => Promise<GroupOut[] | null>;
  /** When provided, search + accept flows update this shared list (e.g. from bootstrap). */
  connectionsList?: UserSearchResultRow[];
  setConnectionsList?: Dispatch<SetStateAction<UserSearchResultRow[]>>;
};

export function useHubConnectSearch({
  open,
  searchQuery,
  groups,
  mainChatList,
  userId,
  db,
  masterAbortRef,
  handleUnauthorized,
  showToast,
  onOpenDirectChat,
  onOpenGroupChat,
  onCloseOverlay,
  reloadGroups,
  connectionsList: externalConnections,
  setConnectionsList: externalSetConnections,
}: UseHubConnectSearchOptions) {
  const [userSearchResults, setUserSearchResults] = useState<
    UserSearchResultRow[]
  >([]);
  const [internalConnections, setInternalConnections] = useState<
    UserSearchResultRow[]
  >([]);
  const connectionsList = externalConnections ?? internalConnections;
  const setConnectionsList = externalSetConnections ?? setInternalConnections;
  const [discoverGroupsList, setDiscoverGroupsList] = useState<GroupOut[]>([]);
  const [searchOverlayLoading, setSearchOverlayLoading] = useState(false);
  const [incomingFrIdBySender, setIncomingFrIdBySender] = useState<
    Record<string, string>
  >({});
  const [userSearchActionId, setUserSearchActionId] = useState<string | null>(
    null,
  );
  const [buddiesMenuOpenId, setBuddiesMenuOpenId] = useState<string | null>(
    null,
  );
  const [searchProfileFor, setSearchProfileFor] =
    useState<UserSearchResultRow | null>(null);
  const [searchProfileSubTab, setSearchProfileSubTab] =
    useState<ConnectProfileSubTab>("media");
  const [profileReportDialogOpen, setProfileReportDialogOpen] = useState(false);
  const [profilePanelPeerOnline, setProfilePanelPeerOnline] = useState<
    boolean | null
  >(null);

  const userSearchSeq = useRef(0);
  const openPrev = useRef(false);

  useEffect(() => {
    if (searchProfileFor) setSearchProfileSubTab("media");
  }, [searchProfileFor?.id]);

  useEffect(() => {
    if (buddiesMenuOpenId == null) return;
    const on = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && !t.closest("[data-buddies-root]")) {
        setBuddiesMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [buddiesMenuOpenId]);

  useEffect(() => {
    if (!userId) return;
    const needIncomingMap =
      open ||
      (searchProfileFor != null &&
        searchProfileFor.friend_status === "pending_received");
    if (!needIncomingMap) return;
    void (async () => {
      const r = await apiFetchWithStatus<
        { id: string; sender_id: string; status: string }[]
      >("/social/friend-requests", {
        signal: masterAbortRef.current?.signal,
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status === 200 && Array.isArray(r.data)) {
        const m: Record<string, string> = {};
        for (const fr of r.data) {
          if (fr.status === "pending") m[fr.sender_id] = fr.id;
        }
        setIncomingFrIdBySender(m);
      }
    })();
  }, [open, searchProfileFor, userId, handleUnauthorized, masterAbortRef]);

  useEffect(() => {
    if (openPrev.current && !open) {
      userSearchSeq.current += 1;
      setUserSearchResults([]);
      setConnectionsList([]);
      setDiscoverGroupsList([]);
      setSearchOverlayLoading(false);
    }
    openPrev.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      setConnectionsList([]);
      setDiscoverGroupsList([]);
      setSearchOverlayLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++userSearchSeq.current;
      void (async () => {
        setSearchOverlayLoading(true);
        try {
          const reqSignal = masterAbortRef.current?.signal;
          const [connRes, searchRes, groupsParamRes] = await Promise.all([
            apiFetchWithStatus<UserSearchResultRow[]>("/social/connections", {
              signal: reqSignal,
            }),
            apiFetchWithStatus<UserSearchResultRow[]>(
              `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
              { signal: reqSignal },
            ),
            apiFetchWithStatus<GroupOut[]>(
              `/groups?search=${encodeURIComponent(q)}`,
              { signal: reqSignal },
            ),
          ]);
          if (userSearchSeq.current !== seq) return;
          if (
            connRes.status === 401 ||
            searchRes.status === 401 ||
            groupsParamRes.status === 401
          ) {
            handleUnauthorized();
            return;
          }
          setConnectionsList(
            Array.isArray(connRes.data) ? connRes.data : [],
          );
          setUserSearchResults(
            Array.isArray(searchRes.data) ? searchRes.data : [],
          );

          const myIds = new Set(groups.map((g) => g.id));
          const qLower = q.toLowerCase();
          let discover: GroupOut[] = [];
          if (
            groupsParamRes.status === 200 &&
            Array.isArray(groupsParamRes.data)
          ) {
            discover = groupsParamRes.data.filter(
              (g) =>
                !myIds.has(g.id) &&
                (g.name?.toLowerCase().includes(qLower) ?? false),
            );
          }
          if (discover.length === 0) {
            const allRes = await apiFetchWithStatus<GroupOut[]>("/groups", {
              signal: reqSignal,
            });
            if (userSearchSeq.current !== seq) return;
            if (allRes.status === 401) {
              handleUnauthorized();
              return;
            }
            if (allRes.status === 200 && Array.isArray(allRes.data)) {
              discover = allRes.data.filter(
                (g) =>
                  !myIds.has(g.id) &&
                  (g.name?.toLowerCase().includes(qLower) ?? false),
              );
            }
          }
          setDiscoverGroupsList(discover);
        } catch {
          if (userSearchSeq.current === seq) {
            setUserSearchResults([]);
            setConnectionsList([]);
            setDiscoverGroupsList([]);
          }
        } finally {
          if (userSearchSeq.current === seq) {
            setSearchOverlayLoading(false);
          }
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    open,
    groups,
    handleUnauthorized,
    masterAbortRef,
  ]);

  useEffect(() => {
    if (!db || !searchProfileFor?.id) {
      setProfilePanelPeerOnline(null);
      return;
    }
    const r = ref(db, `presence/${searchProfileFor.id}/online`);
    const unsub = onValue(r, (snap) => {
      setProfilePanelPeerOnline(snap.val() === true);
    });
    return () => unsub();
  }, [db, searchProfileFor?.id]);

  const overlayChats = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as ChatInfo[];
    return mainChatList.filter(
      (c) =>
        c.type === "group" && (c.name?.toLowerCase().includes(n) ?? false),
    );
  }, [mainChatList, searchQuery]);

  const overlayContacts = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as UserSearchResultRow[];
    return connectionsList.filter((c) => {
      const fn = (c.full_name ?? "").toLowerCase();
      const un = (c.username ?? "").toLowerCase();
      return fn.includes(n) || un.includes(n);
    });
  }, [connectionsList, searchQuery]);

  const connectionIdSet = useMemo(
    () => new Set(connectionsList.map((c) => c.id)),
    [connectionsList],
  );

  const overlayPeople = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as UserSearchResultRow[];
    return userSearchResults.filter((u) => !connectionIdSet.has(u.id));
  }, [userSearchResults, connectionIdSet, searchQuery]);

  const connectUserSearchRow = useCallback(
    async (row: UserSearchResultRow) => {
      setUserSearchActionId(row.id);
      const r = await apiFetchWithStatus<{ id: string }>(
        "/social/friend-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: row.id }),
          signal: masterAbortRef.current?.signal,
        },
      );
      setUserSearchActionId(null);
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status >= 400 || !r.data) {
        showToast("Could not send request", "error");
        return;
      }
      setUserSearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "pending_sent" as const }
            : u,
        ),
      );
      setSearchProfileFor((p) =>
        p?.id === row.id
          ? { ...p, friend_status: "pending_sent" as const }
          : p,
      );
      showToast("Request sent", "success");
    },
    [handleUnauthorized, showToast, masterAbortRef],
  );

  const acceptUserSearchRow = useCallback(
    async (row: UserSearchResultRow) => {
      const frId = incomingFrIdBySender[row.id];
      if (!frId) {
        showToast(
          "Request not found. Try closing and opening search again.",
          "error",
        );
        return;
      }
      setUserSearchActionId(row.id);
      const r = await apiFetchWithStatus<unknown>(
        `/social/friend-requests/${frId}/accept`,
        { method: "PATCH" },
      );
      setUserSearchActionId(null);
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status >= 400) {
        showToast("Could not accept request", "error");
        return;
      }
      setIncomingFrIdBySender((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      setUserSearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "accepted" as const }
            : u,
        ),
      );
      setConnectionsList((prev) => {
        const has = prev.some((p) => p.id === row.id);
        if (has) {
          return prev.map((p) =>
            p.id === row.id
              ? { ...p, friend_status: "accepted" as const }
              : p,
          );
        }
        return [...prev, { ...row, friend_status: "accepted" as const }];
      });
      setSearchProfileFor((p) =>
        p?.id === row.id
          ? { ...p, friend_status: "accepted" as const }
          : p,
      );
      setBuddiesMenuOpenId(null);
      showToast("You are now connected", "success");
    },
    [incomingFrIdBySender, handleUnauthorized, showToast],
  );

  const messageUserSearchRow = useCallback(
    (row: UserSearchResultRow) => {
      setBuddiesMenuOpenId(null);
      setSearchProfileFor(null);
      onCloseOverlay();
      void onOpenDirectChat({
        id: row.id,
        full_name: row.full_name,
        username: row.username,
        avatar_url: row.profile_picture ?? row.avatar_url ?? null,
      });
    },
    [onOpenDirectChat, onCloseOverlay],
  );

  const blockUserSearch = useCallback(
    async (row: UserSearchResultRow) => {
      const r = await apiFetchWithStatus<unknown>("/social/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.id }),
        signal: masterAbortRef.current?.signal,
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status < 400) {
        showToast("User blocked", "success");
        setBuddiesMenuOpenId(null);
        setSearchProfileFor((p) => (p?.id === row.id ? null : p));
        setUserSearchResults((prev) =>
          prev.map((u) =>
            u.id === row.id
              ? { ...u, friend_status: "blocked" as const }
              : u,
          ),
        );
      } else {
        showToast("Could not block user", "error");
      }
    },
    [handleUnauthorized, showToast, masterAbortRef],
  );

  const openGroupChatFromSearch = useCallback(
    (c: ChatInfo) => {
      onCloseOverlay();
      onOpenGroupChat(c);
    },
    [onCloseOverlay, onOpenGroupChat],
  );

  const joinDiscoverGroup = useCallback(async () => {
    const code = window.prompt("Enter the group invite code");
    if (code == null || !String(code).trim()) return;
    const r = await apiFetchWithStatus<GroupOut>("/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: String(code).trim() }),
      signal: masterAbortRef.current?.signal,
    });
    if (r.status === 401) {
      handleUnauthorized();
      return;
    }
    if (r.status === 200 && r.data) {
      showToast(`Joined ${r.data.name}`, "success");
      onCloseOverlay();
      await reloadGroups();
    } else {
      showToast("Could not join. Check the code.", "error");
    }
  }, [handleUnauthorized, showToast, onCloseOverlay, reloadGroups, masterAbortRef]);

  return {
    searchOverlayLoading,
    overlayChats,
    overlayContacts,
    overlayPeople,
    discoverGroupsList,
    searchProfileFor,
    setSearchProfileFor,
    searchProfileSubTab,
    setSearchProfileSubTab,
    profileReportDialogOpen,
    setProfileReportDialogOpen,
    profilePanelPeerOnline,
    userSearchActionId,
    buddiesMenuOpenId,
    setBuddiesMenuOpenId,
    connectUserSearchRow,
    acceptUserSearchRow,
    messageUserSearchRow,
    blockUserSearch,
    openGroupChatFromSearch,
    joinDiscoverGroup,
  };
}
