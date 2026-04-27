"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle, Plane, Users, XCircle } from "lucide-react";

import { apiFetch, API_BASE } from "@/lib/api";

const GT_TRAVELHUB_OPEN_PROFILE = "gt_travelhub_open_profile";
const GT_NOTIFICATIONS_UNREAD = "gt-notifications-unread";
const RELOAD_HUB = "gt-reload-travelhub-groups";

const PAGE_BG = "#0f172a";
const UNREAD_ROW = "#1a1f35";
const READ_ROW = "#0f172a";
const MUTED = "#6b7280";
const TEXT = "#f9fafb";
const CORAL = "#ff6b6b";

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

function emitUnreadCount(count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GT_NOTIFICATIONS_UNREAD, { detail: { count } }),
  );
}

async function fetchAndEmitUnread() {
  try {
    const token = localStorage.getItem("gt_token");
    if (!token) return;
    const to = new AbortController();
    const tid = setTimeout(() => to.abort(), 8000);
    try {
      const u = await apiFetch<{ count: number }>("/notifications/unread-count", {
        signal: to.signal,
      });
      emitUnreadCount(Math.max(0, Math.floor(u.count)));
    } finally {
      clearTimeout(tid);
    }
  } catch {
    /* ignore */
  }
}

const SkeletonRow = () => (
  <li className="rounded-xl border border-white/[0.08] p-3 md:p-4" style={{ background: UNREAD_ROW }}>
    <div className="flex gap-3">
      <div
        className="h-11 w-11 shrink-0 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #1e2538 25%, #2a3248 50%, #1e2538 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div
          className="h-4 w-3/4 max-w-[240px] rounded"
          style={{
            background:
              "linear-gradient(90deg, #1e2538 25%, #2a3248 50%, #1e2538 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: 8,
          }}
        />
        <div
          className="h-3 w-full max-w-md rounded"
          style={{
            background:
              "linear-gradient(90deg, #1e2538 25%, #2a3248 50%, #1e2538 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: 8,
          }}
        />
      </div>
    </div>
  </li>
);

async function apiFetchWithDeadline<T>(
  path: string,
  pageSignal: AbortSignal,
): Promise<T> {
  const t = new AbortController();
  const timer = setTimeout(() => t.abort(), 8000);
  const onPageAbort = () => t.abort();
  pageSignal.addEventListener("abort", onPageAbort);
  try {
    if (pageSignal.aborted) throw new DOMException("Aborted", "AbortError");
    return await apiFetch<T>(path, { signal: t.signal });
  } finally {
    clearTimeout(timer);
    pageSignal.removeEventListener("abort", onPageAbort);
  }
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationIcon({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  const ic = "h-[18px] w-[18px]";
  const wrap =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#9ca3af]";
  if (t === "group_invite")
    return (
      <div className={`${wrap} bg-[#0d9488]/25`} aria-hidden>
        <Users className={ic} strokeWidth={1.5} />
      </div>
    );
  if (t === "invite_accepted")
    return (
      <div className={`${wrap} bg-[#1d9e75]/25`} aria-hidden>
        <CheckCircle className={ic} strokeWidth={1.5} />
      </div>
    );
  if (t === "invite_declined")
    return (
      <div className={`${wrap} bg-[#ff6b6b]/25`} aria-hidden>
        <XCircle className={ic} strokeWidth={1.5} />
      </div>
    );
  if (t === "group_activity")
    return (
      <div className={`${wrap} bg-emerald-500/20`} aria-hidden>
        <Users className={ic} strokeWidth={1.5} />
      </div>
    );
  if (t === "trip_activity")
    return (
      <div className={`${wrap} bg-sky-500/20`} aria-hidden>
        <Plane className={ic} strokeWidth={1.5} />
      </div>
    );
  if (t === "system")
    return (
      <div className={`${wrap} bg-slate-500/20`} aria-hidden>
        <Bell className={ic} strokeWidth={1.5} />
      </div>
    );
  return (
    <div className={`${wrap} bg-slate-500/20`} aria-hidden>
      <Bell className={ic} strokeWidth={1.5} />
    </div>
  );
}

function extractInvitationId(n: NotificationRow): string | null {
  const d = n.data;
  if (d && typeof d.invitation_id === "string" && d.invitation_id) {
    return d.invitation_id;
  }
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const listLoadRef = useRef<AbortController | null>(null);
  const moreLoadRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    globalThis.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadPage = useCallback(
    async (fromOffset: number, append: boolean) => {
      let ac: AbortController;
      if (append) {
        moreLoadRef.current?.abort();
        ac = new AbortController();
        moreLoadRef.current = ac;
        setLoadingMore(true);
      } else {
        listLoadRef.current?.abort();
        ac = new AbortController();
        listLoadRef.current = ac;
        setLoading(true);
      }
      const pageSignal = ac.signal;
      if (!append) setError(null);
      try {
        const res = await apiFetchWithDeadline<NotificationListResponse>(
          `/notifications?limit=20&offset=${fromOffset}`,
          pageSignal,
        );
        if (pageSignal.aborted) return;
        const batch = res.notifications ?? [];
        setHasMore(batch.length >= 20);
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setOffset(fromOffset + batch.length);
        if (typeof res.unread_count === "number") {
          emitUnreadCount(Math.max(0, res.unread_count));
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setError("Could not load data. Tap to retry.");
        if (!append) setItems([]);
      } finally {
        if (!pageSignal.aborted) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadPage(0, false);
    return () => {
      listLoadRef.current?.abort();
      moreLoadRef.current?.abort();
    };
  }, [loadPage]);

  useEffect(() => {
    const id = globalThis.setInterval(() => {
      void fetchAndEmitUnread();
    }, 30_000);
    return () => globalThis.clearInterval(id);
  }, []);

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

  const markRead = useCallback(
    async (n: NotificationRow) => {
      if (n.is_read) return;
      try {
        await apiFetch<NotificationRow>(`/notifications/${n.id}/read`, {
          method: "POST",
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
    },
    [],
  );

  const onRowActivate = useCallback(
    async (n: NotificationRow) => {
      const t = (n.type || "").toLowerCase();
      if (t === "group_invite") return;

      if (
        t === "system" &&
        n.title === "New connection request" &&
        n.data &&
        typeof n.data === "object"
      ) {
        const d = n.data as Record<string, unknown>;
        const senderId = typeof d.sender_id === "string" ? d.sender_id : null;
        if (senderId) {
          const m =
            n.body.match(/^(.+?)\s+wants to connect with you\.?/i) ??
            n.body.match(/^(.+?)\s+wants to connect/i);
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
                method: "POST",
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

      void markRead(n);
    },
    [markRead, router],
  );

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

  async function onAcceptInvite(n: NotificationRow) {
    const iid = extractInvitationId(n);
    if (!iid) {
      setError("Missing invitation on this notification.");
      return;
    }
    setActionId(n.id);
    try {
      const token = localStorage.getItem("gt_token");
      if (!token) {
        setError("Not signed in");
        return;
      }
      const to = new AbortController();
      const tid = setTimeout(() => to.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/invitations/${iid}/accept`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: to.signal,
        });
      } finally {
        clearTimeout(tid);
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Accept failed");
      }
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      showToast("Joined group!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(RELOAD_HUB));
      }
      await fetchAndEmitUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setActionId(null);
    }
  }

  async function onDeclineInvite(n: NotificationRow) {
    const iid = extractInvitationId(n);
    if (!iid) {
      setError("Missing invitation on this notification.");
      return;
    }
    setActionId(n.id);
    try {
      const token = localStorage.getItem("gt_token");
      if (!token) {
        setError("Not signed in");
        return;
      }
      const to = new AbortController();
      const tid = setTimeout(() => to.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/invitations/${iid}/decline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: to.signal,
        });
      } finally {
        clearTimeout(tid);
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Decline failed");
      }
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      showToast("Invitation declined");
      await fetchAndEmitUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not decline");
    } finally {
      setActionId(null);
    }
  }

  const rows = useMemo(() => items, [items]);

  return (
    <div className="w-full" style={{ background: PAGE_BG, minHeight: "60vh" }}>
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          style={{ background: CORAL }}
        >
          {toast}
        </div>
      ) : null}
      <div
        className="mx-auto max-w-2xl p-4 md:p-6"
        style={{ minHeight: "420px" }}
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1
            className="text-xl font-bold tracking-tight text-[#f9fafb] md:text-2xl"
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

        {error && !loading ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            <p>Could not load data. Tap to retry.</p>
            <button
              type="button"
              onClick={() => void loadPage(0, false)}
              className="mt-2 font-semibold text-white underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <ul className="flex flex-col gap-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </ul>
        ) : error ? null : items.length === 0 ? (
          <p className="py-14 text-center text-sm" style={{ color: MUTED }}>
            No notifications yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((n) => {
              const unread = !n.is_read;
              const t = (n.type || "").toLowerCase();
              const isInvite = t === "group_invite";
              return (
                <li key={n.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isInvite) {
                        void markRead(n);
                        return;
                      }
                      void onRowActivate(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isInvite) {
                          void markRead(n);
                          return;
                        }
                        void onRowActivate(n);
                      }
                    }}
                    className="w-full cursor-default rounded-xl border border-white/[0.08] p-3 text-left md:p-4"
                    style={{ background: unread ? UNREAD_ROW : READ_ROW }}
                  >
                    <div className="flex w-full items-start gap-3">
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="min-w-0 text-[15px] font-bold leading-snug"
                            style={{ color: TEXT }}
                          >
                            {n.title}
                          </p>
                          <p
                            className="shrink-0 text-xs font-medium"
                            style={{ color: MUTED }}
                          >
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </div>
                        <p
                          className="mt-0.5 text-sm leading-relaxed"
                          style={{ color: MUTED }}
                        >
                          {n.body}
                        </p>
                        {isInvite ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                              style={{ background: CORAL }}
                              disabled={actionId === n.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onAcceptInvite(n);
                              }}
                            >
                              {actionId === n.id ? "…" : "Accept"}
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/20 bg-transparent px-4 py-1.5 text-sm font-semibold text-[#9ca3af] hover:border-white/30"
                              disabled={actionId === n.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeclineInvite(n);
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
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
              className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#ff6b6b]"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
