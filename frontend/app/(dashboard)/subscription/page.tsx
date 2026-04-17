"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BG = "#F8F9FA";
const BORDER = "#E9ECEF";

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type GroupMemberOut = { id: string; user_id: string };
type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  members: GroupMemberOut[];
};

type MeOut = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
};

type ToastState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

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

function groupEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/(goa|beach|sea)/.test(n)) return "🏖️";
  if (/(manali|trek|himal)/.test(n)) return "🏔️";
  return "👥";
}

function passProgressPct(
  endIso: string | null,
  passDays: 3 | 7,
): number {
  if (!endIso) return 0;
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return 0;
  const durationMs = passDays * 24 * 60 * 60 * 1000;
  const start = end - durationMs;
  const now = Date.now();
  if (now >= end) return 0;
  if (now <= start) return 100;
  return Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100));
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeOut | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastIn, setToastIn] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [downgradeBusy, setDowngradeBusy] = useState(false);

  const showToast = useCallback((t: ToastState) => {
    if (!t) return;
    setToastIn(false);
    setToast(t);
    requestAnimationFrame(() => setToastIn(true));
    window.setTimeout(() => {
      setToastIn(false);
      window.setTimeout(() => setToast(null), 300);
    }, 4000);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      if (typeof window !== "undefined" && !getToken()) {
        clearToken();
        router.replace("/login");
        return;
      }
      setLoading(true);
      try {
        const [meRes, g, p] = await Promise.all([
          apiFetchWithStatus<MeOut>("/auth/me"),
          apiFetch<GroupOut[]>("/groups").catch(() => []),
          apiFetch<PlanOut>("/subscriptions/me").catch(() => null),
        ]);
        if (c) return;
        if (meRes.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        if (meRes.data) setMe(meRes.data);
        setGroups(g);
        setPlan(p);
        if (g.length > 0) {
          setSelectedGroupId((prev) => prev || g[0].id);
        }
      } catch {
        if (!c) showToast({ kind: "error", message: "Could not load subscription data." });
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [router, showToast]);

  const selectedGroup = useMemo(
    () => groups.find((x) => x.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const memberCount = selectedGroup?.members?.length ?? 0;
  const canBuy = memberCount >= 2;
  const currentPlan = plan?.plan ?? "free";

  async function buyPlan(newPlan: "pass_3day" | "pass_7day" | "pro") {
    if (!selectedGroup) {
      showToast({ kind: "error", message: "Select a group first." });
      return;
    }
    if (!canBuy) {
      showToast({
        kind: "error",
        message: "Add at least 2 members before purchasing a pass.",
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
      const gname = selectedGroup.name;
      if (newPlan === "pass_3day") {
        showToast({
          kind: "success",
          message: `🎉 3-Day Pass activated for ${gname}! All members now have access.`,
        });
      } else if (newPlan === "pass_7day") {
        showToast({
          kind: "success",
          message: `🎉 7-Day Pass activated for ${gname}! All members now have access.`,
        });
      } else {
        showToast({
          kind: "success",
          message: `⭐ Pro activated for ${gname}!`,
        });
      }
      window.setTimeout(() => router.push("/dashboard"), 1200);
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Purchase failed.",
      });
    } finally {
      setBuying(null);
    }
  }

  async function downgradeToFree() {
    setDowngradeBusy(true);
    try {
      const p = await apiFetch<PlanOut>("/subscriptions/cancel", {
        method: "POST",
      });
      setPlan(p);
      showToast({ kind: "success", message: "You are now on the Free plan." });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not downgrade.",
      });
    } finally {
      setDowngradeBusy(false);
    }
  }

  const p3 = passProgressPct(
    plan?.current_period_end ?? null,
    3,
  );
  const p7 = passProgressPct(plan?.current_period_end ?? null, 7);

  if (loading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-6"
      style={{ backgroundColor: BG, color: "#2C3E50" }}
    >
      {/* 1 Header */}
      <header
        className="rounded-2xl px-5 py-6 text-white shadow-md md:px-8 md:py-8"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1a4d7a 55%, #0a2540 100%)`,
        }}
      >
        <h1 className="text-[20px] font-bold leading-tight md:text-[22px]">
          Upgrade Your Group
        </h1>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-[rgba(255,255,255,0.7)]">
          Plans are bought for the whole group. Everyone gets access instantly. Timer
          starts when admin activates Live Mode.
        </p>
        <p className="mt-4 text-[11px] leading-relaxed text-white">
          ✓ Cancel anytime &nbsp; ✓ Instant activation &nbsp; ✓ All members benefit
        </p>
      </header>

      {/* 2 Current plan banner */}
      {currentPlan === "free" && (
        <div className="rounded-xl border border-[#DEE2E6] bg-gray-100 px-4 py-4 text-center">
          <p className="font-semibold text-gray-800">You are on the Free Plan</p>
          <p className="mt-1 text-sm text-gray-600">
            Upgrade to unlock live coordination features
          </p>
        </div>
      )}
      {currentPlan === "pass_3day" && (
        <div
          className="rounded-xl px-4 py-4 text-white shadow-sm"
          style={{ backgroundColor: CORAL }}
        >
          <p className="text-center font-bold">🎉 3-Day Pass Active</p>
          <p className="mt-1 text-center text-sm text-white/90">
            Expires: {formatDateLabel(plan?.current_period_end)}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${p3}%` }}
            />
          </div>
        </div>
      )}
      {currentPlan === "pass_7day" && (
        <div
          className="rounded-xl border-2 px-4 py-4 text-white shadow-sm"
          style={{ backgroundColor: NAVY, borderColor: NAVY }}
        >
          <p className="text-center font-bold">🎉 7-Day Pass Active</p>
          <p className="mt-1 text-center text-sm text-white/85">
            Expires: {formatDateLabel(plan?.current_period_end)}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${p7}%` }}
            />
          </div>
        </div>
      )}
      {(currentPlan === "pro" || currentPlan === "enterprise") && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-4 text-center text-purple-950">
          <p className="font-bold">⭐ Pro — Unlimited Access</p>
          <p className="mt-1 text-sm text-purple-900/90">
            Member since {formatDateLabel(me?.created_at)}
          </p>
          <p className="mt-1 text-xs text-purple-800">All features unlocked forever</p>
        </div>
      )}

      {/* 3 Group selector */}
      <section
        className="rounded-xl border bg-white p-4 shadow-sm md:p-5"
        style={{ borderColor: BORDER }}
      >
        <h2 className="text-sm font-bold" style={{ color: NAVY }}>
          Select group to upgrade
        </h2>
        <label className="mt-3 block text-xs font-semibold text-[#6C757D]">
          Group
        </label>
        <select
          className="mt-1 w-full max-w-lg rounded-lg border border-[#E9ECEF] bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#E94560] focus:ring-2 focus:ring-[#E94560]/20"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          {groups.length === 0 ? (
            <option value="">No groups yet</option>
          ) : (
            groups.map((g) => (
              <option key={g.id} value={g.id}>
                {groupEmoji(g.name)} {g.name} ({g.members?.length ?? 0} members)
              </option>
            ))
          )}
        </select>
        {selectedGroup ? (
          <div className="mt-3 text-sm">
            <p>
              <span className="font-semibold text-[#0F3460]">{memberCount}</span>{" "}
              members in this group
            </p>
            <p className="mt-1 text-[#6C757D]">
              Plan for your account:{" "}
              <span className="font-semibold capitalize text-[#2C3E50]">
                {currentPlan.replace("_", " ")}
              </span>{" "}
              (applies when you upgrade)
            </p>
          </div>
        ) : null}
        {!canBuy && selectedGroup ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p>
              ⚠️ Add at least 2 members before purchasing a pass
            </p>
            <Link
              href="/travel-hub"
              className="mt-2 inline-block text-sm font-semibold"
              style={{ color: CORAL }}
            >
              Invite Members →
            </Link>
          </div>
        ) : null}
      </section>

      {/* 4 Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Free */}
        <div
          className="flex flex-col rounded-xl border bg-white p-5 shadow-sm"
          style={{ borderColor: BORDER }}
        >
          <h3 className="text-lg font-bold text-gray-600">Free</h3>
          <p className="mt-2 text-[28px] font-bold text-gray-800">{formatInr(0)}</p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm">
            <Feat ok>Create trips and groups</Feat>
            <Feat ok>Group polls and voting</Feat>
            <Feat ok>Expense splitting</Feat>
            <Feat ok>Save locations</Feat>
            <Feat ok>Travel feed and explore</Feat>
            <Feat ok>Up to 8 members per group</Feat>
            <Feat ok={false}>Live location sharing</Feat>
            <Feat ok={false}>Meeting points and timer</Feat>
            <Feat ok={false}>Weather forecast</Feat>
            <Feat ok={false}>Receipt scanner</Feat>
            <Feat ok={false}>Memory album</Feat>
          </ul>
          <button
            type="button"
            disabled={currentPlan === "free"}
            className="mt-6 w-full rounded-lg border border-gray-200 bg-gray-100 py-2.5 text-sm font-semibold text-gray-500 disabled:cursor-default disabled:opacity-90"
          >
            {currentPlan === "free" ? "Current Plan" : "Free tier"}
          </button>
          {currentPlan !== "free" ? (
            <button
              type="button"
              disabled={downgradeBusy}
              onClick={() => void downgradeToFree()}
              className="mt-2 text-center text-xs font-medium text-gray-500 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {downgradeBusy ? "Working…" : "Downgrade to Free"}
            </button>
          ) : null}
        </div>

        {/* 3-Day */}
        <div
          className="relative flex flex-col rounded-xl border-2 bg-white p-5 pt-6 shadow-sm"
          style={{ borderColor: CORAL }}
        >
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: CORAL }}
          >
            Most Popular
          </span>
          <h3 className="text-lg font-bold" style={{ color: CORAL }}>
            3-Day Pass
          </h3>
          <p className="mt-2 text-[28px] font-bold" style={{ color: CORAL }}>
            {formatInr(399)}
          </p>
          <p className="text-[11px] text-[#6C757D]">one-time</p>
          <p className="mt-1 text-[11px] text-[#6C757D]">
            ≈ {formatInr(80)} per person (5 members)
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm">
            <Feat ok>Everything in Free</Feat>
            <Feat ok>Live location sharing — 3 days</Feat>
            <Feat ok>Meeting point drop</Feat>
            <Feat ok>Countdown timer</Feat>
            <Feat ok>Weather forecast</Feat>
            <Feat ok>Push notifications</Feat>
            <Feat ok>Up to 8 members per group</Feat>
            <Feat ok={false}>Receipt scanner</Feat>
            <Feat ok={false}>Expense export PDF</Feat>
            <Feat ok={false}>Memory album</Feat>
          </ul>
          <button
            type="button"
            disabled={!canBuy || buying !== null}
            onClick={() => void buyPlan("pass_3day")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: CORAL }}
          >
            {buying === "pass_3day" ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Buy 3-Day Pass
          </button>
        </div>

        {/* 7-Day */}
        <div
          className="relative flex flex-col rounded-xl border-2 bg-white p-5 pt-6 shadow-sm"
          style={{ borderColor: NAVY }}
        >
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: NAVY }}
          >
            Best Value
          </span>
          <h3 className="text-lg font-bold" style={{ color: NAVY }}>
            7-Day Pass
          </h3>
          <p className="mt-2 text-[28px] font-bold" style={{ color: NAVY }}>
            {formatInr(699)}
          </p>
          <p className="text-[11px] text-[#6C757D]">one-time</p>
          <p className="mt-1 text-[11px] text-[#6C757D]">
            ≈ {formatInr(140)} per person (5 members)
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm">
            <Feat ok>Everything in 3-Day Pass</Feat>
            <Feat ok>Live location sharing — 7 days</Feat>
            <Feat ok>Up to 15 members per group</Feat>
            <Feat ok>Receipt scanner</Feat>
            <Feat ok>Auto expense from photo</Feat>
            <Feat ok>Expense export PDF</Feat>
            <Feat ok={false}>Memory album</Feat>
            <Feat ok={false}>Unlimited group size</Feat>
          </ul>
          <button
            type="button"
            disabled={!canBuy || buying !== null}
            onClick={() => void buyPlan("pass_7day")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: NAVY, backgroundColor: NAVY }}
          >
            {buying === "pass_7day" ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Buy 7-Day Pass
          </button>
        </div>
      </div>

      {/* 5 Pro full width */}
      <section
        className="overflow-hidden rounded-2xl border-2 p-6 text-white shadow-lg md:p-8"
        style={{
          borderColor: "#1e3a5f",
          background: `linear-gradient(135deg, ${NAVY} 0%, #0a1628 100%)`,
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="max-w-md">
            <h3 className="text-[20px] font-bold">⭐ Pro</h3>
            <p className="mt-2 text-[28px] font-bold">{formatInr(799)}/month</p>
            <p className="mt-1 text-[13px] text-white/90">Unlimited everything</p>
            <button
              type="button"
              disabled={!canBuy || buying !== null}
              onClick={() => void buyPlan("pro")}
              className="mt-5 w-full rounded-xl bg-white px-6 py-3 text-sm font-bold shadow-md transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              style={{ color: CORAL }}
            >
              {buying === "pro" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E94560] border-t-transparent" />
                  Processing…
                </span>
              ) : (
                "Subscribe to Pro"
              )}
            </button>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <ProFeat>All 7-Day Pass features</ProFeat>
            <ProFeat>Unlimited live sessions</ProFeat>
            <ProFeat>Unlimited group size</ProFeat>
            <ProFeat>Trip memory album</ProFeat>
            <ProFeat>AI trip recap</ProFeat>
            <ProFeat>Past trip replay</ProFeat>
            <ProFeat>Priority support</ProFeat>
            <ProFeat>Early access features</ProFeat>
            <ProFeat>Profile analytics</ProFeat>
            <ProFeat>Custom profile URL</ProFeat>
            <ProFeat>Encrypted data backup</ProFeat>
            <ProFeat>Google Drive backup</ProFeat>
          </div>
        </div>
      </section>

      {/* 6 Comparison table */}
      <section
        className="overflow-x-auto rounded-xl border bg-white shadow-sm"
        style={{ borderColor: BORDER }}
      >
        <h3 className="border-b px-4 py-3 text-sm font-bold" style={{ color: NAVY, borderColor: BORDER }}>
          Compare all plans
        </h3>
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: NAVY }} className="text-white">
              <th className="px-3 py-2.5 text-left text-xs font-bold">Feature</th>
              <th className="px-2 py-2.5 text-center text-xs font-bold">Free</th>
              <th className="px-2 py-2.5 text-center text-xs font-bold">3-Day</th>
              <th className="px-2 py-2.5 text-center text-xs font-bold">7-Day</th>
              <th className="bg-purple-100 px-2 py-2.5 text-center text-xs font-bold text-purple-900">
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            <CmpRow rowIndex={0} feature="Group size" cells={["8", "8", "15", "∞"]} />
            <CmpRow
              rowIndex={1}
              feature="Live location"
              cells={["✗", "3 days", "7 days", "✓"]}
            />
            <CmpRow rowIndex={2} feature="Timer" cells={["✗", "✓", "✓", "✓"]} />
            <CmpRow rowIndex={3} feature="Weather" cells={["✗", "✓", "✓", "✓"]} />
            <CmpRow
              rowIndex={4}
              feature="Receipt scanner"
              cells={["✗", "✗", "✓", "✓"]}
            />
            <CmpRow rowIndex={5} feature="PDF export" cells={["✗", "✗", "✓", "✓"]} />
            <CmpRow
              rowIndex={6}
              feature="Memory album"
              cells={["✗", "✗", "✗", "✓"]}
            />
            <CmpRow rowIndex={7} feature="Backup" cells={["✗", "✗", "✗", "✓"]} />
            <CmpRow rowIndex={8} feature="Custom URL" cells={["✗", "✗", "✗", "✓"]} />
          </tbody>
        </table>
      </section>

      {/* 7 Info */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950">
        <p className="font-semibold">ℹ️ How group passes work</p>
        <ul className="mt-2 list-none space-y-2 text-sky-900/90">
          <li>→ Any member of the group can purchase a pass for the group</li>
          <li>→ All members get access instantly after purchase</li>
          <li>
            → The countdown timer starts only when the group admin activates Live Mode
            for the first time
          </li>
          <li>→ Minimum 2 members required to activate</li>
          <li>→ Passes cannot be transferred between groups</li>
        </ul>
      </div>

      {/* 8 FAQ */}
      <section
        className="rounded-xl border bg-white shadow-sm"
        style={{ borderColor: BORDER }}
      >
        <h3 className="border-b px-4 py-3 text-sm font-bold" style={{ color: NAVY, borderColor: BORDER }}>
          FAQ
        </h3>
        <ul className="divide-y" style={{ borderColor: BORDER }}>
          {FAQ.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setFaqOpen((v) => (v === i ? null : i))}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="font-bold" style={{ color: NAVY }}>
                  {item.q}
                </span>
                <span
                  className={`shrink-0 text-lg text-[#6C757D] transition-transform ${
                    faqOpen === i ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ›
                </span>
              </button>
              {faqOpen === i ? (
                <div className="px-4 pb-3 text-sm leading-relaxed text-[#6C757D]">
                  {item.a}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Toast — bottom of page flow (not position:fixed) */}
      {toast ? (
        <div className="mx-auto flex w-full max-w-md justify-center px-2 pb-4 pt-2">
          <div
            role="status"
            className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg transition-all duration-300 ${
              toast.kind === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            style={{
              opacity: toastIn ? 1 : 0,
              transform: toastIn ? "translateY(0)" : "translateY(8px)",
            }}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FAQ = [
  {
    q: "Can I buy another pass after mine expires?",
    a: "Yes. You can purchase a new pass anytime. Your trip data is never deleted.",
  },
  {
    q: "What happens when the pass expires?",
    a: "Live features lock again. All planning features (trips, polls, expenses) remain fully accessible forever.",
  },
  {
    q: "Who can buy a pass for the group?",
    a: "Any member of the group can purchase. The benefits apply to everyone.",
  },
  {
    q: "Is there a refund policy?",
    a: "Passes are non-refundable once activated. Contact support if you have issues.",
  },
] as const;

function Feat({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="shrink-0 font-bold"
        style={{ color: ok ? CORAL : "#d1d5db" }}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-[#2C3E50]" : "text-[#9CA3AF]"}>{children}</span>
    </li>
  );
}

function ProFeat({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-white">✓</span>
      <span className="text-white/95">{children}</span>
    </div>
  );
}

function CmpRow({
  rowIndex,
  feature,
  cells,
}: {
  rowIndex: number;
  feature: string;
  cells: [string, string, string, string];
}) {
  const [free, d3, d7, pro] = cells;
  const alt = rowIndex % 2 === 1;
  const cellColor = (v: string) => {
    if (v === "✓") return CORAL;
    if (v === "✗") return "#d1d5db";
    return "#4B5563";
  };
  return (
    <tr
      className={`border-b border-[#E9ECEF] ${alt ? "bg-[#F8F9FA]/90" : "bg-white"}`}
    >
      <td className="px-3 py-2.5 text-xs font-medium text-[#2C3E50]">{feature}</td>
      <td
        className="px-2 py-2.5 text-center text-xs font-semibold"
        style={{ color: cellColor(free) }}
      >
        {free}
      </td>
      <td
        className="px-2 py-2.5 text-center text-xs font-semibold"
        style={{ color: cellColor(d3) }}
      >
        {d3}
      </td>
      <td
        className="px-2 py-2.5 text-center text-xs font-semibold"
        style={{ color: cellColor(d7) }}
      >
        {d7}
      </td>
      <td
        className="bg-purple-50/90 px-2 py-2.5 text-center text-xs font-semibold"
        style={{ color: cellColor(pro) }}
      >
        {pro}
      </td>
    </tr>
  );
}
