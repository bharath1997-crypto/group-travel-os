"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const GREEN = "#2ECC71";

type UserOut = {
  id: string;
  full_name: string | null;
  email?: string | null;
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

function dicebearSrc(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.length === 3 ? currency : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function tripEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/beach|sea|ocean|island|coast/.test(t)) return "🏖️";
  if (/mountain|ski|hike|peak|alps/.test(t)) return "🏔️";
  if (/city|york|london|paris|tokyo/.test(t)) return "🏙️";
  if (/camp|forest|nature/.test(t)) return "🌲";
  return "✈️";
}

const CATEGORY_CIRCLES: { emoji: string; label: string }[] = [
  { emoji: "🍽️", label: "Food" },
  { emoji: "🏨", label: "Hotel" },
  { emoji: "🚗", label: "Transport" },
  { emoji: "🎭", label: "Activity" },
  { emoji: "🛍️", label: "Shopping" },
  { emoji: "💊", label: "Medical" },
  { emoji: "✈️", label: "Flight" },
  { emoji: "🎵", label: "Entertainment" },
  { emoji: "📦", label: "Other" },
];

export default function SplitActivitiesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [trips, setTrips] = useState<TripWithGroup[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithTrip[]>([]);
  const [balances, setBalances] = useState<BalanceWithTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [historyFilter, setHistoryFilter] = useState<
    "all" | "paid_by_me" | "i_owe" | "settled"
  >("all");

  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formTripId, setFormTripId] = useState("");
  const [formSplitType, setFormSplitType] = useState<
    "equal" | "custom" | "pct"
  >("equal");
  const [formCategory, setFormCategory] = useState<string>("Food");
  const [formSplitUserIds, setFormSplitUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [settleSheetLine, setSettleSheetLine] =
    useState<BalanceWithTrip | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ message, type });
      globalThis.setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const handleUnauthorized = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const mem of g.members) {
        m.set(mem.user_id, mem.full_name);
      }
    }
    if (user?.id) m.set(user.id, user.full_name || "You");
    return m;
  }, [groups, user]);

  const memberCount = useCallback(
    (trip: TripWithGroup) =>
      groups.find((g) => g.id === trip.group_id)?.members.length ?? 0,
    [groups],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, groupsRes] = await Promise.all([
        apiFetchWithStatus<UserOut>("/auth/me"),
        apiFetchWithStatus<GroupOut[]>("/groups"),
      ]);
      if (meRes.status === 401 || groupsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!meRes.data || !groupsRes.data) {
        showToast("Could not load data", "error");
        return;
      }
      setUser(meRes.data);
      setGroups(groupsRes.data);

      const tripResults = await Promise.all(
        groupsRes.data.map((g) =>
          apiFetchWithStatus<TripOut[]>(`/groups/${g.id}/trips`),
        ),
      );
      if (tripResults.some((r) => r.status === 401)) {
        handleUnauthorized();
        return;
      }

      const flatTrips: TripWithGroup[] = [];
      for (let i = 0; i < groupsRes.data.length; i++) {
        const g = groupsRes.data[i];
        const list = tripResults[i]?.data ?? [];
        for (const t of list) {
          flatTrips.push({ ...t, group_name: g.name });
        }
      }
      setTrips(flatTrips);

      if (flatTrips.length === 0) {
        setExpenses([]);
        setBalances([]);
        setLoading(false);
        return;
      }

      const perTrip = await Promise.all(
        flatTrips.map((t) =>
          Promise.all([
            apiFetchWithStatus<ExpenseOut[]>(`/trips/${t.id}/expenses`),
            apiFetchWithStatus<BalanceLine[]>(
              `/trips/${t.id}/expenses/summary`,
            ),
          ]),
        ),
      );

      if (perTrip.some(([e, s]) => e.status === 401 || s.status === 401)) {
        handleUnauthorized();
        return;
      }

      const allExp: ExpenseWithTrip[] = [];
      const allBal: BalanceWithTrip[] = [];

      for (let i = 0; i < flatTrips.length; i++) {
        const t = flatTrips[i];
        const [expRes, balRes] = perTrip[i]!;
        const exList = expRes.data ?? [];
        for (const e of exList) {
          allExp.push({
            ...e,
            trip_title: t.title,
            group_name: t.group_name,
          });
        }
        const lines = balRes.data ?? [];
        for (const line of lines) {
          allBal.push({
            ...line,
            trip_id: t.id,
            trip_title: t.title,
            group_name: t.group_name,
          });
        }
      }

      setExpenses(allExp);
      setBalances(allBal);
    } catch (e) {
      console.error(e);
      showToast(
        e instanceof Error ? e.message : "Failed to load split data",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (trips.length && !selectedTrip) {
      setSelectedTrip(trips[0]!.id);
    }
  }, [trips, selectedTrip]);

  const summary = useMemo(() => {
    const uid = user?.id;
    let totalYouOwe = 0;
    let totalOwedToYou = 0;
    if (uid) {
      for (const b of balances) {
        if (b.from_user_id === uid) totalYouOwe += b.amount;
        if (b.to_user_id === uid) totalOwedToYou += b.amount;
      }
    }
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const activeTrips = trips.filter((t) => t.status !== "completed").length;
    return { totalYouOwe, totalOwedToYou, totalSpent, activeTrips };
  }, [balances, expenses, trips, user?.id]);

  const tripNetForUser = useCallback(
    (tripId: string, uid: string | undefined) => {
      if (!uid) return 0;
      let net = 0;
      for (const b of balances) {
        if (b.trip_id !== tripId) continue;
        if (b.from_user_id === uid) net -= b.amount;
        if (b.to_user_id === uid) net += b.amount;
      }
      return net;
    },
    [balances],
  );

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 10);
  }, [expenses]);

  const tripStats = useMemo(() => {
    const uid = user?.id;
    return trips.map((t) => {
      const tex = expenses.filter((e) => e.trip_id === t.id);
      const total = tex.reduce((s, e) => s + e.amount, 0);
      let settledSplits = 0;
      let totalSplits = 0;
      for (const e of tex) {
        for (const sp of e.splits) {
          totalSplits += 1;
          if (sp.is_settled) settledSplits += 1;
        }
      }
      const pct =
        totalSplits > 0 ? Math.round((settledSplits / totalSplits) * 100) : 0;
      const net = tripNetForUser(t.id, uid);
      return {
        trip: t,
        total,
        settledPct: pct,
        count: tex.length,
        net,
        members: memberCount(t),
      };
    });
  }, [expenses, trips, user?.id, tripNetForUser, memberCount]);

  const netByPerson = useMemo(() => {
    const net = new Map<string, number>();
    for (const b of balances) {
      net.set(
        b.from_user_id,
        (net.get(b.from_user_id) ?? 0) - b.amount,
      );
      net.set(
        b.to_user_id,
        (net.get(b.to_user_id) ?? 0) + b.amount,
      );
    }
    return net;
  }, [balances]);

  const historyRows = useMemo(() => {
    const uid = user?.id;
    let list = [...expenses].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!uid) return list;
    if (historyFilter === "paid_by_me") {
      list = list.filter((e) => e.paid_by === uid);
    } else if (historyFilter === "i_owe") {
      list = list.filter((e) => {
        if (e.paid_by === uid) return false;
        const mine = e.splits.find((s) => s.user_id === uid);
        return mine && !mine.is_settled;
      });
    } else if (historyFilter === "settled") {
      list = list.filter((e) => e.splits.every((s) => s.is_settled));
    }
    return list;
  }, [expenses, historyFilter, user?.id]);

  const selectedTripData = useMemo(
    () => trips.find((t) => t.id === selectedTrip),
    [trips, selectedTrip],
  );

  const membersForFormTrip = useMemo(() => {
    const t = trips.find((x) => x.id === formTripId);
    if (!t) return [];
    const g = groups.find((x) => x.id === t.group_id);
    return g?.members ?? [];
  }, [formTripId, trips, groups]);

  useEffect(() => {
    if (!formTripId) return;
    const t = trips.find((x) => x.id === formTripId);
    const g = t ? groups.find((x) => x.id === t.group_id) : null;
    const ids = (g?.members ?? []).map((m) => m.user_id);
    setFormSplitUserIds(ids);
  }, [formTripId, trips, groups]);

  const splitPreview = useMemo(() => {
    const amt = parseFloat(formAmount);
    if (!Number.isFinite(amt) || amt <= 0 || formSplitUserIds.length === 0) {
      return [] as { userId: string; share: number }[];
    }
    const n = formSplitUserIds.length;
    const per = Math.floor((amt / n) * 100) / 100;
    const out: { userId: string; share: number }[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        out.push({
          userId: formSplitUserIds[i]!,
          share: round2(amt - acc),
        });
      } else {
        out.push({ userId: formSplitUserIds[i]!, share: per });
        acc += per;
      }
    }
    return out;
  }, [formAmount, formSplitUserIds]);

  function round2(n: number) {
    return Math.round(n * 100) / 100;
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
      showToast("Add a description", "error");
      return;
    }
    if (formSplitUserIds.length === 0) {
      showToast("Choose who splits this", "error");
      return;
    }

    const desc =
      formCategory && formCategory !== "Other"
        ? `[${formCategory}] ${formDesc.trim()}`
        : formDesc.trim();

    setSaving(true);
    try {
      await apiFetch(`/trips/${formTripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: desc,
          amount: amt,
          currency: formCurrency,
          split_with: formSplitUserIds,
        }),
      });
      setShowAddForm(false);
      setFormDesc("");
      setFormAmount("");
      setFormCategory("Food");
      setFormSplitType("equal");
      showToast("Expense added! 💸", "success");
      await loadData();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Could not save expense",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(tripId: string, expenseId: string) {
    try {
      await apiFetch(`/trips/${tripId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      showToast("Expense removed", "success");
      await loadData();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Could not delete",
        "error",
      );
    }
  }

  const tripExpensesFiltered = useMemo(() => {
    if (!selectedTrip) return [];
    return expenses
      .filter((e) => e.trip_id === selectedTrip)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [expenses, selectedTrip]);

  const tripBalanceLines = useMemo(() => {
    return balances.filter((b) => b.trip_id === selectedTrip);
  }, [balances, selectedTrip]);

  const noTrips = !loading && trips.length === 0;
  const noExpenses = !loading && trips.length > 0 && expenses.length === 0;
  const allSettled =
    !loading &&
    trips.length > 0 &&
    expenses.length > 0 &&
    balances.length === 0 &&
    summary.totalYouOwe < 0.01 &&
    summary.totalOwedToYou < 0.01;

  function openAddExpense() {
    setFormTripId(selectedTrip || trips[0]?.id || "");
    setShowAddForm(true);
  }

  function summaryCardsBlock() {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <div className="rounded-2xl border border-[#E9ECEF] bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
            You Owe
          </p>
          {summary.totalYouOwe < 0.01 ? (
            <p className="mt-2 text-2xl font-extrabold leading-tight text-[#2ECC71]">
              All clear! 🎉
            </p>
          ) : (
            <p
              className="mt-2 text-2xl font-extrabold leading-tight"
              style={{ color: CORAL }}
            >
              {formatMoney(summary.totalYouOwe)}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#E9ECEF] bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
            Owed to You
          </p>
          <p
            className="mt-2 text-2xl font-extrabold leading-tight"
            style={{ color: GREEN }}
          >
            {formatMoney(summary.totalOwedToYou)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E9ECEF] bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
            Total Spent
          </p>
          <p
            className="mt-2 text-2xl font-extrabold leading-tight"
            style={{ color: NAVY }}
          >
            {formatMoney(summary.totalSpent)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E9ECEF] bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6C757D]">
            Active Trips
          </p>
          <p
            className="mt-2 text-2xl font-extrabold leading-tight"
            style={{ color: NAVY }}
          >
            {summary.activeTrips}
          </p>
        </div>
      </div>
    );
  }

  function whoOwesBlock() {
    return (
      <section className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E9ECEF] px-5 py-3">
          <h2 className="text-[15px] font-bold text-[#0F3460]">
            ⚖️ Who owes who
          </h2>
          <button
            type="button"
            className="text-xs font-semibold text-[#E94560]"
            onClick={() => showToast("Settle all flow coming soon", "info")}
          >
            Settle all →
          </button>
        </div>
        {balances.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6C757D]">No balances yet.</p>
        ) : (
          balances.map((b, idx) => {
            const fromName = nameByUserId.get(b.from_user_id) || "Someone";
            const toName = nameByUserId.get(b.to_user_id) || "Someone";
            const youOwe = user?.id === b.from_user_id;
            return (
              <div
                key={`${b.trip_id}-${idx}`}
                className="flex flex-wrap items-center gap-3 border-b border-[#f5f5f5] px-5 py-3.5 last:border-b-0"
              >
                <img
                  src={dicebearSrc(b.from_user_id)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-[#E9ECEF] bg-[#F8F9FA]"
                  width={40}
                  height={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0F3460]">
                    {fromName} → {toName}
                  </p>
                  <p className="text-[11px] text-[#6C757D]">
                    {b.trip_title} · {b.group_name}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <p
                    className="text-lg font-extrabold"
                    style={{ color: youOwe ? CORAL : GREEN }}
                  >
                    {formatMoney(b.amount)}
                  </p>
                  {youOwe ? (
                    <button
                      type="button"
                      className="rounded-full border border-[#ffd6de] bg-[#fff0f3] px-3 py-1 text-[10px] font-bold text-[#E94560]"
                      onClick={() => setSettleSheetLine(b)}
                    >
                      Settle up
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-1 text-[10px] font-bold text-[#15803d]"
                      onClick={() =>
                        showToast("Reminder sent!", "success")
                      }
                    >
                      Remind
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-24 md:pb-8">
      <header className="mb-6 flex flex-col justify-between gap-4 border-b border-[#E9ECEF] bg-white px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h1
            className="text-[22px] font-extrabold leading-tight"
            style={{ color: NAVY }}
          >
            💸 Split Activities
          </h1>
          <p className="mt-0.5 text-[12px] text-[#6C757D]">
            Expenses across all your trips
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAddExpense()}
          disabled={noTrips}
          className="shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(233,69,96,0.3)] disabled:opacity-50"
          style={{ background: CORAL }}
        >
          + Add Expense
        </button>
      </header>

      {loading ? (
        <div className="space-y-4 px-1 sm:px-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`sk-s-${i}`}
                className="h-24 animate-pulse rounded-2xl bg-gray-200"
              />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`sk-b-${i}`}
                className="h-14 animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>
        </div>
      ) : noTrips ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E9ECEF] bg-white py-16 text-center shadow-sm">
          <span className="text-6xl">✈️</span>
          <p className="mt-4 text-lg font-bold text-[#0F3460]">No trips yet</p>
          <p className="mt-1 max-w-xs text-sm text-[#6C757D]">
            Create a trip to start splitting expenses
          </p>
          <Link
            href="/trips"
            className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
            style={{ background: CORAL }}
          >
            Create Trip →
          </Link>
        </div>
      ) : (
        <>
          {allSettled ? (
            <div className="mb-6 rounded-2xl border border-[#bbf7d0] bg-[#ecfdf5] px-5 py-4 text-center">
              <p className="text-2xl">🎉</p>
              <p className="mt-1 text-base font-bold text-[#15803d]">
                All settled up!
              </p>
              <p className="text-sm text-[#166534]">No pending balances</p>
            </div>
          ) : null}

          {noExpenses ? (
            <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-[#E9ECEF] bg-white py-14 text-center shadow-sm">
              <span className="text-5xl">💸</span>
              <p className="mt-4 text-lg font-bold text-[#0F3460]">
                No expenses yet
              </p>
              <p className="mt-1 max-w-xs text-sm text-[#6C757D]">
                Add your first group expense
              </p>
              <button
                type="button"
                onClick={() => openAddExpense()}
                className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
                style={{ background: CORAL }}
              >
                + Add Expense
              </button>
            </div>
          ) : null}

          {!noExpenses ? (
            <>
              <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[#E9ECEF] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    ["overview", "Overview"],
                    ["by_trip", "By Trip"],
                    ["balances", "Balances"],
                    ["history", "History"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      activeTab === key
                        ? "border-[#E94560] text-[#0F3460]"
                        : "border-transparent text-[#6C757D]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" ? (
                <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
                  <div className="order-2 space-y-8 lg:order-1 lg:col-span-3">
                    <section>
                      <h2 className="mb-3 text-base font-bold text-[#0F3460]">
                        📋 Recent activity
                      </h2>
                      <div className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white shadow-sm">
                        {recentExpenses.length === 0 ? (
                          <p className="px-5 py-6 text-sm text-[#6C757D]">
                            No activity yet.
                          </p>
                        ) : (
                          recentExpenses.map((e) => {
                            const uid = user?.id;
                            const mine = uid
                              ? e.splits.find((s) => s.user_id === uid)
                              : undefined;
                            const payerName =
                              nameByUserId.get(e.paid_by) || "Someone";
                            return (
                              <div
                                key={e.id}
                                className="flex gap-3 border-b border-[#f5f5f5] px-5 py-3 last:border-b-0"
                              >
                                <img
                                  src={dicebearSrc(e.paid_by)}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full border border-[#E9ECEF]"
                                  width={40}
                                  height={40}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-[#0F3460]">
                                    {payerName}{" "}
                                    <span className="font-semibold">
                                      paid for {e.description}
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-[#6C757D]">
                                    {e.trip_title} · split {e.splits.length}{" "}
                                    {e.splits.length === 1 ? "way" : "ways"} ·{" "}
                                    {timeAgo(e.created_at)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-bold text-[#0F3460]">
                                    {formatMoney(e.amount, e.currency)}
                                  </p>
                                  {mine ? (
                                    <p
                                      className="text-[11px] font-bold"
                                      style={{
                                        color: mine.is_settled
                                          ? GREEN
                                          : CORAL,
                                      }}
                                    >
                                      Your share:{" "}
                                      {formatMoney(mine.amount, e.currency)}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>

                    <section>
                      <h2 className="mb-3 text-base font-bold text-[#0F3460]">
                        ✈️ By trip
                      </h2>
                      <div className="space-y-2">
                        {tripStats.map(
                          ({
                            trip,
                            total,
                            settledPct,
                            count,
                            net,
                            members,
                          }) => (
                            <Link
                              key={trip.id}
                              href={`/trips/${trip.id}`}
                              className="mb-2 block cursor-pointer rounded-[14px] border border-[#E9ECEF] bg-white px-4 py-3.5 shadow-sm transition hover:border-[#E94560]/30"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <span className="text-3xl leading-none">
                                    {tripEmoji(trip.title)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-bold text-[#0F3460]">
                                      {trip.title}
                                    </p>
                                    <p className="text-[11px] text-[#6C757D]">
                                      {members} members · {formatMoney(total)}
                                    </p>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E9ECEF]">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${settledPct}%`,
                                          background: CORAL,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p
                                    className="text-sm font-extrabold"
                                    style={{
                                      color:
                                        net < -0.01
                                          ? CORAL
                                          : net > 0.01
                                            ? GREEN
                                            : "#6C757D",
                                    }}
                                  >
                                    {net > 0.01
                                      ? `+${formatMoney(net)}`
                                      : net < -0.01
                                        ? formatMoney(net)
                                        : "Even"}
                                  </p>
                                  <p className="text-[10px] text-[#6C757D]">
                                    balance
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ),
                        )}
                      </div>
                    </section>
                  </div>
                  <aside className="order-1 space-y-6 lg:order-2 lg:col-span-2">
                    {summaryCardsBlock()}
                    {whoOwesBlock()}
                  </aside>
                </div>
              ) : null}

              {activeTab === "overview" ? null : (
                <div className="mt-2 space-y-6">
                  {activeTab === "by_trip" ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-[#6C757D]">
                          Trip
                        </span>
                        <select
                          value={selectedTrip}
                          onChange={(e) => setSelectedTrip(e.target.value)}
                          className="w-full rounded-xl border border-[#E9ECEF] bg-white px-3 py-2.5 text-sm font-semibold text-[#0F3460]"
                        >
                          {trips.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.group_name})
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-2">
                        {tripExpensesFiltered.map((e) => {
                          const uid = user?.id;
                          const mine = uid
                            ? e.splits.find((s) => s.user_id === uid)
                            : undefined;
                          const payer =
                            nameByUserId.get(e.paid_by) || "—";
                          const canDelete = uid && e.paid_by === uid;
                          return (
                            <div
                              key={e.id}
                              className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm"
                            >
                              <span className="text-xl">💳</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[#0F3460]">
                                  {e.description}
                                </p>
                                <p className="text-[11px] text-[#6C757D]">
                                  Paid by {payer} ·{" "}
                                  {new Date(e.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">
                                  {formatMoney(e.amount, e.currency)}
                                </p>
                                {mine ? (
                                  <p className="text-[11px] text-[#6C757D]">
                                    Your share:{" "}
                                    {formatMoney(mine.amount, e.currency)}
                                  </p>
                                ) : null}
                              </div>
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="text-red-600"
                                  aria-label="Delete expense"
                                  onClick={() =>
                                    void deleteExpense(e.trip_id, e.id)
                                  }
                                >
                                  🗑️
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] p-4">
                        <h3 className="mb-2 text-sm font-bold text-[#0F3460]">
                          Balance summary · {selectedTripData?.title}
                        </h3>
                        {tripBalanceLines.length === 0 ? (
                          <p className="text-sm text-[#6C757D]">
                            No debts in this trip.
                          </p>
                        ) : (
                          <ul className="space-y-1 text-sm text-[#2C3E50]">
                            {tripBalanceLines.map((b, i) => (
                              <li key={i}>
                                {nameByUserId.get(b.from_user_id) || "?"} owes{" "}
                                {nameByUserId.get(b.to_user_id) || "?"} ·{" "}
                                {formatMoney(b.amount)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "balances" ? (
                    <div className="space-y-4">
                      <p className="text-sm text-[#6C757D]">
                        If everyone settles at once, here&apos;s the minimum
                        transactions across your trips.
                      </p>
                      <div className="space-y-3">
                        {Array.from(netByPerson.entries())
                          .filter(([, v]) => Math.abs(v) > 0.001)
                          .sort(
                            (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
                          )
                          .map(([uid, net]) => (
                            <div
                              key={uid}
                              className="flex items-center gap-3 rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm"
                            >
                              <img
                                src={dicebearSrc(uid)}
                                alt=""
                                className="h-11 w-11 rounded-full border border-[#E9ECEF]"
                                width={44}
                                height={44}
                              />
                              <div className="flex-1">
                                <p className="font-bold text-[#0F3460]">
                                  {nameByUserId.get(uid) || "Member"}
                                </p>
                                <p className="text-[11px] text-[#6C757D]">
                                  All trips
                                </p>
                              </div>
                              <p
                                className="text-sm font-extrabold"
                                style={{
                                  color: net >= 0 ? GREEN : CORAL,
                                }}
                              >
                                {net >= 0 ? "+" : ""}
                                {formatMoney(Math.abs(net))}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "history" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["all", "All"],
                            ["paid_by_me", "Paid by me"],
                            ["i_owe", "I owe"],
                            ["settled", "Settled"],
                          ] as const
                        ).map(([k, lab]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setHistoryFilter(k)}
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              historyFilter === k
                                ? "bg-[#0F3460] text-white"
                                : "bg-white text-[#6C757D] ring-1 ring-[#E9ECEF]"
                            }`}
                          >
                            {lab}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {historyRows.map((e) => {
                          const uid = user?.id;
                          const mine = uid
                            ? e.splits.find((s) => s.user_id === uid)
                            : undefined;
                          const allSettled = e.splits.every(
                            (s) => s.is_settled,
                          );
                          return (
                            <div
                              key={e.id}
                              className="rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm"
                            >
                              <div className="flex flex-wrap justify-between gap-2">
                                <div>
                                  <p className="text-[11px] font-bold text-[#6C757D]">
                                    {new Date(e.created_at).toLocaleString()}
                                  </p>
                                  <p className="font-bold text-[#0F3460]">
                                    {e.description}
                                  </p>
                                  <p className="text-[11px] text-[#6C757D]">
                                    {e.trip_title} · Paid by{" "}
                                    {nameByUserId.get(e.paid_by) || "—"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">
                                    {formatMoney(e.amount, e.currency)}
                                  </p>
                                  <span
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      allSettled
                                        ? "bg-green-100 text-green-800"
                                        : "bg-amber-100 text-amber-900"
                                    }`}
                                  >
                                    {allSettled ? "settled" : "pending"}
                                  </span>
                                </div>
                              </div>
                              {mine ? (
                                <p
                                  className="mt-2 text-xs font-semibold"
                                  style={{ color: CORAL }}
                                >
                                  Your share:{" "}
                                  {formatMoney(mine.amount, e.currency)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {settleSheetLine ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[120] bg-black/50"
            onClick={() => setSettleSheetLine(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[130] rounded-t-3xl border border-[#E9ECEF] bg-white p-6 shadow-2xl md:left-1/2 md:max-w-md md:-translate-x-1/2">
            <p className="text-center text-base font-bold text-[#0F3460]">
              How would you like to settle?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-xl border border-[#E9ECEF] bg-white py-3 text-sm font-bold text-[#0F3460]"
                onClick={() => {
                  const link = `https://travello.app/settle?to=${settleSheetLine.to_user_id}&amount=${settleSheetLine.amount}`;
                  void navigator.clipboard.writeText(link);
                  showToast("Payment link copied!", "success");
                  setSettleSheetLine(null);
                }}
              >
                💳 Copy Payment Link
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-[#E9ECEF] bg-white py-3 text-sm font-bold text-[#0F3460]"
                onClick={() => {
                  const text = encodeURIComponent(
                    `Hi! Please settle ${formatMoney(settleSheetLine.amount)} for our trip.`,
                  );
                  globalThis.open(`https://wa.me/?text=${text}`, "_blank");
                  setSettleSheetLine(null);
                }}
              >
                📱 Send via WhatsApp
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-[#bbf7d0] bg-[#ecfdf5] py-3 text-sm font-bold text-[#15803d]"
                onClick={() => {
                  showToast("Marked as settled ✓", "success");
                  setSettleSheetLine(null);
                }}
              >
                ✓ Mark as settled
              </button>
              <button
                type="button"
                className="w-full py-2 text-sm font-semibold text-[#6C757D]"
                onClick={() => setSettleSheetLine(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}

      {showAddForm ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[100] bg-black/60"
            onClick={() => setShowAddForm(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[110] max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-3 shadow-2xl md:left-1/2 md:max-w-lg md:-translate-x-1/2">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DEE2E6]" />
            <h2 className="text-center text-[18px] font-bold text-[#0F3460]">
              Add New Expense
            </h2>
            <p className="mt-1 text-center text-xs text-[#6C757D]">
              Split equally among selected members. Paid by you.
            </p>

            <label className="mt-6 block">
              <input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full border-0 border-b border-[#E9ECEF] px-0 py-3 text-base text-[#0F3460] outline-none placeholder:text-[#ADB5BD]"
                placeholder="What was this for?"
              />
            </label>

            <div className="mt-6 flex flex-col items-center">
              <div className="flex w-full max-w-xs items-center justify-center gap-1">
                <span
                  className="text-[28px] font-bold"
                  style={{ color: CORAL }}
                >
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-center text-[36px] font-extrabold outline-none placeholder:text-[#CED4DA]"
                  style={{ color: NAVY }}
                  placeholder="0.00"
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["USD", "INR", "EUR", "GBP", "AUD"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormCurrency(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      formCurrency === c
                        ? "bg-[#0F3460] text-white"
                        : "bg-[#F1F3F5] text-[#6C757D]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-6 block">
              <span className="mb-1 block text-xs font-bold text-[#6C757D]">
                For which trip?
              </span>
              <select
                value={formTripId}
                onChange={(e) => setFormTripId(e.target.value)}
                className="w-full rounded-xl border border-[#E9ECEF] bg-white px-3 py-3 text-sm font-semibold text-[#0F3460]"
              >
                <option value="">Select trip</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — {t.group_name}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-4 text-xs font-bold text-[#6C757D]">Split type</p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["equal", "Equal"],
                  ["custom", "Custom"],
                  ["pct", "%"],
                ] as const
              ).map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFormSplitType(k)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
                    formSplitType === k
                      ? "text-white"
                      : "bg-[#F8F9FA] text-[#6C757D]"
                  }`}
                  style={
                    formSplitType === k ? { background: CORAL } : undefined
                  }
                >
                  {lab}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-[#6C757D]">
              Split with (toggle members)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {membersForFormTrip.map((m) => {
                const on = formSplitUserIds.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => {
                      setFormSplitUserIds((prev) =>
                        on
                          ? prev.filter((id) => id !== m.user_id)
                          : [...prev, m.user_id],
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      on
                        ? "bg-[#0F3460] text-white"
                        : "bg-[#E9ECEF] text-[#6C757D]"
                    }`}
                  >
                    {m.full_name}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl bg-[#F1F3F5] p-3">
              <p className="text-[10px] font-bold uppercase text-[#6C757D]">
                Split preview
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {splitPreview.map((row) => (
                  <li
                    key={row.userId}
                    className="flex justify-between text-[#0F3460]"
                  >
                    <span>{nameByUserId.get(row.userId) || "Member"}</span>
                    <span className="font-bold">
                      {formatMoney(row.share, formCurrency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-xs font-bold text-[#6C757D]">Category</p>
            <div className="-mx-1 mt-2 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_CIRCLES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setFormCategory(c.label)}
                  className="flex w-[52px] shrink-0 flex-col items-center gap-1"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white text-xl ${
                      formCategory === c.label
                        ? "border-[#E94560]"
                        : "border-[#E9ECEF]"
                    }`}
                  >
                    {c.emoji}
                  </span>
                  <span className="text-center text-[9px] font-semibold text-[#6C757D]">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void submitExpense()}
              className="mt-6 flex w-full items-center justify-center rounded-[14px] py-4 text-[15px] font-bold text-white disabled:opacity-60"
              style={{ background: CORAL }}
            >
              {saving ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                "Save Expense"
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="mt-3 w-full py-2 text-center text-sm font-semibold text-[#6C757D]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] -translate-x-1/2">
          <div
            className={`pointer-events-auto max-w-[min(90vw,380px)] rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-lg ${
              toast.type === "success"
                ? "bg-[#2ECC71]"
                : toast.type === "info"
                  ? "bg-[#0F3460]"
                  : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
