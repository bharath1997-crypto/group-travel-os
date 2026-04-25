"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

const GT_TRAVELHUB_OPEN_PROFILE = "gt_travelhub_open_profile";

const GT_NOTIFICATIONS_UNREAD = "gt-notifications-unread";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const PAGE_BG = "#F8F9FA";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type NotificationListResponse = {
  notifications: NotificationRow[];
  unread_count: number;
};

type FilterTab = "all" | "activity" | "system";

function emitUnreadCount(count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GT_NOTIFICATIONS_UNREAD, { detail: { count } }),
  );
}

async function fetchAndEmitUnread() {
  try {
    const u = await apiFetch<{ count: number }>("/notifications/unread-count");
    emitUnreadCount(Math.max(0, Math.floor(u.count)));
  } catch {
    /* ignore */
  }
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60)
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
}

function notificationEmoji(n: NotificationRow): string {
  const t = (n.type || "").toLowerCase();
  if (t === "system") return "🔔";
  if (t === "group_activity") return "👥";
  if (t === "trip_activity") {
    const d = n.data;
    if (d && typeof d.poll_id === "string") return "💬";
    if (d && typeof d.expense_id === "string") return "💰";
    return "✈️";
  }
  return "🔔";
}

function iconBubbleClass(n: NotificationRow): string {
  const t = (n.type || "").toLowerCase();
  if (t === "system") return "bg-slate-200/90 text-slate-700";
  if (t === "group_activity") return "bg-emerald-100 text-emerald-800";
  if (t === "trip_activity") {
    const d = n.data;
    if (d && typeof d.poll_id === "string")
      return "bg-violet-100 text-violet-800";
    if (d && typeof d.expense_id === "string")
      return "bg-amber-100 text-amber-900";
    return "bg-sky-100 text-sky-900";
  }
  return "bg-slate-200/90 text-slate-700";
}

function matchesFilter(n: NotificationRow, tab: FilterTab): boolean {
  if (tab === "all") return true;
  const t = (n.type || "").toLowerCase();
  if (tab === "system") return t === "system";
  return t !== "system";
}

function EmptyAirplane() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <svg
        className="mb-6 h-40 w-40 text-[#0F3460]/25"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M60 18 L95 52 L78 58 L88 88 L72 92 L62 64 L48 70 L42 56 L58 50 Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M22 62 Q38 54 52 58 L48 70 Q32 66 18 72 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <circle cx="24" cy="78" r="3" fill="currentColor" opacity="0.15" />
        <circle cx="36" cy="86" r="2" fill="currentColor" opacity="0.12" />
        <circle cx="30" cy="94" r="1.5" fill="currentColor" opacity="0.1" />
      </svg>
      <p className="text-lg font-semibold" style={{ color: NAVY }}>
        All caught up
      </p>
      <p className="mt-2 text-sm text-[#6C757D]">
        When there&apos;s news about your trips and groups, it&apos;ll show up
        here.
      </p>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (fromOffset: number, append: boolean) => {
    if (fromOffset === 0) {
      if (!append) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const res = await apiFetch<NotificationListResponse>(
        `/notifications?limit=20&offset=${fromOffset}`,
      );
      const batch = res.notifications ?? [];
      setHasMore(batch.length >= 20);
      setItems((prev) => (append ? [...prev, ...batch] : batch));
      setOffset(fromOffset + batch.length);
      if (typeof res.unread_count === "number") {
        emitUnreadCount(Math.max(0, res.unread_count));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications");
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const filtered = useMemo(
    () => items.filter((n) => matchesFilter(n, tab)),
    [items, tab],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void loadPage(offset, true);
  }, [hasMore, loading, loadingMore, loadPage, offset]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  async function onMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await fetchAndEmitUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark all read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function onCardClick(n: NotificationRow) {
    const t = (n.type || "").toLowerCase();
    if (
      t === "system" &&
      n.title === "New connection request" &&
      n.data &&
      typeof n.data === "object"
    ) {
      const d = n.data as Record<string, unknown>;
      const senderId = typeof d.sender_id === "string" ? d.sender_id : null;
      if (senderId) {
        const m = n.body.match(/^(.+?)\s+wants to connect with you\.?/i) ?? n.body.match(/^(.+?)\s+wants to connect/i);
        const fullName = m?.[1]?.trim() ?? "User";
        try {
          sessionStorage.setItem(
            GT_TRAVELHUB_OPEN_PROFILE,
            JSON.stringify({
              id: senderId,
              full_name: fullName,
              username: null,
              profile_picture: null,
              avatar_url: null,
              is_verified: false,
              plan: "free",
              friend_status: "pending_received" as const,
            }),
          );
        } catch {
          /* ignore */
        }
        if (!n.is_read) {
          try {
            await apiFetch<NotificationRow>(`/notifications/${n.id}/read`, {
              method: "PATCH",
            });
            setItems((prev) =>
              prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
            );
            await fetchAndEmitUnread();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not mark as read",
            );
          }
        }
        router.push("/travel-hub");
        return;
      }
    }
    if (n.is_read) return;
    try {
      await apiFetch<NotificationRow>(`/notifications/${n.id}/read`, {
        method: "PATCH",
      });
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
      );
      await fetchAndEmitUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark as read");
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "activity", label: "Activity" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="w-full" style={{ background: PAGE_BG }}>
      <div
        className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm md:p-6"
        style={{ minHeight: "420px" }}
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1
            className="text-xl font-bold tracking-tight md:text-2xl"
            style={{ color: NAVY }}
          >
            Notifications
          </h1>
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            disabled={markingAll || items.length === 0}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: CORAL }}
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        </div>

        <div
          className="mb-5 flex gap-1 rounded-xl bg-[#F1F3F5] p-1"
          role="tablist"
          aria-label="Notification filters"
        >
          {tabs.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={[
                  "min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white text-[#0F3460] shadow-sm"
                    : "text-[#6C757D] hover:text-[#0F3460]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
              aria-hidden
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyAirplane />
        ) : filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-[#6C757D]">
            No notifications in this tab.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((n) => {
              const unread = !n.is_read;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void onCardClick(n)}
                    className={[
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors md:gap-4 md:px-4 md:py-3.5",
                      unread
                        ? "border-sky-200/80 bg-sky-50/80 hover:bg-sky-50"
                        : "border-[#E9ECEF] bg-white hover:bg-[#F8F9FA]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg",
                        iconBubbleClass(n),
                      ].join(" ")}
                      aria-hidden
                    >
                      {notificationEmoji(n)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[15px] font-bold leading-snug"
                        style={{ color: NAVY }}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#495057]">
                        {n.body}
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-[#868E96]">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                    <div className="flex w-6 shrink-0 justify-center pt-1">
                      {unread ? (
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full bg-[#0D6EFD]"
                          title="Unread"
                          aria-label="Unread"
                        />
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && hasMore ? (
          <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />
        ) : null}
        {loadingMore ? (
          <div className="flex justify-center py-6">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
