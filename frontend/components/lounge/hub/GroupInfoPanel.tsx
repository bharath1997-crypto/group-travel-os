"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Share2,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { API_BASE, apiFetch, apiFetchWithStatus, fetchWithTimeout } from "@/lib/api";
import { GT_SCHEDULED_CALLS } from "@/lib/lounge/chat-prefs";
import { readJsonLs, writeJsonLs } from "@/lib/lounge/storage";
import type {
  ContactPerson,
  GroupMemberOut,
  GroupOut,
  SelectedGroupParticipant,
  TripOut,
  UserSearchResultRow,
} from "@/lib/lounge/hub-types";
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  ThIconCheckCircle,
  ThIconChevronLeft,
  ThIconChevronRight,
  ThIconLink,
  ThIconMail,
  ThIconMoreDots,
  ThIconPhoneHandset,
  ThIconPlane,
  ThIconPlus,
  ThIconSearch,
  ThIconVideoCam,
  ThStatusDot,
} from "@/components/lounge/hub/HubIcons";
import { daysDiff, formatTripHeaderDates, groupTripStatusPill } from "@/lib/lounge/trip-utils";
import {
  initialsFromName,
  isAbortError,
  isInlineSvgDataUrlToSkipForPhoto,
  isLegacyDicebearUrl,
  listAvatarColor,
  formatUserSearchMeta,
  normalizeConnectUserSearchQuery,
} from "@/lib/lounge/hub-utils";

const API_V1_BASE = "http://localhost:8000/api/v1";
const GI_BG = "#fdf6ed";
const GI_CARD = "#ffffff";
const GI_CORAL = "#ff6b6b";
const GI_GREEN = "#1d9e75";
const GI_MUTED = "#8896a0";
const GI_TEXT = "#1e2a3a";
const GI_ACTION_BG = "#f5ede0";
const GI_SECTION_BORDER = "#e8d5b7";

function groupInfoAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("gt_token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function netForUserInTripSummary(
  rows: { from_user_id: string; to_user_id: string; amount: number }[],
  me: string,
): number {
  const m = me.replace(/-/g, "").toLowerCase();
  let n = 0;
  for (const r of rows) {
    const from = String(r.from_user_id).replace(/-/g, "").toLowerCase();
    const to = String(r.to_user_id).replace(/-/g, "").toLowerCase();
    if (to === m) n += r.amount;
    if (from === m) n -= r.amount;
  }
  return Math.round(n * 100) / 100;
}

function formatTripBarDate(
  s: string | null | undefined,
  fallback = "—",
): string {
  if (s == null || !String(s).trim()) return fallback;
  const t = Date.parse(String(s));
  if (Number.isNaN(t)) return fallback;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type GroupInfoPanelProps = {
  group: GroupOut;
  selfId: string;
  onClose: () => void;
  onSearchInGroupChat: () => void;
  openDirectChat: (p: ContactPerson) => void;
  onLeaveSuccess: (groupId: string) => void;
  showToast: (message: string, type?: "success" | "error") => void;
  onUnauthorized: () => void;
  loadBackend: () => void | Promise<unknown>;
  onViewFullSplit: () => void;
  onSettleAll: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall: () => void;
  onClearChat: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  scheduleVersion: number;
  onScheduleChanged: () => void;
};

function GroupInfoPanel({
  group: groupProp,
  selfId,
  onClose,
  onSearchInGroupChat,
  openDirectChat,
  onLeaveSuccess,
  showToast,
  onUnauthorized,
  loadBackend,
  onViewFullSplit,
  onSettleAll,
  masterAbortRef,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onClearChat,
  onToggleFavorite,
  isFavorite,
  scheduleVersion,
  onScheduleChanged,
}: GroupInfoPanelProps) {
  const [scheduledCalls, setScheduledCalls] = useState<
    {
      id: string;
      chatId: string;
      chatName: string;
      title: string;
      at: number;
    }[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const groupChatId = `group_${groupProp.id}`;
      const filtered = list
        .filter((x) => x.chatId === groupChatId)
        .sort((a, b) => a.at - b.at);
      setScheduledCalls(filtered);
    } catch {
      setScheduledCalls([]);
    }
  }, [groupProp.id, scheduleVersion]);

  const removeScheduledCall = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const next = list.filter((x) => x.id !== id);
      window.localStorage.setItem(
        "gt_scheduled_calls_v1",
        JSON.stringify(next),
      );
      onScheduleChanged();
    } catch {
      /* localStorage unavailable */
    }
  };
  const [panelOpacity, setPanelOpacity] = useState(0);
  const [group, setGroup] = useState<GroupOut>(groupProp);
  const [members, setMembers] = useState<GroupMemberOut[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [firstTrip, setFirstTrip] = useState<TripOut | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [expenseSummary, setExpenseSummary] = useState<
    { from_user_id: string; to_user_id: string; amount: number }[] | null
  >(null);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [memberBalances, setMemberBalances] = useState<Record<string, number>>(
    {},
  );
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionMoreOpen, setActionMoreOpen] = useState(false);
  const [memberSheet, setMemberSheet] = useState<GroupMemberOut | null>(null);
  const [memberSheetDetail, setMemberSheetDetail] = useState<{
    total_net: number;
    by_group: {
      group_id: string;
      group_name: string;
      net_amount: number;
    }[];
  } | null>(null);
  const [adminAction, setAdminAction] = useState<GroupMemberOut | null>(null);
  const [reassignPickerOpen, setReassignPickerOpen] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [budgetTotals, setBudgetTotals] = useState<{
    total: number;
    expenses: number;
    currency: string;
  } | null>(null);
  const actionMoreRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infoMediaTab, setInfoMediaTab] = useState<"media" | "links" | "docs">(
    "media",
  );
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [addMemberResults, setAddMemberResults] = useState<UserSearchResultRow[]>(
    [],
  );
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [addMemberInvite, setAddMemberInvite] = useState<
    Record<string, "invited" | "already">
  >({});
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [pendingInvitesCount, setPendingInvitesCount] = useState<number | null>(
    null,
  );

  const memberDetailFetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      memberDetailFetchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setGroup(groupProp);
  }, [groupProp.id, groupProp]);

  const isTravel = useMemo(
    () => (group.group_type ?? "regular") === "travel",
    [group.group_type],
  );

  useEffect(() => {
    setPanelOpacity(0);
    const t = setTimeout(() => setPanelOpacity(1), 10);
    return () => clearTimeout(t);
  }, [group.id]);

  useEffect(() => {
    if (!actionMoreOpen) return;
    const h = (e: MouseEvent) => {
      const a = actionMoreRef.current;
      if (a && !a.contains(e.target as Node)) setActionMoreOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [actionMoreOpen]);

  const refreshGroupDetail = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status === 200) {
        const d = (await r.json()) as GroupOut;
        setGroup((prev) => ({ ...prev, ...d, members: prev?.members ?? [] }));
      }
    } catch (e) {
      if (isAbortError(e)) return;
      /* ignore */
    }
  }, [group.id, onUnauthorized]);

  useEffect(() => {
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setMembersLoading(true);
      setMembers(null);
      try {
        const [gRes, mRes] = await Promise.all([
          fetchWithTimeout(
            `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          ),
          fetchWithTimeout(
            `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          ),
        ]);
        if (gRes.status === 401 || mRes.status === 401) {
          onUnauthorized();
          return;
        }
        if (gRes.status === 200) {
          const d = (await gRes.json()) as GroupOut;
          if (!cancel) setGroup((prev) => ({ ...prev, ...d }));
        }
        if (mRes.status === 200) {
          const list = (await mRes.json()) as GroupMemberOut[];
          if (!cancel) setMembers(Array.isArray(list) ? list : []);
        } else {
          if (!cancel) setMembers([]);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setMembers([]);
      } finally {
        if (!cancel) setMembersLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [group.id, onUnauthorized]);

  useEffect(() => {
    if (!isTravel) {
      setFirstTrip(null);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setTripsLoading(true);
      setFirstTrip(null);
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/trips`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const list = (await r.json()) as TripOut[];
          if (!cancel && Array.isArray(list) && list.length > 0)
            setFirstTrip(list[0]!);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setFirstTrip(null);
      } finally {
        if (!cancel) setTripsLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [group.id, isTravel, onUnauthorized]);

  useEffect(() => {
    if (!isTravel || !firstTrip) {
      setExpenseSummary(null);
      setSummaryError(false);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setSummaryLoading(true);
      setSummaryError(false);
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/trips/${encodeURIComponent(firstTrip.id)}/expenses/summary`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const data = (await r.json()) as {
            from_user_id: string;
            to_user_id: string;
            amount: number;
          }[];
          if (!cancel) setExpenseSummary(Array.isArray(data) ? data : []);
        } else {
          if (!cancel) {
            setExpenseSummary(null);
            setSummaryError(true);
          }
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) {
          setExpenseSummary(null);
          setSummaryError(true);
        }
      } finally {
        if (!cancel) setSummaryLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isTravel, firstTrip?.id, onUnauthorized]);

  useEffect(() => {
    if (!isTravel || !firstTrip) {
      setBudgetTotals(null);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/trips/${encodeURIComponent(firstTrip.id)}/expenses/summary/category`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const rows = (await r.json()) as {
            category: string;
            total: number;
            currency: string;
            expense_count: number;
          }[];
          if (cancel) return;
          let total = 0;
          let count = 0;
          let currency = "INR";
          for (const row of rows) {
            total += Number(row.total) || 0;
            count += Number(row.expense_count) || 0;
            if (row.currency) currency = row.currency;
          }
          setBudgetTotals({ total, expenses: count, currency });
        } else {
          if (!cancel) setBudgetTotals(null);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setBudgetTotals(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isTravel, firstTrip?.id, onUnauthorized]);

  const isAdmin = useMemo(() => {
    if (!members) return false;
    return members.some(
      (m) =>
        m.user_id === selfId &&
        String(m.role ?? "").toLowerCase() === "admin",
    );
  }, [members, selfId]);

  const refetchPendingInvites = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/invitations/group/${encodeURIComponent(group.id)}/pending`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status !== 200) return;
      const d: unknown = await r.json();
      let n = 0;
      if (Array.isArray(d)) n = d.length;
      else if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        if (typeof o.count === "number") n = o.count;
        else if (typeof o.pending === "number") n = o.pending;
        else if (Array.isArray(o.items)) n = o.items.length;
      }
      setPendingInvitesCount(n);
    } catch (e) {
      if (isAbortError(e)) return;
      /* skip silently */
    }
  }, [isAdmin, group.id]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingInvitesCount(null);
      return;
    }
    void refetchPendingInvites();
  }, [isAdmin, refetchPendingInvites]);

  useEffect(() => {
    setAddMemberOpen(false);
    setAddMemberQuery("");
    setAddMemberResults([]);
    setAddMemberInvite({});
    setInvitingUserId(null);
  }, [group.id]);

  useEffect(() => {
    if (!addMemberOpen) return;
    const q = addMemberQuery.trim();
    if (!q) {
      setAddMemberResults([]);
      setAddMemberSearching(false);
      return;
    }
    setAddMemberSearching(true);
    const t = setTimeout(() => {
      const runSignal = masterAbortRef.current?.signal;
      void (async () => {
        try {
          const r = await fetchWithTimeout(
            `${API_V1_BASE}/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          );
          if (r.status === 401) {
            onUnauthorized();
            setAddMemberSearching(false);
            return;
          }
          if (r.status !== 200) {
            setAddMemberResults([]);
            setAddMemberSearching(false);
            return;
          }
          const data = (await r.json()) as UserSearchResultRow[];
          const mlist = members ?? group.members ?? [];
          const inGroup = new Set(mlist.map((x) => x.user_id));
          const filtered = (Array.isArray(data) ? data : []).filter(
            (u) => u.id !== selfId && !inGroup.has(u.id),
          );
          setAddMemberResults(filtered);
        } catch (e) {
          if (isAbortError(e)) return;
          setAddMemberResults([]);
        } finally {
          setAddMemberSearching(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    addMemberQuery,
    addMemberOpen,
    group.id,
    selfId,
    members,
    group.members,
    onUnauthorized,
  ]);

  const sendGroupInvite = useCallback(
    async (row: UserSearchResultRow) => {
      try {
        setInvitingUserId(row.id);
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/invitations/group/${encodeURIComponent(group.id)}/invite`,
          {
            method: "POST",
            headers: {
              ...(groupInfoAuthHeaders() as Record<string, string>),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: row.id }),
            signal: masterAbortRef.current?.signal,
          },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200 || r.status === 201 || r.status === 204) {
          setAddMemberInvite((k) => ({ ...k, [row.id]: "invited" }));
          showToast(`Invitation sent to ${row.full_name}!`, "success");
          void refetchPendingInvites();
          return;
        }
        if (r.status === 409) {
          setAddMemberInvite((k) => ({ ...k, [row.id]: "already" }));
          return;
        }
        showToast("Failed to send invite", "error");
      } catch (e) {
        if (isAbortError(e)) return;
        showToast("Failed to send invite", "error");
      } finally {
        setInvitingUserId(null);
      }
    },
    [group.id, onUnauthorized, showToast, refetchPendingInvites],
  );

  useEffect(() => {
    setMemberBalances({});
    setShowAllMembers(false);
  }, [group.id]);

  const myTripNet = useMemo(() => {
    if (!expenseSummary || !selfId) return 0;
    return netForUserInTripSummary(expenseSummary, selfId);
  }, [expenseSummary, selfId]);

  const pendingPeopleCount = useMemo(() => {
    if (!expenseSummary) return 0;
    const ids = new Set<string>();
    for (const r of expenseSummary) {
      if (Math.abs(r.amount) >= 0.01) {
        ids.add(String(r.from_user_id).toLowerCase());
        ids.add(String(r.to_user_id).toLowerCase());
      }
    }
    return ids.size;
  }, [expenseSummary]);

  const travelLeaveDisabled =
    isTravel && firstTrip && !summaryLoading
      ? Math.abs(myTripNet) > 0.01
      : false;

  const openMemberSheet = (m: GroupMemberOut) => {
    if (m.user_id === selfId) return;
    memberDetailFetchAbortRef.current?.abort();
    const ac = new AbortController();
    memberDetailFetchAbortRef.current = ac;
    const panelSig = masterAbortRef.current?.signal;
    if (panelSig) {
      if (panelSig.aborted) {
        return;
      }
      const onPanelAbort = () => ac.abort();
      panelSig.addEventListener("abort", onPanelAbort, { once: true });
    }
    setMemberSheet(m);
    setMemberSheetDetail(null);
    void (async () => {
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/users/${encodeURIComponent(m.user_id)}/balance`,
          { headers: groupInfoAuthHeaders(), signal: ac.signal },
        );
        if (r.status === 200) {
          const d = (await r.json()) as {
            total_net: number;
            by_group: { group_id: string; group_name: string; net_amount: number }[];
          };
          setMemberSheetDetail({
            total_net: d.total_net ?? 0,
            by_group: Array.isArray(d.by_group) ? d.by_group : [],
          });
          if (typeof d.total_net === "number")
            setMemberBalances((b) => ({ ...b, [m.user_id]: d.total_net }));
        }
      } catch (e) {
        if (isAbortError(e)) return;
        setMemberSheetDetail({ total_net: 0, by_group: [] });
      }
    })();
  };

  const callLeaveOnce = async (): Promise<
    "ok" | "deleted" | "needs_admin" | "balance" | "error"
  > => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/leave`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return "error";
      }
      if (r.status === 200 || r.status === 204) {
        try {
          const body = (await r.clone().json()) as { deleted?: boolean };
          return body?.deleted ? "deleted" : "ok";
        } catch {
          return "ok";
        }
      }
      if (r.status === 400) {
        let detail = "";
        try {
          const j = (await r.json()) as { detail?: string };
          detail = (j?.detail ?? "").toLowerCase();
        } catch {
          /* ignore */
        }
        if (detail.includes("admin")) return "needs_admin";
        if (detail.includes("balance") || detail.includes("settle"))
          return "balance";
      }
      return "error";
    } catch (e) {
      if (isAbortError(e)) return "error";
      return "error";
    }
  };

  const doLeave = async () => {
    const name = group.name;
    if (
      !window.confirm(
        `Leave ${name}? You will lose access to all messages.`,
      )
    )
      return;
    const result = await callLeaveOnce();
    if (result === "ok") {
      showToast("Left group", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "deleted") {
      showToast("Group dissolved", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "balance") {
      showToast(
        "Settle your balance before leaving this travel group",
        "error",
      );
      return;
    }
    if (result === "needs_admin") {
      const others = (members ?? group.members).filter(
        (m) => m.user_id !== selfId,
      );
      if (others.length === 0) {
        showToast("Cannot leave: no other members to promote", "error");
        return;
      }
      setReassignPickerOpen(true);
      return;
    }
    showToast("Could not leave group", "error");
  };

  const reassignAndLeave = async (newAdminUserId: string) => {
    const ok = await setMemberRoleApi(newAdminUserId, "admin");
    if (!ok) return;
    setReassignPickerOpen(false);
    const result = await callLeaveOnce();
    if (result === "ok" || result === "deleted") {
      showToast("Left group", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "balance") {
      showToast(
        "Settle your balance before leaving this travel group",
        "error",
      );
      return;
    }
    showToast("Could not leave group", "error");
  };

  const doCloseGroup = async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/close-check`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status !== 200) {
        showToast("Could not check group", "error");
        return;
      }
      const d = (await r.json()) as {
        can_close: boolean;
        pending_member_count: number;
      };
      if (!d.can_close) {
        globalThis.alert(
          `Cannot close — ${d.pending_member_count} members still have pending balances`,
        );
        return;
      }
      if (
        !window.confirm(
          `Delete group "${group.name}"? This cannot be undone.`,
        )
      )
        return;
      const del = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (del.status === 401) {
        onUnauthorized();
        return;
      }
      if (del.status === 204 || del.status === 200) {
        showToast("Group closed", "success");
        onLeaveSuccess(group.id);
        return;
      }
      showToast("Group delete is not available", "error");
    } catch (e) {
      if (isAbortError(e)) return;
      showToast("Could not close group", "error");
    }
  };

  const copyCode = async () => {
    const code = group.invite_code ?? "";
    if (!code) {
      void refreshGroupDetail();
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast("Could not copy", "error");
    }
  };

  const reloadMembers = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status === 200) {
        const list = (await r.json()) as GroupMemberOut[];
        setMembers(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      if (isAbortError(e)) return;
    }
  }, [group.id, onUnauthorized, masterAbortRef]);

  const setMemberRoleApi = async (
    userId: string,
    role: "admin" | "member",
  ): Promise<boolean> => {
    setMemberActionLoading(true);
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(userId)}/role`,
        {
          method: "PATCH",
          headers: {
            ...groupInfoAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return false;
      }
      if (r.status === 200) {
        await reloadMembers();
        return true;
      }
      let detail = "";
      try {
        const j = (await r.json()) as { detail?: string };
        detail = j?.detail ?? "";
      } catch {
        /* ignore */
      }
      showToast(detail || "Could not update role", "error");
      return false;
    } catch (e) {
      if (isAbortError(e)) return false;
      showToast("Could not update role", "error");
      return false;
    } finally {
      setMemberActionLoading(false);
    }
  };

  const removeMemberApi = async (userId: string): Promise<boolean> => {
    setMemberActionLoading(true);
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return false;
      }
      if (r.status === 204 || r.status === 200) {
        await reloadMembers();
        return true;
      }
      let detail = "";
      try {
        const j = (await r.json()) as { detail?: string };
        detail = j?.detail ?? "";
      } catch {
        /* ignore */
      }
      showToast(detail || "Could not remove member", "error");
      return false;
    } catch (e) {
      if (isAbortError(e)) return false;
      showToast("Could not remove member", "error");
      return false;
    } finally {
      setMemberActionLoading(false);
    }
  };

  const shareLink = async () => {
    const code = group.invite_code ?? "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/?invite=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const memberList = members ?? group.members;
  const memberCount = memberList.length;
  const listSlice = showAllMembers
    ? memberList
    : memberList.slice(0, 10);
  const displayName = group.name || "Group";
  const init = initialsFromName(displayName);
  const avBg = listAvatarColor(displayName);
  const desc =
    (group.description ?? "").trim() || "";

  const tripStatusBadge = (s: string) => {
    const u = s.toLowerCase();
    if (u === "ongoing")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(29, 158, 117, 0.2)", color: GI_GREEN }}
        >
          <ThStatusDot color={GI_GREEN} />
          Ongoing
        </span>
      );
    if (u === "planning" || u === "confirmed")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}
        >
          <ThStatusDot color="#60a5fa" />
          Upcoming
        </span>
      );
    if (u === "completed" || u === "cancelled")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
          style={{ color: "#9ca3af" }}
        >
          <ThStatusDot color="#9ca3af" />
          Completed
        </span>
      );
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
        style={{ color: "#9ca3af" }}
      >
        <ThStatusDot color="#9ca3af" />
        {s}
      </span>
    );
  };

  const formatMoneyInr = (n: number) => {
    const a = Math.abs(n);
    return `₹${a.toFixed(2)}`;
  };

  const rolePill = (m: GroupMemberOut) => {
    const isAdm = String(m.role ?? "").toLowerCase() === "admin";
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: isAdm ? "#f0a500" : GI_ACTION_BG,
          color: isAdm ? GI_TEXT : GI_MUTED,
        }}
      >
        {isAdm ? "Admin" : "Member"}
      </span>
    );
  };

  const cardBase =
    "mb-3 rounded-[12px] p-4";
  const cardStyle: CSSProperties = {
    background: GI_CARD,
    border: `1px solid ${GI_SECTION_BORDER}`,
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col transition-opacity duration-200"
      style={{
        background: GI_BG,
        opacity: panelOpacity,
      }}
    >
      <div
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto"
        style={{ background: GI_BG }}
      >
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-20 rounded p-1.5 hover:bg-black/5"
            style={{ color: GI_MUTED }}
            onClick={onClose}
            aria-label="Close group info"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div
            className="h-[100px] w-full"
            style={
              isTravel
                ? {
                    background: GI_ACTION_BG,
                    borderBottom: `2px solid ${GI_CORAL}`,
                  }
                : { background: GI_ACTION_BG, borderBottom: `1px solid ${GI_SECTION_BORDER}` }
            }
          />
          <div className="flex flex-col items-center px-4 pb-4 pt-0">
            <div
              className="relative -mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-lg font-bold text-white"
              style={{ background: avBg }}
            >
              {init}
            </div>
            <p className="mt-2 flex items-center justify-center gap-0.5 text-center text-base font-bold" style={{ color: GI_TEXT }}>
              <span>{displayName}</span>
              {isTravel ? (
                <span
                  className="inline-flex shrink-0"
                  style={{ color: GI_CORAL }}
                  aria-label="Travel group"
                >
                  <ThIconPlane size={14} className="text-current" />
                </span>
              ) : null}
            </p>
            <p className="text-center text-xs" style={{ color: GI_MUTED }}>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <div className="mt-4 flex w-full max-w-sm justify-center gap-2">
              {(
                [
                  { key: "search", label: "Search" as const },
                  { key: "voice", label: "Voice" as const },
                  { key: "video", label: "Video" as const },
                  { key: "schedule", label: "Schedule" as const },
                  { key: "more", label: "More" as const },
                ] as const
              ).map((row) => {
                const iconNode =
                  row.key === "search" ? (
                    <ThIconSearch size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "voice" ? (
                    <ThIconPhoneHandset size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "video" ? (
                    <ThIconVideoCam size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "schedule" ? (
                    <Calendar
                      className="h-[18px] w-[18px] text-[#1e2a3a]"
                      strokeWidth={2}
                    />
                  ) : (
                    <ThIconMoreDots size={18} className="text-[#1e2a3a]" />
                  );
                return (
                <div key={row.key} className="relative flex-1" ref={row.key === "more" ? actionMoreRef : undefined}>
                  <button
                    type="button"
                    className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl"
                    style={{ background: GI_ACTION_BG, minHeight: 44, color: GI_TEXT }}
                    onClick={() => {
                      if (row.key === "search") {
                        onSearchInGroupChat();
                      } else if (row.key === "voice") {
                        onVoiceCall();
                      } else if (row.key === "video") {
                        onVideoCall();
                      } else if (row.key === "schedule") {
                        onScheduleCall();
                      } else {
                        setActionMoreOpen((o) => !o);
                      }
                    }}
                  >
                    {iconNode}
                    <span className="text-[10px]" style={{ color: GI_MUTED }}>
                      {row.label}
                    </span>
                  </button>
                  {row.key === "more" && actionMoreOpen ? (
                    <div
                      className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border py-1 shadow-xl"
                      style={{ background: GI_CARD, borderColor: GI_SECTION_BORDER }}
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          onToggleFavorite();
                        }}
                      >
                        {isFavorite
                          ? "Remove from Favorites"
                          : "Add to Favorites"}
                      </button>
                      {isTravel ? (
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_GREEN }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onClose();
                            onViewFullSplit();
                          }}
                        >
                          Settle up
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          onClearChat();
                        }}
                      >
                        Clear Chat
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          showToast("Notifications muted (local)", "success");
                        }}
                      >
                        Mute Notifications
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_CORAL }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          globalThis.alert("Report submitted. We'll review this group.");
                        }}
                      >
                        Report Group
                      </button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-3 pb-6">
          {scheduledCalls.length > 0 ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: GI_MUTED }}
                >
                  Scheduled calls
                </p>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-black/5"
                  style={{ color: GI_CORAL }}
                  onClick={onScheduleCall}
                >
                  + New
                </button>
              </div>
              <ul className="space-y-2">
                {scheduledCalls.map((s) => {
                  const upcoming = s.at >= Date.now();
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: GI_SECTION_BORDER,
                        background: GI_ACTION_BG,
                        opacity: upcoming ? 1 : 0.6,
                      }}
                    >
                      <Calendar
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                        style={{ color: GI_TEXT }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-semibold"
                          style={{ color: GI_TEXT }}
                        >
                          {s.title}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: GI_MUTED }}
                        >
                          {new Date(s.at).toLocaleString()}
                          {!upcoming ? " · past" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 hover:bg-black/5"
                        style={{ color: GI_MUTED }}
                        aria-label="Remove reminder"
                        onClick={() => removeScheduledCall(s.id)}
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {isTravel && firstTrip && !tripsLoading ? (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-full border px-3 py-2"
              style={cardStyle}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium" style={{ color: GI_TEXT }}>
                <ThIconPlane size={14} className="shrink-0 text-[#1e2a3a]" />
                <span>
                  {formatTripBarDate(firstTrip.start_date)} &nbsp;&rarr;{" "}
                  {formatTripBarDate(firstTrip.end_date)}
                </span>
              </span>
              {tripStatusBadge(String(firstTrip.status))}
            </div>
          ) : null}

          {isTravel && firstTrip ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-[11px] font-bold uppercase"
                  style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
                >
                  Split Activity
                </p>
                {Math.abs(myTripNet) >= 0.01 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background:
                        myTripNet > 0
                          ? "rgba(29,158,117,0.15)"
                          : "rgba(255,107,107,0.15)",
                      color: myTripNet > 0 ? GI_GREEN : GI_CORAL,
                    }}
                  >
                    {myTripNet > 0 ? "You're owed" : "You owe"}
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: "rgba(29,158,117,0.15)",
                      color: GI_GREEN,
                    }}
                  >
                    All settled
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Group total
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-bold"
                    style={{ color: GI_TEXT }}
                    title={
                      budgetTotals ? String(budgetTotals.total) : undefined
                    }
                  >
                    {budgetTotals
                      ? `₹${budgetTotals.total.toFixed(0)}`
                      : summaryLoading
                        ? "…"
                        : "—"}
                  </p>
                </div>
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Expenses
                  </p>
                  <p
                    className="mt-0.5 text-sm font-bold"
                    style={{ color: GI_TEXT }}
                  >
                    {budgetTotals ? budgetTotals.expenses : "—"}
                  </p>
                </div>
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Pending
                  </p>
                  <p
                    className="mt-0.5 text-sm font-bold"
                    style={{
                      color: pendingPeopleCount > 0 ? GI_CORAL : GI_GREEN,
                    }}
                  >
                    {pendingPeopleCount}
                  </p>
                </div>
              </div>
              <div
                className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2"
                style={{
                  borderColor: GI_SECTION_BORDER,
                  background:
                    Math.abs(myTripNet) < 0.01
                      ? GI_ACTION_BG
                      : myTripNet > 0
                        ? "rgba(29,158,117,0.08)"
                        : "rgba(255,107,107,0.08)",
                }}
              >
                <span className="text-xs" style={{ color: GI_MUTED }}>
                  Your balance
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color:
                      Math.abs(myTripNet) < 0.01
                        ? GI_MUTED
                        : myTripNet > 0
                          ? GI_GREEN
                          : GI_CORAL,
                  }}
                >
                  {Math.abs(myTripNet) < 0.01
                    ? "₹0"
                    : myTripNet > 0
                      ? `+₹${myTripNet.toFixed(2)}`
                      : `-₹${Math.abs(myTripNet).toFixed(2)}`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                  onClick={() => {
                    onClose();
                    onViewFullSplit();
                  }}
                >
                  View full split
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
                  style={{ background: GI_GREEN }}
                  onClick={() => {
                    onClose();
                    onViewFullSplit();
                  }}
                >
                  Settle up
                </button>
              </div>
            </div>
          ) : null}

          {isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Trip Details
              </p>
              {!firstTrip && !tripsLoading ? (
                <p className="text-sm" style={{ color: GI_MUTED }}>
                  No trip linked to this group yet
                </p>
              ) : firstTrip ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span style={{ color: GI_MUTED }}>Status</span>
                  <span className="text-right font-medium" style={{ color: GI_TEXT }}>
                    {String(firstTrip.status)}
                  </span>
                  <span style={{ color: GI_MUTED }}>Created</span>
                  <span className="text-right" style={{ color: GI_TEXT }}>
                    {formatTripBarDate(
                      firstTrip.created_at,
                      "—",
                    )}
                  </span>
                </div>
              ) : (
                <div className="h-4 animate-pulse rounded bg-[#e8d5b7]/50" />
              )}
            </div>
          ) : null}

          {!isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Description
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: desc ? GI_TEXT : GI_MUTED }}
              >
                {desc || "No description added"}
              </p>
            </div>
          ) : null}

          <div
            className="mb-3 mx-3 rounded-[12px] p-4"
            style={cardStyle}
          >
            <div
              className="mb-2.5 flex gap-1 border-b pb-2"
              style={{ borderColor: GI_SECTION_BORDER }}
            >
              {(["media", "links", "docs"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold uppercase"
                  style={{
                    color: infoMediaTab === t ? GI_TEXT : GI_MUTED,
                    background:
                      infoMediaTab === t ? GI_ACTION_BG : "transparent",
                    letterSpacing: "0.06em",
                  }}
                  onClick={() => setInfoMediaTab(t)}
                >
                  {t === "media" ? "MEDIA" : t === "links" ? "LINKS" : "DOCS"}
                </button>
              ))}
            </div>
            <p className="py-3 text-center text-sm" style={{ color: GI_MUTED }}>
              No {infoMediaTab} yet
            </p>
          </div>

          <div className={cardBase} style={cardStyle}>
            <div className="mb-2.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="min-w-0 flex-1 text-[11px] font-bold leading-snug"
                  style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
                >
                  <span className="uppercase">MEMBERS · {memberCount}</span>
                  {isAdmin &&
                  pendingInvitesCount != null &&
                  pendingInvitesCount > 0 ? (
                    <span
                      className="ml-1.5 text-[10px] font-normal normal-case tracking-normal"
                      style={{ color: GI_MUTED }}
                    >
                      ({pendingInvitesCount} pending)
                    </span>
                  ) : null}
                </p>
                {isAdmin ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border px-2 py-1 text-[11px] font-semibold"
                    style={{
                      borderColor: "#f0a500",
                      color: "#f0a500",
                      background: "transparent",
                    }}
                    onClick={() => {
                      setAddMemberOpen((o) => {
                        if (o) {
                          setAddMemberQuery("");
                          setAddMemberResults([]);
                        }
                        return !o;
                      });
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <ThIconPlus size={14} className="text-current" />
                      Add Member
                    </span>
                  </button>
                ) : null}
              </div>
              {isAdmin && addMemberOpen ? (
                <div
                  className="mb-3 mt-3 rounded-[10px] border p-3"
                  style={{
                    borderColor: GI_SECTION_BORDER,
                    background: GI_ACTION_BG,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={{ color: GI_TEXT }}>
                      Add Members
                    </span>
                    <button
                      type="button"
                      className="text-lg leading-none"
                      style={{ color: GI_MUTED }}
                      aria-label="Close add members"
                      onClick={() => {
                        setAddMemberOpen(false);
                        setAddMemberQuery("");
                        setAddMemberResults([]);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    style={{ borderColor: GI_SECTION_BORDER, background: GI_CARD }}
                  >
                    <span className="inline-flex" style={{ color: GI_MUTED }} aria-hidden>
                      <ThIconSearch size={18} className="text-current" />
                    </span>
                    <input
                      type="search"
                      value={addMemberQuery}
                      onChange={(e) => setAddMemberQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8896a0]"
                      style={{ color: GI_TEXT }}
                      autoComplete="off"
                    />
                  </div>
                  {addMemberSearching ? (
                    <p
                      className="mt-2 text-center text-xs"
                      style={{ color: GI_MUTED }}
                    >
                      Searching…
                    </p>
                  ) : null}
                  {addMemberQuery.trim().length > 0 &&
                  addMemberQuery.includes("@") &&
                  !addMemberSearching &&
                  addMemberResults.length === 0 ? (
                    <p
                      className="mt-2 text-center text-xs"
                      style={{ color: GI_MUTED }}
                    >
                      No account found for this email
                    </p>
                  ) : null}
                  {!addMemberSearching &&
                    addMemberQuery.trim().length > 0 &&
                    addMemberResults.length > 0 ? (
                      <ul className="mt-2 max-h-48 list-none space-y-0 custom-scrollbar overflow-y-auto p-0">
                        {addMemberResults.map((u) => {
                          const sub = formatUserSearchMeta(u);
                          const inv = addMemberInvite[u.id];
                          const av =
                            u.avatar_url?.trim() ||
                            u.profile_picture?.trim() ||
                            null;
                          return (
                            <li
                              key={u.id}
                              className="flex items-center gap-2 border-b py-2 last:border-b-0"
                              style={{ borderColor: GI_SECTION_BORDER }}
                            >
                              {av &&
                              !isInlineSvgDataUrlToSkipForPhoto(av) &&
                              !isLegacyDicebearUrl(av) ? (
                                <img
                                  src={av}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                                  width={36}
                                  height={36}
                                />
                              ) : (
                                <InitialsAvatar
                                  name={u.full_name}
                                  size={40}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium" style={{ color: GI_TEXT }}>
                                  {u.full_name}
                                </p>
                                <p
                                  className="truncate text-[11px]"
                                  style={{ color: GI_MUTED }}
                                >
                                  {sub.trim() || " "}
                                </p>
                              </div>
                              {inv === "invited" ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400">
                                  <ThIconCheckCircle
                                    size={14}
                                    className="text-[#9ca3af]"
                                  />
                                  Invited
                                </span>
                              ) : inv === "already" ? (
                                <span
                                  className="shrink-0 text-xs font-medium"
                                  style={{ color: GI_MUTED }}
                                >
                                  Already invited
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={invitingUserId === u.id}
                                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                                  style={{ background: GI_CORAL }}
                                  onClick={() => {
                                    void sendGroupInvite(u);
                                  }}
                                >
                                  {invitingUserId === u.id ? "…" : "Add"}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                </div>
              ) : null}
            </div>
            {membersLoading && !memberList.length ? (
              <div className="space-y-2">
                <div className="h-9 animate-pulse rounded bg-[#e8d5b7]/50" />
                <div className="h-9 animate-pulse rounded bg-[#e8d5b7]/50" />
              </div>
            ) : null}
            {listSlice.map((m) => {
              const b = memberBalances[m.user_id];
              const hasB = typeof b === "number" && isTravel;
              const showAdminMenu = isAdmin && m.user_id !== selfId;
              return (
                <div
                  key={m.id ?? m.user_id}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg py-1 last:mb-0"
                >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left hover:bg-black/[0.04]"
                  onClick={() => {
                    if (m.user_id === selfId) return;
                    if (isTravel) openMemberSheet(m);
                    else {
                      onClose();
                      void openDirectChat({
                        id: m.user_id,
                        full_name: m.full_name,
                        avatar_url: m.avatar_url ?? null,
                      });
                    }
                  }}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: listAvatarColor(m.full_name) }}
                    >
                      {initialsFromName(m.full_name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: GI_TEXT }}>
                    {m.full_name}
                  </span>
                  {rolePill(m)}
                  {isTravel && hasB ? (
                    <span
                      className="shrink-0 text-xs font-semibold"
                      style={{
                        color:
                          Math.abs(b) < 0.01
                            ? "#9ca3af"
                            : b > 0
                              ? GI_GREEN
                              : GI_CORAL,
                      }}
                    >
                      {Math.abs(b) < 0.01
                        ? "₹0"
                        : b > 0
                          ? `+${formatMoneyInr(b)}`
                          : `-${formatMoneyInr(b)}`}
                    </span>
                  ) : null}
                </button>
                {showAdminMenu ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 hover:bg-black/[0.06]"
                    style={{ color: GI_MUTED }}
                    aria-label={`Manage ${m.full_name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdminAction(m);
                    }}
                  >
                    <ThIconMoreDots size={18} className="text-current" />
                  </button>
                ) : null}
                </div>
              );
            })}
            {memberCount > 10 && !showAllMembers ? (
              <button
                type="button"
                className="mt-1 text-sm font-medium"
                style={{ color: "#f0a500" }}
                onClick={() => setShowAllMembers(true)}
              >
                Show all {memberCount}
              </button>
            ) : null}
            {showAllMembers && memberCount > 10 ? (
              <button
                type="button"
                className="mt-1 text-sm"
                style={{ color: GI_MUTED }}
                onClick={() => setShowAllMembers(false)}
              >
                Show less
              </button>
            ) : null}
          </div>

          {isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Group Validity
              </p>
              {firstTrip?.end_date ? (
                <p className="text-sm" style={{ color: GI_TEXT }}>
                  Expires: {formatTripBarDate(firstTrip.end_date)}
                </p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed" style={{ color: GI_MUTED }}>
                Admin can close group only after all balances are settled
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border py-2.5 text-sm"
                  style={{ borderColor: GI_SECTION_BORDER, color: GI_TEXT }}
                  onClick={() => void doCloseGroup()}
                >
                  Close Group
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={cardBase} style={cardStyle}>
            <p
              className="mb-2.5 text-[11px] font-bold uppercase"
              style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
            >
              Invite Link
            </p>
            {(() => {
              const code = group.invite_code ?? "";
              const origin =
                typeof window !== "undefined" ? window.location.origin : "";
              const link = code
                ? `${origin}/join?code=${encodeURIComponent(code)}`
                : "";
              const shareText = `Join ${group.name} on Group Travel: ${link}`;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 truncate text-sm"
                      style={{
                        background: GI_ACTION_BG,
                        color: GI_TEXT,
                        border: `1px solid ${GI_SECTION_BORDER}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                      title={link}
                    >
                      {link || (membersLoading ? "…" : "—")}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      disabled={!link}
                      onClick={async () => {
                        if (!link) return;
                        try {
                          await navigator.clipboard.writeText(link);
                          setLinkCopied(true);
                          if (copiedTimerRef.current)
                            clearTimeout(copiedTimerRef.current);
                          copiedTimerRef.current = setTimeout(
                            () => setLinkCopied(false),
                            2000,
                          );
                        } catch {
                          showToast("Could not copy link", "error");
                        }
                      }}
                    >
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px]" style={{ color: GI_MUTED }}>
                    Anyone with this link can request to join the group.
                    {code ? (
                      <>
                        {" "}
                        Code:{" "}
                        <span className="font-mono" style={{ color: GI_TEXT }}>
                          {code}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      disabled={!link}
                      onClick={async () => {
                        if (!link) return;
                        const nav = navigator as Navigator & {
                          share?: (data: {
                            title?: string;
                            text?: string;
                            url?: string;
                          }) => Promise<void>;
                        };
                        try {
                          if (typeof nav.share === "function") {
                            await nav.share({
                              title: group.name,
                              text: `Join ${group.name} on Group Travel`,
                              url: link,
                            });
                            return;
                          }
                          await nav.clipboard.writeText(link);
                          showToast("Link copied", "success");
                        } catch {
                          /* user cancelled or no share api */
                        }
                      }}
                    >
                      Share Link
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: "#25D366" }}
                      disabled={!link}
                      onClick={() => {
                        if (!link) return;
                        globalThis.open(
                          `https://wa.me/?text=${encodeURIComponent(shareText)}`,
                          "_blank",
                        );
                      }}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: "#2AABEE" }}
                      disabled={!link}
                      onClick={() => {
                        if (!link) return;
                        globalThis.open(
                          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Join ${group.name}`)}`,
                          "_blank",
                        );
                      }}
                    >
                      Telegram
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      onClick={() => void copyCode()}
                    >
                      {copiedCode ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="mb-2 rounded-[12px] p-4" style={cardStyle}>
            {isTravel && travelLeaveDisabled ? (
              <p
                className="mb-2 flex items-center gap-1.5 text-xs"
                style={{ color: GI_CORAL }}
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>
                  Cannot leave &mdash; ₹{Math.abs(myTripNet).toFixed(0)} pending
                </span>
              </p>
            ) : null}
            <button
              type="button"
              className="mb-2 w-full rounded-lg border py-2.5 text-sm font-semibold"
              style={{ borderColor: "#e17055", color: "#e17055" }}
              disabled={isTravel && travelLeaveDisabled}
              onClick={() => void doLeave()}
            >
              Leave Group
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="mb-2 w-full rounded-lg py-2.5 text-sm font-bold text-white"
                style={{ background: "#dc2626" }}
                onClick={() => void doCloseGroup()}
              >
                Delete Group
              </button>
            ) : null}
            <button
              type="button"
              className="w-full rounded-lg border py-2.5 text-sm"
              style={{ borderColor: GI_SECTION_BORDER, color: GI_MUTED }}
              onClick={() => {
                globalThis.alert("Report submitted. We'll review this group.");
              }}
            >
              Report Group
            </button>
          </div>
        </div>
      </div>

      {memberSheet && isTravel ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 p-0"
          onClick={() => {
            setMemberSheet(null);
            setMemberSheetDetail(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-4 shadow-xl"
            style={{ background: GI_CARD }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {memberSheet.avatar_url ? (
                  <img
                    src={memberSheet.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: listAvatarColor(memberSheet.full_name) }}
                  >
                    {initialsFromName(memberSheet.full_name)}
                  </span>
                )}
                <p className="text-base font-bold" style={{ color: GI_TEXT }}>
                  {memberSheet.full_name}
                </p>
              </div>
              <button
                type="button"
                className="p-1"
                style={{ color: GI_MUTED }}
                onClick={() => {
                  setMemberSheet(null);
                  setMemberSheetDetail(null);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm" style={{ color: GI_MUTED }}>
              Net balance with you:{" "}
              <span className="font-semibold" style={{ color: GI_TEXT }}>
                {memberSheetDetail
                  ? `₹${Number(memberSheetDetail.total_net).toFixed(2)}`
                  : "…"}
              </span>
            </p>
            <ul className="mt-2 max-h-32 custom-scrollbar overflow-y-auto text-sm">
              {(memberSheetDetail?.by_group ?? []).map((g) => (
                <li
                  key={g.group_id}
                  className="flex justify-between border-b py-1"
                  style={{ borderColor: GI_SECTION_BORDER }}
                >
                  <span style={{ color: GI_TEXT }}>{g.group_name}</span>
                  <span
                    className="font-mono"
                    style={{
                      color: g.net_amount > 0 ? GI_GREEN : g.net_amount < 0 ? GI_CORAL : GI_MUTED,
                    }}
                  >
                    ₹{g.net_amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white"
              style={{ background: GI_CORAL }}
              onClick={() => {
                const m = memberSheet;
                setMemberSheet(null);
                setMemberSheetDetail(null);
                void openDirectChat({
                  id: m.user_id,
                  full_name: m.full_name,
                  avatar_url: m.avatar_url ?? null,
                });
              }}
            >
              Message
            </button>
          </div>
        </div>
      ) : null}

      {adminAction ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setAdminAction(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 shadow-xl sm:rounded-2xl"
            style={{ background: GI_CARD }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              {adminAction.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={adminAction.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: listAvatarColor(adminAction.full_name) }}
                >
                  {initialsFromName(adminAction.full_name)}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: GI_TEXT }}
                >
                  {adminAction.full_name}
                </p>
                <p className="text-xs" style={{ color: GI_MUTED }}>
                  {String(adminAction.role) === "admin" ? "Admin" : "Member"}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                disabled={memberActionLoading}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                style={{ color: GI_TEXT }}
                onClick={() => {
                  const m = adminAction;
                  setAdminAction(null);
                  onClose();
                  void openDirectChat({
                    id: m.user_id,
                    full_name: m.full_name,
                    avatar_url: m.avatar_url ?? null,
                  });
                }}
              >
                Message {adminAction.full_name.split(" ")[0] || "member"}
              </button>
              {String(adminAction.role) === "admin" ? (
                <button
                  type="button"
                  disabled={memberActionLoading}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                  style={{ color: GI_TEXT }}
                  onClick={async () => {
                    const m = adminAction;
                    if (
                      !window.confirm(
                        `Demote ${m.full_name} to member?`,
                      )
                    )
                      return;
                    const ok = await setMemberRoleApi(m.user_id, "member");
                    if (ok) showToast("Member updated", "success");
                    setAdminAction(null);
                  }}
                >
                  Dismiss as admin
                </button>
              ) : (
                <button
                  type="button"
                  disabled={memberActionLoading}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                  style={{ color: GI_TEXT }}
                  onClick={async () => {
                    const m = adminAction;
                    const ok = await setMemberRoleApi(m.user_id, "admin");
                    if (ok)
                      showToast(
                        `${m.full_name} is now an admin`,
                        "success",
                      );
                    setAdminAction(null);
                  }}
                >
                  Make group admin
                </button>
              )}
              <div
                className="my-1 h-px w-full"
                style={{ background: GI_SECTION_BORDER }}
              />
              <button
                type="button"
                disabled={memberActionLoading}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                style={{ color: GI_CORAL }}
                onClick={async () => {
                  const m = adminAction;
                  if (
                    !window.confirm(
                      `Remove ${m.full_name} from ${group.name}?`,
                    )
                  )
                    return;
                  const ok = await removeMemberApi(m.user_id);
                  if (ok)
                    showToast(
                      `Removed ${m.full_name}`,
                      "success",
                    );
                  setAdminAction(null);
                }}
              >
                Remove from group
              </button>
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-lg border py-2 text-sm"
              style={{ borderColor: GI_SECTION_BORDER, color: GI_MUTED }}
              onClick={() => setAdminAction(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {reassignPickerOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReassignPickerOpen(false)}
        >
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-xl"
            style={{ background: GI_CARD, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4">
              <p
                className="text-base font-bold"
                style={{ color: GI_TEXT }}
              >
                Choose a new admin
              </p>
              <p className="mt-1 text-xs" style={{ color: GI_MUTED }}>
                You're the only admin of {group.name}. Promote a member, then
                you can leave.
              </p>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
              {(members ?? group.members)
                .filter((m) => m.user_id !== selfId)
                .map((m) => (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      disabled={memberActionLoading}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/[0.04] disabled:opacity-60"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Make ${m.full_name} the new admin and leave?`,
                          )
                        )
                          return;
                        void reassignAndLeave(m.user_id);
                      }}
                    >
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: listAvatarColor(m.full_name) }}
                        >
                          {initialsFromName(m.full_name)}
                        </span>
                      )}
                      <span
                        className="min-w-0 flex-1 truncate text-sm"
                        style={{ color: GI_TEXT }}
                      >
                        {m.full_name}
                      </span>
                      {String(m.role) === "admin" ? (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: "#f0a500",
                            color: GI_TEXT,
                          }}
                        >
                          Admin
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="flex justify-end border-t p-3" style={{ borderColor: GI_SECTION_BORDER }}>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{ color: GI_MUTED }}
                onClick={() => setReassignPickerOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export { GroupInfoPanel };
export type { GroupInfoPanelProps };
