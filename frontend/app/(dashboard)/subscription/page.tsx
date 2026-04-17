"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  members: { id: string }[];
};

type MeOut = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
};

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";
function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ToastState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export default function SubscriptionPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((t: ToastState) => {
    setToastVisible(false);
    setToast(t);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setToastVisible(true));
    });
    window.setTimeout(() => {
      setToastVisible(false);
      window.setTimeout(() => setToast(null), 300);
    }, 3000);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const [m, p, g] = await Promise.all([
          apiFetch<MeOut>("/auth/me"),
          apiFetch<PlanOut>("/subscriptions/me"),
          apiFetch<GroupOut[]>("/groups"),
        ]);
        if (c) return;
        setMe(m);
        setPlan(p);
        setGroups(g);
        if (g.length > 0) {
          setSelectedGroupId((prev) => prev || g[0].id);
        }
      } catch {
        if (!c) showToast({ kind: "error", message: "Could not load data." });
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [showToast]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const memberCount = selectedGroup?.members?.length ?? 0;
  const canBuy = memberCount >= 2;

  async function buyPass(newPlan: "pass_3day" | "pass_7day" | "pro") {
    if (!selectedGroup) {
      showToast({ kind: "error", message: "Select a group first." });
      return;
    }
    if (!canBuy) {
      showToast({
        kind: "error",
        message: "Add at least 2 members before activating a pass.",
      });
      return;
    }
    setBuying(newPlan);
    try {
      await apiFetch<PlanOut>("/subscriptions/upgrade", {
        method: "POST",
        body: JSON.stringify({ new_plan: newPlan }),
      });
      const p = await apiFetch<PlanOut>("/subscriptions/me");
      setPlan(p);
      showToast({
        kind: "success",
        message: `Pass activated for ${selectedGroup.name}!`,
      });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Purchase failed.",
      });
    } finally {
      setBuying(null);
    }
  }

  const currentPlan = plan?.plan ?? "free";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6" style={{ color: "#2C3E50" }}>
      {/* Toast */}
      {toast ? (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            toastVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-8 opacity-0"
          } ${
            toast.kind === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {/* Header */}
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: NAVY }}>
          Upgrade Your Group
        </h1>
        <p className="mt-2 text-sm text-[#6C757D] md:text-base">
          Choose a plan for your whole group. Timer starts when admin activates Live
          Mode.
        </p>
      </header>

      {/* Current plan banner */}
      <div>
        {currentPlan === "free" && (
          <div className="rounded-xl border border-[#E9ECEF] bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-800">
            You are on the Free plan
          </div>
        )}
        {currentPlan === "pass_3day" && (
          <div
            className="rounded-xl border px-4 py-3 text-center text-sm font-medium text-white"
            style={{ borderColor: CORAL, backgroundColor: CORAL }}
          >
            <p>3-Day Pass active</p>
            <p className="mt-1 text-xs font-normal text-white/90">
              Expires: {formatDateLabel(plan?.current_period_end)}
            </p>
          </div>
        )}
        {currentPlan === "pass_7day" && (
          <div className="rounded-xl border border-[#0F3460] bg-[#e8f0fe] px-4 py-3 text-center text-sm font-medium text-[#0F3460]">
            <p>7-Day Pass active</p>
            <p className="mt-1 text-xs font-normal text-[#0F3460]/80">
              Expires: {formatDateLabel(plan?.current_period_end)}
            </p>
          </div>
        )}
        {(currentPlan === "pro" || currentPlan === "enterprise") && (
          <div className="rounded-xl border border-purple-200 bg-purple-100 px-4 py-3 text-center text-sm font-medium text-purple-900">
            <p>Pro — Unlimited</p>
            <p className="mt-1 text-xs font-normal text-purple-800/90">
              Member since {formatDateLabel(me?.created_at)}
            </p>
          </div>
        )}
      </div>

      {/* Group selector */}
      <section className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6C757D]">
          Select a group to upgrade
        </label>
        <select
          className="mt-2 w-full max-w-md rounded-lg border border-[#E9ECEF] bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#E94560] focus:ring-2 focus:ring-[#E94560]/20"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          {groups.length === 0 ? (
            <option value="">No groups yet</option>
          ) : (
            groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))
          )}
        </select>
        <p className="mt-2 text-sm text-[#6C757D]">
          {selectedGroup ? (
            <>
              <span className="font-semibold text-[#2C3E50]">{memberCount}</span>{" "}
              member{memberCount === 1 ? "" : "s"} in this group
            </>
          ) : (
            "Select a group to see member count."
          )}
        </p>
        {!canBuy && selectedGroup ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add at least 2 members before activating a pass
          </p>
        ) : null}
      </section>

      {/* Plan cards row 1 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Free */}
        <div
          className="flex flex-col rounded-xl border bg-white p-5 shadow-sm"
          style={{ borderColor: BORDER }}
        >
          <h2 className="text-lg font-bold text-gray-700">Free</h2>
          <p className="mt-2 text-3xl font-bold text-gray-800">{formatInr(0)}</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            <Feature ok>Create trips and groups</Feature>
            <Feature ok>Group polls and voting</Feature>
            <Feature ok>Expense splitting</Feature>
            <Feature ok>Save locations</Feature>
            <Feature ok>Travel feed</Feature>
            <Feature ok={false}>Live location sharing</Feature>
            <Feature ok={false}>Meeting points</Feature>
            <Feature ok={false}>Countdown timer</Feature>
            <Feature ok={false}>Weather forecast</Feature>
            <Feature ok={false}>Receipt scanner</Feature>
          </ul>
          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-xl border border-gray-200 bg-gray-100 py-2.5 text-sm font-semibold text-gray-500"
          >
            {currentPlan === "free" ? "Current Plan" : "Free tier"}
          </button>
        </div>

        {/* 3-Day */}
        <div
          className="relative flex flex-col rounded-xl border-2 bg-white p-5 shadow-sm"
          style={{ borderColor: CORAL }}
        >
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: CORAL }}
          >
            Most Popular
          </span>
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            3-Day Pass
          </h2>
          <p className="mt-2 text-3xl font-bold" style={{ color: CORAL }}>
            {formatInr(399)}
          </p>
          <p className="text-xs text-[#6C757D]">one-time</p>
          <p className="mt-1 text-xs text-[#6C757D]">
            Per person (5 members): ~{formatInr(80)}
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            <Feature ok>Everything in Free</Feature>
            <Feature ok>Live location sharing (3 days)</Feature>
            <Feature ok>Meeting point drop</Feature>
            <Feature ok>Countdown timer</Feature>
            <Feature ok>Weather forecast</Feature>
            <Feature ok>Push notifications</Feature>
            <Feature ok={false}>Receipt scanner</Feature>
            <Feature ok={false}>Memory album</Feature>
          </ul>
          <button
            type="button"
            disabled={!canBuy || buying !== null}
            onClick={() => buyPass("pass_3day")}
            className="mt-6 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: CORAL }}
          >
            {buying === "pass_3day" ? "Processing…" : "Buy 3-Day Pass"}
          </button>
        </div>

        {/* 7-Day */}
        <div
          className="flex flex-col rounded-xl border-2 bg-white p-5 shadow-sm"
          style={{ borderColor: NAVY }}
        >
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            7-Day Pass
          </h2>
          <p className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
            {formatInr(699)}
          </p>
          <p className="text-xs text-[#6C757D]">one-time</p>
          <p className="mt-1 text-xs text-[#6C757D]">
            Per person (5 members): ~{formatInr(140)}
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            <Feature ok>Everything in 3-Day Pass</Feature>
            <Feature ok>Live location (7 days)</Feature>
            <Feature ok>Receipt scanner</Feature>
            <Feature ok>Auto expense from photo</Feature>
            <Feature ok>Expense export PDF</Feature>
            <Feature ok={false}>Memory album</Feature>
            <Feature ok={false}>Unlimited trips</Feature>
          </ul>
          <button
            type="button"
            disabled={!canBuy || buying !== null}
            onClick={() => buyPass("pass_7day")}
            className="mt-6 w-full rounded-xl border-2 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: NAVY, backgroundColor: NAVY }}
          >
            {buying === "pass_7day" ? "Processing…" : "Buy 7-Day Pass"}
          </button>
        </div>
      </div>

      {/* Pro full width */}
      <div
        className="rounded-xl border-2 p-6 text-white shadow-md md:p-8"
        style={{
          borderColor: CORAL,
          background: `linear-gradient(135deg, ${CORAL} 0%, #c73652 100%)`,
        }}
      >
        <div className="md:flex md:items-start md:justify-between md:gap-8">
          <div>
            <h2 className="text-2xl font-bold">Pro</h2>
            <p className="mt-2 text-3xl font-bold">{formatInr(799)}/month</p>
            <p className="mt-1 text-sm text-white/90">Unlimited everything</p>
          </div>
          <div className="mt-6 grid flex-1 grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 md:mt-0">
            <FeatureLight>All 7-Day features</FeatureLight>
            <FeatureLight>Unlimited live sessions</FeatureLight>
            <FeatureLight>Trip memory album</FeatureLight>
            <FeatureLight>AI trip recap</FeatureLight>
            <FeatureLight>Unlimited group size</FeatureLight>
            <FeatureLight>Priority support</FeatureLight>
            <FeatureLight>Early access features</FeatureLight>
            <FeatureLight>Past trip replay</FeatureLight>
          </div>
        </div>
        <button
          type="button"
          disabled={!canBuy || buying !== null}
          onClick={() => buyPass("pro")}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-bold shadow-sm transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-50 md:max-w-xs"
          style={{ color: CORAL }}
        >
          {buying === "pro" ? "Processing…" : "Subscribe to Pro"}
        </button>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-[#F8F9FA]" style={{ borderColor: BORDER }}>
              <th className="px-4 py-3 text-left font-semibold text-[#2C3E50]">
                Feature
              </th>
              <th className="px-3 py-3 text-center font-semibold text-[#6C757D]">
                Free
              </th>
              <th className="px-3 py-3 text-center font-semibold" style={{ color: CORAL }}>
                3-Day
              </th>
              <th className="px-3 py-3 text-center font-semibold" style={{ color: NAVY }}>
                7-Day
              </th>
              <th className="px-3 py-3 text-center font-semibold text-purple-800">
                Pro
              </th>
            </tr>
          </thead>
          <tbody className="text-[#2C3E50]">
            <CmpRow feature="Live location" free="✗" d3="✓" d7="✓" pro="✓" />
            <CmpRow feature="Timer" free="✗" d3="✓" d7="✓" pro="✓" />
            <CmpRow feature="Weather" free="✗" d3="✓" d7="✓" pro="✓" />
            <CmpRow feature="Receipt scanner" free="✗" d3="✗" d7="✓" pro="✓" />
            <CmpRow feature="Memory album" free="✗" d3="✗" d7="✗" pro="✓" />
            <tr className="border-t" style={{ borderColor: BORDER }}>
              <td className="px-4 py-3 font-medium">Group size</td>
              <td className="px-3 py-3 text-center text-[#6C757D]">8</td>
              <td className="px-3 py-3 text-center text-[#6C757D]">8</td>
              <td className="px-3 py-3 text-center text-[#6C757D]">15</td>
              <td className="px-3 py-3 text-center font-semibold text-[#6C757D]">
                ∞
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Info note */}
      <div className="rounded-xl border border-[#E9ECEF] bg-gray-50 px-4 py-3 text-sm text-[#6C757D]">
        <p>
          ℹ️ The pass is bought for the whole group — all members get access
          instantly. The timer starts only when the group admin activates Live Mode
          for the first time.
        </p>
      </div>
    </div>
  );
}

function Feature({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="shrink-0 font-semibold"
        style={{ color: ok ? CORAL : "#ADB5BD" }}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-[#2C3E50]" : "text-[#ADB5BD]"}>{children}</span>
    </li>
  );
}

function FeatureLight({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 font-semibold text-white">✓</span>
      <span>{children}</span>
    </div>
  );
}

function CmpRow({
  feature,
  free,
  d3,
  d7,
  pro,
}: {
  feature: string;
  free: string;
  d3: string;
  d7: string;
  pro: string;
}) {
  const cell = (v: string) => (
    <span
      className="font-semibold"
      style={{ color: v === "✓" ? CORAL : "#ADB5BD" }}
    >
      {v}
    </span>
  );
  return (
    <tr className="border-t" style={{ borderColor: BORDER }}>
      <td className="px-4 py-3 font-medium">{feature}</td>
      <td className="px-3 py-3 text-center">{cell(free)}</td>
      <td className="px-3 py-3 text-center">{cell(d3)}</td>
      <td className="px-3 py-3 text-center">{cell(d7)}</td>
      <td className="px-3 py-3 text-center">{cell(pro)}</td>
    </tr>
  );
}
