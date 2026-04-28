"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart2,
  Calendar,
  Car,
  ClipboardList,
  Drama,
  Hotel,
  List,
  Menu,
  Music,
  Pill,
  Plane,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { getPreferredCurrency } from "@/lib/user-locale";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const GREEN = "#2ECC71";
const BORDER = "#E9ECEF";
const BG = "#F8F9FA";
const GROUP_CIRCLE_COLORS = ["#E94560", "#0F3460", "#2ECC71", "#F39C12"];

type UserOut = {
  id: string;
  full_name: string | null;
  email?: string | null;
  username?: string | null;
};

type GroupMemberOut = {
  user_id: string;
  full_name: string;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type TripWithGroup = TripOut & { group_name: string };

type ExpenseSplitOut = {
  id: string;
  user_id: string;
  amount: number;
  is_settled: boolean;
};

type ExpenseOut = {
  id: string;
  trip_id: string;
  paid_by: string;
  description: string;
  amount: number;
  currency: string;
  created_at: string;
  splits: ExpenseSplitOut[];
};

type BalanceLine = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type BalanceWithTrip = BalanceLine & {
  trip_id: string;
  trip_title: string;
  group_name: string;
};

type ExpenseWithTrip = ExpenseOut & {
  trip_title: string;
  group_name: string;
};

type ViewState =
  | { type: "overview" }
  | { type: "activity" }
  | { type: "group"; id: string }
  | { type: "friend"; id: string };

type MemberRow = {
  user_id: string;
  full_name: string;
  username?: string | null;
};

type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
};

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

function dicebearSrc(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (
    d.getDate() === y.getDate() &&
    d.getMonth() === y.getMonth() &&
    d.getFullYear() === y.getFullYear()
  ) {
    return "Yesterday";
  }
  const nowY = today.getFullYear();
  const dY = d.getFullYear();
  if (dY === nowY) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupExpensesByMonth(
  expenses: ExpenseWithTrip[],
): Map<string, ExpenseWithTrip[]> {
  const map = new Map<string, ExpenseWithTrip[]>();
  const sorted = [...expenses].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const e of sorted) {
    const d = new Date(e.created_at);
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function categoryIconComponent(category: string): LucideIcon {
  const c = category.toLowerCase().trim();
  const map: Record<string, LucideIcon> = {
    accommodation: Hotel,
    hotel: Hotel,
    transport: Car,
    food: Utensils,
    activities: Drama,
    activity: Drama,
    shopping: ShoppingBag,
    medical: Pill,
    flight: Plane,
    entertainment: Music,
    other: ClipboardList,
  };
  if (map[c]) return map[c]!;
  if (c.includes("food")) return Utensils;
  if (c.includes("hotel") || c.includes("accommodation")) return Hotel;
  if (c.includes("transport")) return Car;
  return ClipboardList;
}

function parseCategoryFromDescription(desc: string): string {
  const m = desc.match(/^\[([^\]]+)\]/);
  return m ? m[1]! : "other";
}

function stripCategoryPrefix(desc: string): string {
  return desc
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\n\nNotes:[\s\S]*$/, "");
}

function getPersonBalance(
  balances: BalanceWithTrip[],
  personId: string,
  currentUserId: string,
): number {
  let net = 0;
  for (const b of balances) {
    if (b.from_user_id === currentUserId && b.to_user_id === personId)
      net -= b.amount;
    if (b.from_user_id === personId && b.to_user_id === currentUserId)
      net += b.amount;
  }
  return Math.round(net * 100) / 100;
}

function firstLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

const shimmerBar = {
  background:
    "linear-gradient(90deg, #1e2538 25%, #2a3248 50%, #1e2538 75%)",
  backgroundSize: "200% 100%" as const,
  animation: "shimmer 1.5s infinite" as const,
  borderRadius: 8,
};

const Skeleton = ({
  width = "100%",
  height = 16,
}: {
  width?: string | number;
  height?: number;
}) => <div style={{ width, height, ...shimmerBar }} />;

const GROUP_BATCH = 5;

async function withStatusDeadline<T>(
  path: string,
  pageSignal: AbortSignal,
): Promise<{ data: T | null; status: number }> {
  const t = new AbortController();
  const timer = setTimeout(() => t.abort(), 8000);
  const onPageAbort = () => t.abort();
  pageSignal.addEventListener("abort", onPageAbort);
  try {
    if (pageSignal.aborted) return { data: null, status: 0 };
    return await apiFetchWithStatus<T>(path, { signal: t.signal });
  } finally {
    clearTimeout(timer);
    pageSignal.removeEventListener("abort", onPageAbort);
  }
}

export default function SplitActivitiesPage() {
  const router = useRouter();
  const loadAbortRef = useRef<AbortController | null>(null);
  const [user, setUser] = useState<UserOut | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [trips, setTrips] = useState<TripWithGroup[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseWithTrip[]>([]);
  const [allBalances, setAllBalances] = useState<BalanceWithTrip[]>([]);
  const [allMembers, setAllMembers] = useState<MemberRow[]>([]);
  const [view, setView] = useState<ViewState>({ type: "overview" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [settleTarget, setSettleTarget] = useState<BalanceWithTrip | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mobileTab, setMobileTab] = useState<
    "overview" | "activity" | "groups" | "friends"
  >("overview");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTripId, setFormTripId] = useState("");
  const [formCategory, setFormCategory] = useState("Food");
  const [formSplitUserIds, setFormSplitUserIds] = useState<string[]>([]);
  const [formPaidBy, setFormPaidBy] = useState("");
  const [formSplitMode, setFormSplitMode] = useState<
    "equal" | "exact" | "percent"
  >("equal");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [formNotes, setFormNotes] = useState("");
  const [formReceiptPreview, setFormReceiptPreview] = useState<string | null>(
    null,
  );
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [formCurrency, setFormCurrency] = useState("INR");
  const [inviteEmail, setInviteEmail] = useState("");

  const [settlePaidBy, setSettlePaidBy] = useState<"you" | "them">("you");
  const [settleAmountStr, setSettleAmountStr] = useState("");
  const [settleDate, setSettleDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [settling, setSettling] = useState(false);

  const showToast = useCallback((message: string, t: ToastState["type"]) => {
    setToast({ message, type: t });
    globalThis.setTimeout(() => setToast(null), 3000);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of allMembers) {
      m.set(mem.user_id, mem.full_name);
    }
    if (user?.id) m.set(user.id, user.full_name || "You");
    return m;
  }, [allMembers, user]);

  const loadData = useCallback(async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const pageSignal = ac.signal;
    setLoading(true);
    setLoadError(null);
    try {
      const [meRes, groupsRes] = await Promise.all([
        withStatusDeadline<UserOut>("/auth/me", pageSignal),
        withStatusDeadline<GroupOut[]>("/groups", pageSignal),
      ]);
      if (pageSignal.aborted) return;
      if (meRes.status === 401 || groupsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!meRes.data || !groupsRes.data) {
        setLoadError("Could not load data. Tap to retry.");
        return;
      }
      setUser(meRes.data);
      const gList = groupsRes.data;
      setGroups(gList);

      const curRes = await withStatusDeadline<CurrencyRow[]>(
        "/currencies",
        pageSignal,
      );
      if (!pageSignal.aborted && curRes.data?.length) {
        setCurrencies(curRes.data);
      }

      const memberMap = new Map<string, MemberRow>();
      for (const g of gList) {
        for (const m of g.members) {
          if (!memberMap.has(m.user_id)) {
            memberMap.set(m.user_id, {
              user_id: m.user_id,
              full_name: m.full_name,
            });
          }
        }
      }
      setAllMembers([...memberMap.values()]);

      const tripResults = await Promise.all(
        gList.map((g) =>
          withStatusDeadline<TripOut[]>(`/groups/${g.id}/trips`, pageSignal),
        ),
      );
      if (pageSignal.aborted) return;
      if (tripResults.some((r) => r.status === 401)) {
        handleUnauthorized();
        return;
      }

      const flatTrips: TripWithGroup[] = [];
      for (let i = 0; i < gList.length; i++) {
        const g = gList[i]!;
        const list = tripResults[i]?.data ?? [];
        for (const t of list) {
          flatTrips.push({ ...t, group_name: g.name });
        }
      }
      setTrips(flatTrips);

      if (flatTrips.length === 0) {
        setAllExpenses([]);
        setAllBalances([]);
        return;
      }

      const allExp: ExpenseWithTrip[] = [];
      const allBal: BalanceWithTrip[] = [];
      for (let i = 0; i < flatTrips.length; i += GROUP_BATCH) {
        if (pageSignal.aborted) return;
        const chunk = flatTrips.slice(i, i + GROUP_BATCH);
        const perChunk = await Promise.all(
          chunk.map((t) =>
            Promise.all([
              withStatusDeadline<ExpenseOut[]>(
                `/trips/${t.id}/expenses`,
                pageSignal,
              ),
              withStatusDeadline<BalanceLine[]>(
                `/trips/${t.id}/expenses/summary`,
                pageSignal,
              ),
            ]),
          ),
        );
        if (pageSignal.aborted) return;
        if (perChunk.some(([e, s]) => e.status === 401 || s.status === 401)) {
          handleUnauthorized();
          return;
        }
        for (let j = 0; j < chunk.length; j++) {
          const t = chunk[j]!;
          const [expRes, balRes] = perChunk[j]!;
          for (const e of expRes.data ?? []) {
            allExp.push({
              ...e,
              trip_title: t.title,
              group_name: t.group_name,
            });
          }
          for (const line of balRes.data ?? []) {
            allBal.push({
              ...line,
              trip_id: t.id,
              trip_title: t.title,
              group_name: t.group_name,
            });
          }
        }
      }

      if (!pageSignal.aborted) {
        setAllExpenses(allExp);
        setAllBalances(allBal);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setLoadError("Could not load data. Tap to retry.");
    } finally {
      if (!pageSignal.aborted) setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void loadData();
    return () => loadAbortRef.current?.abort();
  }, [loadData]);

  useEffect(() => {
    if (user?.id) setFormPaidBy(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (showAddForm) setFormCurrency(getPreferredCurrency());
  }, [showAddForm]);

  const summary = useMemo(() => {
    const uid = user?.id;
    let youOwe = 0;
    let youAreOwed = 0;
    if (uid) {
      for (const b of allBalances) {
        if (b.from_user_id === uid) youOwe += b.amount;
        if (b.to_user_id === uid) youAreOwed += b.amount;
      }
    }
    const totalBalance = youAreOwed - youOwe;
    return { youOwe, youAreOwed, totalBalance };
  }, [allBalances, user?.id]);

  const tripsInGroup = useCallback(
    (groupId: string) => trips.filter((t) => t.group_id === groupId),
    [trips],
  );

  const groupNetForUser = useCallback(
    (groupId: string, uid: string | undefined) => {
      if (!uid) return 0;
      const tids = new Set(tripsInGroup(groupId).map((t) => t.id));
      let net = 0;
      for (const b of allBalances) {
        if (!tids.has(b.trip_id)) continue;
        if (b.from_user_id === uid) net -= b.amount;
        if (b.to_user_id === uid) net += b.amount;
      }
      return Math.round(net * 100) / 100;
    },
    [allBalances, tripsInGroup],
  );

  const expensesForGroup = useCallback(
    (groupId: string) => {
      const tids = new Set(tripsInGroup(groupId).map((t) => t.id));
      return allExpenses.filter((e) => tids.has(e.trip_id));
    },
    [allExpenses, tripsInGroup],
  );

  const balancesForGroup = useCallback(
    (groupId: string) => {
      const tids = new Set(tripsInGroup(groupId).map((t) => t.id));
      return allBalances.filter((b) => tids.has(b.trip_id));
    },
    [allBalances, tripsInGroup],
  );

  const expensesWithFriend = useCallback(
    (friendId: string) => {
      const uid = user?.id;
      if (!uid) return [];
      return allExpenses.filter((e) => {
        const splitIds = new Set(e.splits.map((s) => s.user_id));
        const bothIn =
          splitIds.has(friendId) &&
          splitIds.has(uid) &&
          e.splits.length > 0;
        const payerInvolved =
          e.paid_by === friendId || e.paid_by === uid;
        return bothIn && payerInvolved;
      });
    },
    [allExpenses, user?.id],
  );

  const membersForSelectedTrip = useMemo(() => {
    const t = trips.find((x) => x.id === formTripId);
    if (!t) return [];
    const g = groups.find((x) => x.id === t.group_id);
    return g?.members ?? [];
  }, [formTripId, trips, groups]);

  useEffect(() => {
    if (!formTripId) return;
    const t = trips.find((x) => x.id === formTripId);
    const g = t ? groups.find((x) => x.id === t.group_id) : null;
    setFormSplitUserIds((g?.members ?? []).map((m) => m.user_id));
  }, [formTripId, trips, groups]);

  const splitPreviewEqual = useMemo(() => {
    const amt = parseFloat(formAmount);
    if (!Number.isFinite(amt) || amt <= 0 || formSplitUserIds.length === 0)
      return [] as { id: string; share: number }[];
    const n = formSplitUserIds.length;
    const per = Math.floor((amt / n) * 100) / 100;
    const out: { id: string; share: number }[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        out.push({
          id: formSplitUserIds[i]!,
          share: Math.round((amt - acc) * 100) / 100,
        });
      } else {
        out.push({ id: formSplitUserIds[i]!, share: per });
        acc += per;
      }
    }
    return out;
  }, [formAmount, formSplitUserIds]);

  function setViewState(next: ViewState) {
    setView(next);
    if (next.type === "overview") setMobileTab("overview");
    else if (next.type === "activity") setMobileTab("activity");
    else if (next.type === "group") setMobileTab("groups");
    else if (next.type === "friend") setMobileTab("friends");
  }

  async function submitExpense() {
    if (!formTripId) {
      showToast("Select a trip", "error");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    if (!formDesc.trim()) {
      showToast("Enter a description", "error");
      return;
    }
    if (formSplitUserIds.length === 0) {
      showToast("Choose who to split with", "error");
      return;
    }
    if (formSplitMode !== "equal") {
      showToast("Only equal split is supported by the API right now", "info");
      return;
    }

    let description = `[${formCategory}] ${formDesc.trim()}`;
    if (formNotes.trim()) {
      description = `${description}\n\nNotes: ${formNotes.trim()}`;
    }
    if (formReceiptPreview) {
      description = `${description}\n\n[receipt attached]`;
    }
    description = description.slice(0, 300);

    setSaving(true);
    try {
      await apiFetch(`/trips/${formTripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description,
          amount: amt,
          currency:
            formCurrency.trim().toUpperCase().slice(0, 10) || "INR",
          split_with: formSplitUserIds,
        }),
      });
      setShowAddForm(false);
      setFormDesc("");
      setFormAmount("");
      setFormNotes("");
      setFormReceiptPreview(null);
      setShowNotesPanel(false);
      setFormCategory("Food");
      showToast("Expense added!", "success");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      if (/401|unauthor/i.test(msg)) handleUnauthorized();
      else showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function runSettle(b: BalanceWithTrip) {
    setSettling(true);
    try {
      const exps = allExpenses.filter((e) => e.trip_id === b.trip_id);
      const fromId = b.from_user_id;
      const toId = b.to_user_id;
      const ids: string[] = [];
      for (const e of exps) {
        if (e.paid_by !== toId) continue;
        const sp = e.splits.find(
          (s) => s.user_id === fromId && !s.is_settled,
        );
        if (sp) ids.push(sp.id);
      }
      if (ids.length === 0) {
        for (const e of exps) {
          for (const sp of e.splits) {
            if (sp.user_id === fromId && !sp.is_settled) ids.push(sp.id);
          }
        }
      }
      for (const sid of ids) {
        await apiFetch(
          `/trips/${b.trip_id}/expenses/splits/${sid}/settle`,
          { method: "PATCH", body: "{}" },
        );
      }
      if (ids.length === 0) {
        showToast("No unsettled splits found", "info");
      } else {
        showToast("Settled!", "success");
      }
      setShowSettleForm(false);
      setSettleTarget(null);
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Settle failed";
      if (/401|unauthor/i.test(msg)) handleUnauthorized();
      else showToast(msg, "error");
    } finally {
      setSettling(false);
    }
  }

  function openSettle(b: BalanceWithTrip) {
    setSettleTarget(b);
    setSettleAmountStr(String(b.amount));
    setSettleDate(new Date().toISOString().slice(0, 10));
    setShowSettleForm(true);
  }

  function expenseRow(e: ExpenseWithTrip) {
    const uid = user?.id;
    const payerName = nameByUserId.get(e.paid_by) || "Someone";
    const mine = uid ? e.splits.find((s) => s.user_id === uid) : undefined;
    const cat = parseCategoryFromDescription(e.description);
    const CatIcon = categoryIconComponent(cat);
    const desc = stripCategoryPrefix(e.description);
    const dayStr = new Date(e.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    let rightTop = "";
    let rightBottom: { text: string; color: string } | null = null;

    if (uid && e.paid_by === uid) {
      rightTop = "you paid";
      const others = e.splits.filter((s) => s.user_id !== uid);
      const lent = others.reduce((a, s) => a + s.amount, 0);
      const firstOther = others[0];
      const lendName = firstOther
        ? nameByUserId.get(firstOther.user_id) || "someone"
        : "someone";
      if (lent > 0.001) {
        rightBottom = {
          text: `you lent ${lendName}`,
          color: GREEN,
        };
      }
    } else if (uid && mine) {
      rightTop = `${payerName} paid`;
      rightBottom = {
        text: "you borrowed",
        color: CORAL,
      };
    } else {
      rightTop = `${payerName} paid`;
    }

    return (
      <div
        key={e.id}
        className="flex gap-3 border-b border-[#f0f0f0] px-4 py-3 last:border-b-0"
      >
        <div className="w-12 shrink-0 pt-0.5 text-[11px] font-medium text-[#6C757D]">
          {dayStr}
        </div>
        <div className="text-lg leading-none text-[#6C757D]">
          <CatIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#2C3E50]">{desc}</p>
          <p className="text-[11px] text-[#6C757D]">{e.trip_title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-[#6C757D]">{rightTop}</p>
          <p className="text-[13px] font-semibold text-[#6C757D]">
            {formatCurrency(e.amount)}
          </p>
          {rightBottom ? (
            <p
              className="text-[12px] font-bold"
              style={{ color: rightBottom.color }}
            >
              {rightBottom.text}{" "}
              {mine && e.paid_by !== uid
                ? formatCurrency(mine.amount)
                : e.paid_by === uid && rightBottom.text.startsWith("you lent")
                  ? formatCurrency(
                      e.splits
                        .filter((s) => s.user_id !== uid)
                        .reduce((a, s) => a + s.amount, 0),
                    )
                  : ""}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const friendsList = useMemo(
    () => allMembers.filter((m) => m.user_id !== user?.id),
    [allMembers, user?.id],
  );

  const allSettledBanner =
    !loading &&
    groups.length > 0 &&
    allExpenses.length > 0 &&
    allBalances.length === 0 &&
    Math.abs(summary.totalBalance) < 0.01;

  function sidebarInner() {
    return (
      <div className="flex h-full min-h-0 flex-col p-4">
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setShowMobileSidebar(false);
          }}
          disabled={groups.length === 0}
          className="w-full rounded-lg py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: CORAL }}
        >
          + Add Expense
        </button>
        <button
          type="button"
          onClick={() => {
            showToast("Select a balance below to settle", "info");
            setShowMobileSidebar(false);
          }}
          className="mt-1.5 w-full rounded-lg border-[1.5px] bg-white py-2.5 text-[13px] font-bold text-[#2C3E50]"
          style={{ borderColor: BORDER }}
        >
          Settle up
        </button>

        <div className="mt-5 space-y-1">
          <button
            type="button"
            onClick={() => {
              setViewState({ type: "overview" });
              setShowMobileSidebar(false);
            }}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              view.type === "overview"
                ? "border-l-[3px] text-[#E94560]"
                : "border-l-[3px] border-transparent text-[#6C757D]"
            }`}
            style={
              view.type === "overview" ? { borderLeftColor: CORAL } : undefined
            }
          >
            <span className="inline-flex items-center gap-2">
              <BarChart2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Dashboard
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewState({ type: "activity" });
              setShowMobileSidebar(false);
            }}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              view.type === "activity"
                ? "border-l-[3px] text-[#E94560]"
                : "border-l-[3px] border-transparent text-[#6C757D]"
            }`}
            style={
              view.type === "activity" ? { borderLeftColor: CORAL } : undefined
            }
          >
            <span className="inline-flex items-center gap-2">
              <List className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Recent Activity
            </span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
            Groups
          </span>
          <Link
            href="/travel-hub"
            className="text-[10px] font-bold"
            style={{ color: CORAL }}
            onClick={() => setShowMobileSidebar(false)}
          >
            + add
          </Link>
        </div>
        <div className="mt-1 max-h-[28vh] space-y-0.5 overflow-y-auto lg:max-h-none">
          {groups.map((g, idx) => {
            const net = groupNetForUser(g.id, user?.id);
            const active = view.type === "group" && view.id === g.id;
            const color =
              GROUP_CIRCLE_COLORS[idx % GROUP_CIRCLE_COLORS.length]!;
            let balLine: ReactNode;
            if (Math.abs(net) < 0.01) {
              balLine = (
                <span className="text-[11px] text-[#6C757D]">settled up</span>
              );
            } else if (net < 0) {
              balLine = (
                <span className="text-[11px] font-medium" style={{ color: CORAL }}>
                  you owe {formatCurrency(Math.abs(net))}
                </span>
              );
            } else {
              balLine = (
                <span className="text-[11px] font-medium" style={{ color: GREEN }}>
                  you are owed {formatCurrency(net)}
                </span>
              );
            }
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setViewState({ type: "group", id: g.id });
                  setShowMobileSidebar(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                  active ? "bg-[#fff0f3]" : "hover:bg-[#f8f9fa]"
                }`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: color }}
                >
                  {firstLetter(g.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-bold"
                    style={{ color: NAVY }}
                  >
                    {g.name}
                  </p>
                  {balLine}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
            Friends
          </span>
          <button
            type="button"
            className="text-[10px] font-bold"
            style={{ color: CORAL }}
            onClick={() => showToast("Join groups to add friends", "info")}
          >
            + add
          </button>
        </div>
        <div className="mt-1 max-h-[22vh] space-y-0.5 overflow-y-auto lg:max-h-none">
          {friendsList.map((m) => {
            const bal = user?.id
              ? getPersonBalance(allBalances, m.user_id, user.id)
              : 0;
            const active = view.type === "friend" && view.id === m.user_id;
            const seed = m.username || m.full_name;
            let balText: ReactNode;
            if (Math.abs(bal) < 0.01) {
              balText = (
                <span className="text-[11px] text-[#6C757D]">settled up</span>
              );
            } else if (bal > 0) {
              balText = (
                <span className="text-[11px] font-medium" style={{ color: GREEN }}>
                  owes you {formatCurrency(bal)}
                </span>
              );
            } else {
              balText = (
                <span className="text-[11px] font-medium" style={{ color: CORAL }}>
                  you owe {formatCurrency(Math.abs(bal))}
                </span>
              );
            }
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => {
                  setViewState({ type: "friend", id: m.user_id });
                  setShowMobileSidebar(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                  active ? "bg-[#fff0f3]" : "hover:bg-[#f8f9fa]"
                }`}
              >
                <img
                  src={dicebearSrc(seed)}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full border border-[#E9ECEF]"
                  width={32}
                  height={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#2C3E50]">
                    {m.full_name}
                  </p>
                  {balText}
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="mt-auto rounded-xl p-3"
          style={{ background: "#e8f8f0" }}
        >
          <p className="text-xs font-bold text-green-800">Invite friends</p>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              placeholder="Email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                setInviteEmail("");
                showToast("Invite sent!", "success");
              }}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
              style={{ background: GREEN }}
            >
              Send invite
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: BG }}>
        <aside
          className="hidden w-[260px] shrink-0 border-r bg-white p-4 lg:block"
          style={{ borderColor: BORDER }}
        >
          <div className="space-y-2">
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
          <div className="mt-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={32} width="100%" />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-4 lg:p-6">
          <div className="mb-4 flex border-b bg-white py-3 lg:hidden" style={{ borderColor: BORDER }}>
            <span className="px-2 font-bold" style={{ color: NAVY }}>
              Splitwise
            </span>
          </div>
          <h1 className="text-[22px] font-bold" style={{ color: NAVY }}>
            Dashboard
          </h1>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <Skeleton height={20} width="40%" />
                <div className="mt-2">
                  <Skeleton height={28} width="3rem" />
                </div>
              </div>
            ))}
          </div>
          <h2 className="mb-3 mt-8 text-sm font-bold text-[#2C3E50]">Recent</h2>
          <div
            className="overflow-hidden rounded-xl border bg-white"
            style={{ borderColor: BORDER }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3 border-b border-[#f0f0f0] px-4 py-3 last:border-b-0"
              >
                <Skeleton height={12} width={32} />
                <Skeleton width={20} height={20} />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={12} width="40%" />
                </div>
                <Skeleton height={20} width={48} />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (loadError && !loading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6"
        style={{ background: BG }}
      >
        <p className="text-center text-sm" style={{ color: NAVY }}>
          Could not load data. Tap to retry.
        </p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-4 rounded-lg px-6 py-2.5 text-sm font-bold text-white"
          style={{ background: CORAL }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: BG }}>
        <Plane className="h-16 w-16 text-[#0F3460]" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 text-lg font-bold" style={{ color: NAVY }}>
          No groups yet
        </p>
        <p className="mt-1 max-w-sm text-center text-sm text-[#6C757D]">
          Create a group to start splitting
        </p>
        <button
          type="button"
          onClick={() => router.push("/travel-hub")}
          className="mt-6 rounded-lg px-6 py-3 text-sm font-bold text-white"
          style={{ background: CORAL }}
        >
          Create Group →
        </button>
        {toast ? <Toast toast={toast} /> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0" style={{ background: BG }}>
      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className="sticky top-0 hidden h-screen w-[260px] shrink-0 overflow-y-auto border-r bg-white lg:block"
          style={{ borderColor: BORDER }}
        >
          {sidebarInner()}
        </aside>

        <main className="min-w-0 flex-1">
          <div
            className="flex items-center gap-2 border-b bg-white px-4 py-3 lg:hidden"
            style={{ borderColor: BORDER }}
          >
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm font-bold"
              style={{ borderColor: BORDER }}
              onClick={() => setShowMobileSidebar(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <span className="font-bold" style={{ color: NAVY }}>
              Splitwise
            </span>
          </div>

          {view.type === "overview" ? (
            <OverviewSection
              summary={summary}
              allBalances={allBalances}
              allExpenses={allExpenses}
              user={user}
              nameByUserId={nameByUserId}
              expenseRow={expenseRow}
              groupExpensesByMonth={groupExpensesByMonth}
              onAddExpense={() => setShowAddForm(true)}
              onSettleInfo={() =>
                showToast("Tap Settle up on a balance row", "info")
              }
              onSettleRow={openSettle}
              onRemind={() => showToast("Reminder sent!", "success")}
              allSettledBanner={allSettledBanner}
              noExpenses={allExpenses.length === 0}
            />
          ) : null}

          {view.type === "activity" ? (
            <ActivitySection
              allExpenses={allExpenses}
              expenseRow={expenseRow}
              groupExpensesByMonth={groupExpensesByMonth}
            />
          ) : null}

          {view.type === "group" ? (
            <GroupSection
              group={groups.find((g) => g.id === view.id)}
              groupIndex={groups.findIndex((g) => g.id === view.id)}
              balances={balancesForGroup(view.id)}
              expenses={expensesForGroup(view.id)}
              user={user}
              nameByUserId={nameByUserId}
              expenseRow={expenseRow}
              groupExpensesByMonth={groupExpensesByMonth}
              onAddExpense={() => setShowAddForm(true)}
              onSettleInfo={() =>
                showToast("Tap Settle up on a balance row", "info")
              }
              onSettleRow={openSettle}
              onRemind={() => showToast("Reminder sent!", "success")}
            />
          ) : null}

          {view.type === "friend" ? (
            <FriendSection
              member={friendsList.find((m) => m.user_id === view.id)}
              user={user}
              balances={allBalances}
              expenses={expensesWithFriend(view.id)}
              nameByUserId={nameByUserId}
              expenseRow={expenseRow}
              groupExpensesByMonth={groupExpensesByMonth}
              onAddExpense={() => setShowAddForm(true)}
            />
          ) : null}
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-white lg:hidden"
        style={{ borderColor: BORDER }}
      >
        {(
          [
            ["overview", "Overview", () => setViewState({ type: "overview" })],
            ["activity", "Activity", () => setViewState({ type: "activity" })],
            ["groups", "Groups", () => setShowMobileSidebar(true)],
            ["friends", "Friends", () => setShowMobileSidebar(true)],
          ] as const
        ).map(([k, label, fn]) => (
          <button
            key={k}
            type="button"
            onClick={fn}
            className={`flex-1 py-3 text-[10px] font-bold ${
              mobileTab === k ? "text-[#E94560]" : "text-[#6C757D]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {showMobileSidebar ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[90] bg-black/50 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="fixed bottom-0 left-0 top-0 z-[100] w-[min(90vw,280px)] overflow-y-auto border-r bg-white shadow-xl lg:hidden">
            {sidebarInner()}
          </div>
        </>
      ) : null}

      {showAddForm ? (
        <AddExpenseSheet
          trips={trips}
          groups={groups}
          user={user}
          formDesc={formDesc}
          setFormDesc={setFormDesc}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formTripId={formTripId}
          setFormTripId={setFormTripId}
          formCategory={formCategory}
          setFormCategory={setFormCategory}
          formSplitUserIds={formSplitUserIds}
          setFormSplitUserIds={setFormSplitUserIds}
          formPaidBy={formPaidBy}
          setFormPaidBy={setFormPaidBy}
          formSplitMode={formSplitMode}
          setFormSplitMode={setFormSplitMode}
          formDate={formDate}
          setFormDate={setFormDate}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          formReceiptPreview={formReceiptPreview}
          setFormReceiptPreview={setFormReceiptPreview}
          showPeoplePicker={showPeoplePicker}
          setShowPeoplePicker={setShowPeoplePicker}
          peopleSearch={peopleSearch}
          setPeopleSearch={setPeopleSearch}
          showCategoryPicker={showCategoryPicker}
          setShowCategoryPicker={setShowCategoryPicker}
          showNotesPanel={showNotesPanel}
          setShowNotesPanel={setShowNotesPanel}
          membersForSelectedTrip={membersForSelectedTrip}
          allMembers={allMembers}
          nameByUserId={nameByUserId}
          splitPreviewEqual={splitPreviewEqual}
          saving={saving}
          formCurrency={formCurrency}
          setFormCurrency={setFormCurrency}
          currencies={currencies}
          onClose={() => setShowAddForm(false)}
          onSave={() => void submitExpense()}
        />
      ) : null}

      {showSettleForm && settleTarget ? (
        <SettleModal
          balance={settleTarget}
          user={user}
          nameByUserId={nameByUserId}
          settlePaidBy={settlePaidBy}
          setSettlePaidBy={setSettlePaidBy}
          settleAmountStr={settleAmountStr}
          setSettleAmountStr={setSettleAmountStr}
          settleDate={settleDate}
          setSettleDate={setSettleDate}
          settling={settling}
          onCancel={() => {
            setShowSettleForm(false);
            setSettleTarget(null);
          }}
          onSave={() => void runSettle(settleTarget)}
        />
      ) : null}

      {toast ? <Toast toast={toast} /> : null}
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  const bg =
    toast.type === "success"
      ? "bg-green-600"
      : toast.type === "error"
        ? "bg-red-600"
        : "bg-blue-600";
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[300] -translate-x-1/2 lg:bottom-8">
      <div
        className={`pointer-events-auto max-w-[min(92vw,400px)] rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-lg ${bg}`}
      >
        {toast.message}
      </div>
    </div>
  );
}

function OverviewSection({
  summary,
  allBalances,
  allExpenses,
  user,
  nameByUserId,
  expenseRow,
  groupExpensesByMonth,
  onAddExpense,
  onSettleInfo,
  onSettleRow,
  onRemind,
  allSettledBanner,
  noExpenses,
}: {
  summary: { totalBalance: number; youOwe: number; youAreOwed: number };
  allBalances: BalanceWithTrip[];
  allExpenses: ExpenseWithTrip[];
  user: UserOut | null;
  nameByUserId: Map<string, string>;
  expenseRow: (e: ExpenseWithTrip) => ReactNode;
  groupExpensesByMonth: (e: ExpenseWithTrip[]) => Map<string, ExpenseWithTrip[]>;
  onAddExpense: () => void;
  onSettleInfo: () => void;
  onSettleRow: (b: BalanceWithTrip) => void;
  onRemind: () => void;
  allSettledBanner: boolean;
  noExpenses: boolean;
}) {
  const uid = user?.id;
  const recent = useMemo(() => {
    const m = groupExpensesByMonth([...allExpenses].slice(0, 20));
    return m;
  }, [allExpenses, groupExpensesByMonth]);

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-bold" style={{ color: NAVY }}>
          Dashboard
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddExpense}
            className="rounded-lg px-4 py-2 text-[13px] font-bold text-white"
            style={{ background: CORAL }}
          >
            Add an expense
          </button>
          <button
            type="button"
            onClick={onSettleInfo}
            className="rounded-lg border bg-white px-4 py-2 text-[13px] font-bold text-[#2C3E50]"
            style={{ borderColor: BORDER }}
          >
            Settle up
          </button>
        </div>
      </div>

      {allSettledBanner ? (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center">
          <span className="inline-flex justify-center text-green-700">
            <Sparkles className="h-8 w-8" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-1 font-bold text-green-800">All settled up!</p>
          <p className="text-sm text-green-700">No pending balances</p>
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
          <p className="text-[10px] font-bold uppercase text-[#6C757D]">
            total balance
          </p>
          <p
            className="mt-1 text-xl font-extrabold"
            style={{
              color:
                Math.abs(summary.totalBalance) < 0.01
                  ? "#6C757D"
                  : summary.totalBalance > 0
                    ? GREEN
                    : CORAL,
            }}
          >
            {Math.abs(summary.totalBalance) < 0.01
              ? formatCurrency(0)
              : formatCurrency(summary.totalBalance)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
          <p className="text-[10px] font-bold uppercase text-[#6C757D]">you owe</p>
          <p className="mt-1 text-xl font-extrabold" style={{ color: CORAL }}>
            {formatCurrency(summary.youOwe)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
          <p className="text-[10px] font-bold uppercase text-[#6C757D]">
            you are owed
          </p>
          <p className="mt-1 text-xl font-extrabold" style={{ color: GREEN }}>
            {formatCurrency(summary.youAreOwed)}
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-bold text-[#2C3E50]">Who owes who</h2>
      <div
        className="mb-8 overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: BORDER }}
      >
        {allBalances.length === 0 ? (
          <p className="p-6 text-sm text-[#6C757D]">No balances yet.</p>
        ) : (
          allBalances.map((b, idx) => {
            const youOwe = uid === b.from_user_id;
            const otherId = youOwe ? b.to_user_id : b.from_user_id;
            const otherName = nameByUserId.get(otherId) || "Someone";
            return (
              <div
                key={`${b.trip_id}-${idx}`}
                className="flex flex-wrap items-center gap-3 border-b border-[#f5f5f5] px-4 py-3 last:border-b-0"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: youOwe ? CORAL : GREEN,
                  borderLeftStyle: "solid",
                }}
              >
                <img
                  src={dicebearSrc(otherId)}
                  alt=""
                  className="h-10 w-10 rounded-full border border-[#E9ECEF]"
                  width={40}
                  height={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#2C3E50]">
                    {youOwe ? `You owe ${otherName}` : `${otherName} owes you`}
                  </p>
                  <p className="text-[11px] text-[#6C757D]">
                    {b.trip_title} · {b.group_name}
                  </p>
                </div>
                <p
                  className="text-base font-extrabold"
                  style={{ color: youOwe ? CORAL : GREEN }}
                >
                  {formatCurrency(b.amount)}
                </p>
                {youOwe ? (
                  <button
                    type="button"
                    onClick={() => onSettleRow(b)}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                    style={{ background: CORAL }}
                  >
                    Settle up
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRemind}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                    style={{ background: GREEN }}
                  >
                    Remind
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <h2 className="mb-3 text-[15px] font-bold" style={{ color: NAVY }}>
        Recent
      </h2>
      {noExpenses ? (
        <div className="flex flex-col items-center rounded-xl border bg-white py-12 text-center" style={{ borderColor: BORDER }}>
          <span className="inline-flex justify-center text-[#0F3460]">
            <Banknote className="h-12 w-12" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-3 font-bold text-[#0F3460]">No expenses yet</p>
          <p className="mt-1 text-sm text-[#6C757D]">Add your first expense</p>
          <button
            type="button"
            onClick={onAddExpense}
            className="mt-4 rounded-lg px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: CORAL }}
          >
            + Add Expense
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          {[...recent.entries()].map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-2 border-b bg-[#fafafa] px-4 py-2" style={{ borderColor: BORDER }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
                  {month.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-[#E9ECEF]" />
              </div>
              {items.map((e) => expenseRow(e))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivitySection({
  allExpenses,
  expenseRow,
  groupExpensesByMonth,
}: {
  allExpenses: ExpenseWithTrip[];
  expenseRow: (e: ExpenseWithTrip) => ReactNode;
  groupExpensesByMonth: (e: ExpenseWithTrip[]) => Map<string, ExpenseWithTrip[]>;
}) {
  const grouped = useMemo(
    () => groupExpensesByMonth(allExpenses),
    [allExpenses, groupExpensesByMonth],
  );
  return (
    <div className="px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-[22px] font-bold" style={{ color: NAVY }}>
        Recent activity
      </h1>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
        {grouped.size === 0 ? (
          <p className="p-8 text-center text-sm text-[#6C757D]">No activity.</p>
        ) : (
          [...grouped.entries()].map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-2 border-b bg-[#fafafa] px-4 py-2" style={{ borderColor: BORDER }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
                  {month.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-[#E9ECEF]" />
              </div>
              {items.map((e) => expenseRow(e))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  groupIndex,
  balances,
  expenses,
  user,
  nameByUserId,
  expenseRow,
  groupExpensesByMonth,
  onAddExpense,
  onSettleInfo,
  onSettleRow,
  onRemind,
}: {
  group: GroupOut | undefined;
  groupIndex: number;
  balances: BalanceWithTrip[];
  expenses: ExpenseWithTrip[];
  user: UserOut | null;
  nameByUserId: Map<string, string>;
  expenseRow: (e: ExpenseWithTrip) => ReactNode;
  groupExpensesByMonth: (e: ExpenseWithTrip[]) => Map<string, ExpenseWithTrip[]>;
  onAddExpense: () => void;
  onSettleInfo: () => void;
  onSettleRow: (b: BalanceWithTrip) => void;
  onRemind: () => void;
}) {
  const uid = user?.id;
  const grouped = useMemo(
    () => groupExpensesByMonth(expenses),
    [expenses, groupExpensesByMonth],
  );
  const color =
    GROUP_CIRCLE_COLORS[
      groupIndex >= 0 ? groupIndex % GROUP_CIRCLE_COLORS.length : 0
    ]!;

  if (!group) {
    return (
      <div className="p-8 text-center text-[#6C757D]">Group not found.</div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: color }}
          >
            {firstLetter(group.name)}
          </span>
          <h1 className="text-[22px] font-bold" style={{ color: NAVY }}>
            {group.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddExpense}
            className="rounded-lg px-4 py-2 text-[13px] font-bold text-white"
            style={{ background: CORAL }}
          >
            Add expense
          </button>
          <button
            type="button"
            onClick={onSettleInfo}
            className="rounded-lg border bg-white px-4 py-2 text-[13px] font-bold"
            style={{ borderColor: BORDER }}
          >
            Settle up
          </button>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-bold text-[#2C3E50]">Balances</h2>
      <div
        className="mb-8 overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: BORDER }}
      >
        {balances.length === 0 ? (
          <p className="p-4 text-sm text-[#6C757D]">All settled in this group.</p>
        ) : (
          balances.map((b, idx) => {
            const youOwe = uid === b.from_user_id;
            const otherId = youOwe ? b.to_user_id : b.from_user_id;
            const otherName = nameByUserId.get(otherId) || "Someone";
            return (
              <div
                key={`${b.trip_id}-${idx}`}
                className="flex flex-wrap items-center gap-2 border-b border-[#f5f5f5] px-4 py-3 last:border-b-0"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: youOwe ? CORAL : GREEN,
                  borderLeftStyle: "solid",
                }}
              >
                <img
                  src={dicebearSrc(otherId)}
                  alt=""
                  className="h-9 w-9 rounded-full"
                  width={36}
                  height={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {youOwe ? `You owe ${otherName}` : `${otherName} owes you`}
                  </p>
                  <p className="text-[11px] text-[#6C757D]">{b.trip_title}</p>
                </div>
                <span
                  className="font-extrabold"
                  style={{ color: youOwe ? CORAL : GREEN }}
                >
                  {formatCurrency(b.amount)}
                </span>
                {youOwe ? (
                  <button
                    type="button"
                    onClick={() => onSettleRow(b)}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-white"
                    style={{ background: CORAL }}
                  >
                    Settle up
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRemind}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-white"
                    style={{ background: GREEN }}
                  >
                    Remind
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <h2 className="mb-2 text-sm font-bold text-[#2C3E50]">Expenses</h2>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
        {grouped.size === 0 ? (
          <p className="p-6 text-sm text-[#6C757D]">No expenses.</p>
        ) : (
          [...grouped.entries()].map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-2 border-b bg-[#fafafa] px-4 py-2" style={{ borderColor: BORDER }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
                  {month.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-[#E9ECEF]" />
              </div>
              {items.map((e) => expenseRow(e))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FriendSection({
  member,
  user,
  balances,
  expenses,
  nameByUserId,
  expenseRow,
  groupExpensesByMonth,
  onAddExpense,
}: {
  member: MemberRow | undefined;
  user: UserOut | null;
  balances: BalanceWithTrip[];
  expenses: ExpenseWithTrip[];
  nameByUserId: Map<string, string>;
  expenseRow: (e: ExpenseWithTrip) => ReactNode;
  groupExpensesByMonth: (e: ExpenseWithTrip[]) => Map<string, ExpenseWithTrip[]>;
  onAddExpense: () => void;
}) {
  const uid = user?.id;
  const net =
    member && uid
      ? getPersonBalance(balances, member.user_id, uid)
      : 0;
  const grouped = useMemo(
    () => groupExpensesByMonth(expenses),
    [expenses, groupExpensesByMonth],
  );

  if (!member) {
    return <div className="p-8 text-center text-[#6C757D]">Friend not found.</div>;
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={dicebearSrc(member.username || member.full_name)}
            alt=""
            className="h-14 w-14 rounded-full border-2 border-[#E9ECEF]"
            width={56}
            height={56}
          />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: NAVY }}>
              {member.full_name}
            </h1>
            <p className="text-xs text-[#6C757D]">
              {user?.id === member.user_id ? user?.email ?? "" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddExpense}
            className="rounded-lg px-4 py-2 text-[13px] font-bold text-white"
            style={{ background: CORAL }}
          >
            Add expense
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-xl border bg-white p-6 text-center shadow-sm" style={{ borderColor: BORDER }}>
        {Math.abs(net) < 0.01 ? (
          <>
            <p className="flex items-center justify-center gap-2 text-2xl font-extrabold text-[#6C757D]">
              <Sparkles className="h-7 w-7" strokeWidth={1.5} aria-hidden />
              Settled up
            </p>
          </>
        ) : net > 0 ? (
          <>
            <p className="text-3xl font-extrabold" style={{ color: GREEN }}>
              {formatCurrency(net)}
            </p>
            <p className="mt-1 text-sm font-semibold" style={{ color: GREEN }}>
              {member.full_name} owes you {formatCurrency(net)}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-extrabold" style={{ color: CORAL }}>
              {formatCurrency(Math.abs(net))}
            </p>
            <p className="mt-1 text-sm font-semibold" style={{ color: CORAL }}>
              You owe {member.full_name} {formatCurrency(Math.abs(net))}
            </p>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
        {grouped.size === 0 ? (
          <p className="p-6 text-sm text-[#6C757D]">No shared expenses.</p>
        ) : (
          [...grouped.entries()].map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-2 border-b bg-[#fafafa] px-4 py-2" style={{ borderColor: BORDER }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
                  {month.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-[#E9ECEF]" />
              </div>
              {items.map((e) => expenseRow(e))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SettleModal({
  balance,
  user,
  nameByUserId,
  settlePaidBy,
  setSettlePaidBy,
  settleAmountStr,
  setSettleAmountStr,
  settleDate,
  setSettleDate,
  settling,
  onCancel,
  onSave,
}: {
  balance: BalanceWithTrip;
  user: UserOut | null;
  nameByUserId: Map<string, string>;
  settlePaidBy: "you" | "them";
  setSettlePaidBy: (v: "you" | "them") => void;
  settleAmountStr: string;
  setSettleAmountStr: (v: string) => void;
  settleDate: string;
  setSettleDate: (v: string) => void;
  settling: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const uid = user?.id;
  const youOwe = uid === balance.from_user_id;
  const otherId = youOwe ? balance.to_user_id : balance.from_user_id;
  const otherName = nameByUserId.get(otherId) || "Someone";
  const titleLine = youOwe
    ? `You owe ${otherName} ${formatCurrency(balance.amount)}`
    : `${otherName} owes you ${formatCurrency(balance.amount)}`;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[120] bg-black/50"
        onClick={onCancel}
      />
      <div className="fixed left-1/2 top-1/2 z-[130] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl" style={{ borderRadius: 16 }}>
        <h3 className="text-lg font-bold text-[#0F3460]">Settle up</h3>
        <p className="mt-2 text-sm text-[#2C3E50]">{titleLine}</p>
        <p className="mt-4 text-xs font-bold uppercase text-[#6C757D]">
          Who paid
        </p>
        <select
          value={settlePaidBy}
          onChange={(e) =>
            setSettlePaidBy(e.target.value as "you" | "them")
          }
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: BORDER }}
        >
          <option value="you">You</option>
          <option value="them">{otherName}</option>
        </select>
        <label className="mt-3 block text-xs font-bold text-[#6C757D]">
          Amount
          <input
            type="number"
            value={settleAmountStr}
            onChange={(e) => setSettleAmountStr(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-lg font-bold"
            style={{ borderColor: BORDER }}
          />
        </label>
        <label className="mt-3 block text-xs font-bold text-[#6C757D]">
          Date
          <input
            type="date"
            value={settleDate}
            onChange={(e) => setSettleDate(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            style={{ borderColor: BORDER }}
          />
        </label>
        <button
          type="button"
          disabled={settling}
          onClick={onSave}
          className="mt-5 w-full rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: CORAL }}
        >
          {settling ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-2 text-sm text-[#6C757D]"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function AddExpenseSheet(props: {
  trips: TripWithGroup[];
  groups: GroupOut[];
  user: UserOut | null;
  formDesc: string;
  setFormDesc: (s: string) => void;
  formAmount: string;
  setFormAmount: (s: string) => void;
  formTripId: string;
  setFormTripId: (s: string) => void;
  formCategory: string;
  setFormCategory: (s: string) => void;
  formSplitUserIds: string[];
  setFormSplitUserIds: Dispatch<SetStateAction<string[]>>;
  formPaidBy: string;
  setFormPaidBy: (s: string) => void;
  formSplitMode: "equal" | "exact" | "percent";
  setFormSplitMode: (m: "equal" | "exact" | "percent") => void;
  formDate: string;
  setFormDate: (s: string) => void;
  formNotes: string;
  setFormNotes: (s: string) => void;
  formReceiptPreview: string | null;
  setFormReceiptPreview: (s: string | null) => void;
  showPeoplePicker: boolean;
  setShowPeoplePicker: (v: boolean) => void;
  peopleSearch: string;
  setPeopleSearch: (s: string) => void;
  showCategoryPicker: boolean;
  setShowCategoryPicker: (v: boolean) => void;
  showNotesPanel: boolean;
  setShowNotesPanel: (v: boolean) => void;
  membersForSelectedTrip: GroupMemberOut[];
  allMembers: MemberRow[];
  nameByUserId: Map<string, string>;
  splitPreviewEqual: { id: string; share: number }[];
  saving: boolean;
  formCurrency: string;
  setFormCurrency: (s: string) => void;
  currencies: CurrencyRow[];
  onClose: () => void;
  onSave: () => void;
}) {
  const {
    trips,
    groups,
    user,
    formDesc,
    setFormDesc,
    formAmount,
    setFormAmount,
    formTripId,
    setFormTripId,
    formCategory,
    setFormCategory,
    formSplitUserIds,
    setFormSplitUserIds,
    formPaidBy,
    setFormPaidBy,
    formSplitMode,
    setFormSplitMode,
    formDate,
    setFormDate,
    formNotes,
    setFormNotes,
    formReceiptPreview,
    setFormReceiptPreview,
    showPeoplePicker,
    setShowPeoplePicker,
    peopleSearch,
    setPeopleSearch,
    showCategoryPicker,
    setShowCategoryPicker,
    showNotesPanel,
    setShowNotesPanel,
    membersForSelectedTrip,
    allMembers,
    nameByUserId,
    splitPreviewEqual,
    saving,
    formCurrency,
    setFormCurrency,
    currencies,
    onClose,
    onSave,
  } = props;

  const amountSymbol =
    currencies.find((c) => c.code === formCurrency)?.symbol ?? formCurrency;

  const categories = [
    { key: "Food", Icon: Utensils },
    { key: "Hotel", Icon: Hotel },
    { key: "Transport", Icon: Car },
    { key: "Activity", Icon: Drama },
    { key: "Shopping", Icon: ShoppingBag },
    { key: "Medical", Icon: Pill },
    { key: "Flight", Icon: Plane },
    { key: "Other", Icon: ClipboardList },
  ] as const;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[100]"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[110] max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-24 pt-2 shadow-2xl lg:left-1/2 lg:max-w-lg lg:-translate-x-1/2">
        <div className="mx-auto mb-3 h-2 w-10 rounded-full bg-[#DEE2E6]" />
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold" style={{ color: NAVY }}>
            Add an expense
          </h2>
          <button type="button" onClick={onClose} className="text-xl text-[#6C757D]">
            ✕
          </button>
        </div>

        <p className="mt-4 text-xs font-bold text-[#6C757D]">With you and:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {formSplitUserIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border bg-[#F8F9FA] py-1 pl-1 pr-2 text-xs font-semibold"
              style={{ borderColor: BORDER }}
            >
              <img
                src={dicebearSrc(id)}
                alt=""
                className="h-6 w-6 rounded-full"
                width={24}
                height={24}
              />
              {nameByUserId.get(id) ?? id.slice(0, 6)}
              <button
                type="button"
                className="text-[#E94560]"
                onClick={() =>
                  setFormSplitUserIds((p) => p.filter((x) => x !== id))
                }
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setShowPeoplePicker(true)}
            className="rounded-full border border-dashed px-3 py-1 text-xs font-bold"
            style={{ borderColor: CORAL, color: CORAL }}
          >
            + add people
          </button>
        </div>

        {showPeoplePicker ? (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border p-3" style={{ borderColor: BORDER }}>
            <input
              placeholder="Search"
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: BORDER }}
            />
            <p className="text-[10px] font-bold uppercase text-[#6C757D]">Groups</p>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="mb-1 w-full rounded-lg bg-[#F8F9FA] py-2 text-left text-xs font-semibold"
                onClick={() => {
                  setFormSplitUserIds(g.members.map((m) => m.user_id));
                  const t = trips.find((x) => x.group_id === g.id);
                  if (t) setFormTripId(t.id);
                }}
              >
                {g.name} — select all
              </button>
            ))}
            <p className="mt-2 text-[10px] font-bold uppercase text-[#6C757D]">People</p>
            {allMembers
              .filter((m) =>
                m.full_name.toLowerCase().includes(peopleSearch.toLowerCase()),
              )
              .map((m) => (
                <label key={m.user_id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={formSplitUserIds.includes(m.user_id)}
                    onChange={() => {
                      setFormSplitUserIds((prev) =>
                        prev.includes(m.user_id)
                          ? prev.filter((x) => x !== m.user_id)
                          : [...prev, m.user_id],
                      );
                    }}
                  />
                  {m.full_name}
                </label>
              ))}
            <button
              type="button"
              onClick={() => setShowPeoplePicker(false)}
              className="mt-2 w-full py-1 text-xs font-bold text-[#E94560]"
            >
              Done
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryPicker(!showCategoryPicker)}
            className="text-2xl"
          >
            {(() => {
              const row = categories.find((c) => c.key === formCategory);
              const Ico = row?.Icon ?? ClipboardList;
              return <Ico className="h-7 w-7 text-[#6C757D]" strokeWidth={1.5} />;
            })()}
          </button>
          <input
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            className="min-w-0 flex-1 border-0 border-b py-2 text-base outline-none"
            style={{ borderColor: BORDER }}
            placeholder="Enter a description"
          />
        </div>
        {showCategoryPicker ? (
          <div className="mt-2 flex flex-wrap gap-2 rounded-xl border p-2" style={{ borderColor: BORDER }}>
            {categories.map((c) => {
              const Ico = c.Icon;
              return (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setFormCategory(c.key);
                  setShowCategoryPicker(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold"
              >
                <Ico className="h-4 w-4 text-[#6C757D]" strokeWidth={1.5} aria-hidden />
                {c.key}
              </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col items-center gap-2">
          {currencies.length > 0 ? (
            <label className="flex w-full max-w-[280px] flex-col gap-1 text-[10px] font-bold uppercase text-[#6C757D]">
              Currency
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full rounded-lg border px-2 py-2 text-sm font-semibold text-[#2C3E50]"
                style={{ borderColor: BORDER }}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex items-center justify-center gap-1">
            <span className="text-[28px] font-bold" style={{ color: CORAL }}>
              {amountSymbol}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className="max-w-[220px] border-0 bg-transparent text-center text-[32px] font-extrabold outline-none"
              style={{ color: NAVY }}
              placeholder="0.00"
            />
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-[#6C757D]">
          Paid by{" "}
          <select
            value={formPaidBy}
            onChange={(e) => setFormPaidBy(e.target.value)}
            className="font-bold text-[#0F3460] underline"
            disabled
            title="API records expense as paid by you"
          >
            <option value={user?.id}>you</option>
            {membersForSelectedTrip.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </select>{" "}
          and split{" "}
          <select
            value={formSplitMode}
            onChange={(e) =>
              setFormSplitMode(e.target.value as typeof formSplitMode)
            }
            className="font-bold text-[#0F3460] underline"
          >
            <option value="equal">equally</option>
            <option value="exact">by exact amounts</option>
            <option value="percent">by percentages</option>
          </select>
        </p>

        <div className="mt-4 rounded-xl bg-[#F8F9FA] p-3">
          <p className="text-[10px] font-bold uppercase text-[#6C757D]">
            Split preview
          </p>
          <ul className="mt-2 space-y-2">
            {splitPreviewEqual.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <img
                    src={dicebearSrc(row.id)}
                    alt=""
                    className="h-8 w-8 rounded-full"
                    width={32}
                    height={32}
                  />
                  {nameByUserId.get(row.id) ?? "—"}
                </span>
                <span className="font-bold">{formatCurrency(row.share)}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[#6C757D]">
          <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="rounded-lg border px-2 py-1"
            style={{ borderColor: BORDER }}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-[#6C757D]">Trip</span>
          <select
            value={formTripId}
            onChange={(e) => setFormTripId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: BORDER }}
          >
            <option value="">No group</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.group_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowNotesPanel(!showNotesPanel)}
          className="mt-4 w-full rounded-lg border py-2 text-sm font-semibold"
          style={{ borderColor: BORDER }}
        >
          Add notes or receipt
        </button>
        {showNotesPanel ? (
          <div className="mt-2 rounded-xl border p-3" style={{ borderColor: BORDER }}>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="w-full rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: BORDER }}
            />
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-2 w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () =>
                  setFormReceiptPreview(String(r.result ?? "").slice(0, 2000));
                r.readAsDataURL(f);
              }}
            />
            {formReceiptPreview ? (
              <p className="mt-2 text-[10px] text-[#6C757D]">Preview stored</p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-6 w-full rounded-lg py-3 text-[15px] font-bold text-white disabled:opacity-50"
          style={{ background: CORAL }}
        >
          {saving ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            "Save"
          )}
        </button>
      </div>
    </>
  );
}
