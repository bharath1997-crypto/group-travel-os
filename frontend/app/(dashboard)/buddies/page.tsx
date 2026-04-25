"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const MUTED = "#94A3B8";
const PANEL = "#0F172A";
const CARD = "#1E293B";
const BORDER = "rgba(148, 163, 184, 0.25)";
const DICEBEAR_LORELEI = "https://api.dicebear.com/7.x/lorelei/svg";

type SocialUserOut = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  profile_picture: string | null;
  plan?: string;
  friend_status?: string;
};

type UserMe = { id: string };

type FriendRequestOut = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};

function socialAvatarUrl(u: {
  id: string;
  profile_picture?: string | null;
  avatar_url?: string | null;
}): string {
  const p = u.profile_picture?.trim();
  if (p && (p.startsWith("data:") || p.startsWith("http"))) return p;
  const a = u.avatar_url?.trim();
  if (a && (a.startsWith("data:") || a.startsWith("http"))) return a;
  return `${DICEBEAR_LORELEI}/svg?seed=${encodeURIComponent(u.id)}`;
}

function formatDisplayName(full: string | null | undefined): string {
  if (!full?.trim()) return "Traveler";
  return full
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function planBadgeStyle(
  plan: string | null,
): { label: string; className: string } {
  const p = plan ?? "free";
  if (p === "free")
    return { label: "Free", className: "bg-slate-600 text-slate-100" };
  if (p === "pass_3day" || p === "pass_7day")
    return {
      label: p === "pass_3day" ? "3-Day" : "7-Day",
      className: "bg-rose-600/90 text-white",
    };
  if (p === "pro" || p === "enterprise")
    return { label: "Pro", className: "bg-purple-600/80 text-white" };
  return { label: p, className: "bg-slate-600 text-slate-100" };
}

function poolUser(
  pool: Record<string, SocialUserOut>,
  userId: string,
): SocialUserOut {
  const s = String(userId);
  return (
    pool[s] ?? {
      id: s,
      full_name: "Traveler",
      username: null,
      avatar_url: null,
      profile_picture: null,
    }
  );
}

export default function BuddiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<"buddies" | "requests">(
    urlTab === "requests" ? "requests" : "buddies",
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [connections, setConnections] = useState<SocialUserOut[]>([]);
  const [received, setReceived] = useState<FriendRequestOut[]>([]);
  const [sent, setSent] = useState<FriendRequestOut[]>([]);
  const [userPool, setUserPool] = useState<Record<string, SocialUserOut>>({});
  const [suggestions, setSuggestions] = useState<SocialUserOut[]>([]);
  const [frBusy, setFrBusy] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);

  const receivedCount = received.length;
  const sentCount = sent.length;
  const buddiesCount = connections.length;
  const totalRequests = receivedCount + sentCount;

  useEffect(() => {
    setTab(urlTab === "requests" ? "requests" : "buddies");
  }, [urlTab]);

  const setTabInUrl = useCallback(
    (t: "buddies" | "requests") => {
      setTab(t);
      if (t === "requests") {
        router.push("/buddies?tab=requests", { scroll: false });
      } else {
        router.push("/buddies", { scroll: false });
      }
    },
    [router],
  );

  const load = useCallback(async () => {
    if (!getToken()) {
      clearToken();
      router.replace("/login");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [meRes, cRes, rRes, sRes, qRes] = await Promise.all([
        apiFetchWithStatus<UserMe>("/auth/me"),
        apiFetchWithStatus<SocialUserOut[]>("/social/connections"),
        apiFetchWithStatus<FriendRequestOut[]>("/social/friend-requests"),
        apiFetchWithStatus<FriendRequestOut[]>("/social/friend-requests/sent"),
        apiFetchWithStatus<SocialUserOut[]>(
          `/users/search?q=${encodeURIComponent("a")}&limit=10`,
        ),
      ]);
      if (meRes.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      const u = meRes.data;
      const conns =
        cRes.status === 200 && Array.isArray(cRes.data) ? cRes.data : [];
      const rec =
        rRes.status === 200 && Array.isArray(rRes.data) ? rRes.data : [];
      const snt =
        sRes.status === 200 && Array.isArray(sRes.data) ? sRes.data : [];
      const searchRows =
        qRes.status === 200 && Array.isArray(qRes.data) ? qRes.data : [];

      setConnections(conns);
      setReceived(rec);
      setSent(snt);

      const byId: Record<string, SocialUserOut> = {};
      for (const x of conns) {
        byId[String(x.id)] = { ...x, id: String(x.id) };
      }
      for (const x of searchRows) {
        byId[String(x.id)] = { ...x, id: String(x.id) };
      }
      for (const fr of rec) {
        const sid = String(fr.sender_id);
        if (!byId[sid]) {
          byId[sid] = {
            id: sid,
            full_name: "Traveler",
            username: null,
            avatar_url: null,
            profile_picture: null,
          };
        }
      }
      for (const fr of snt) {
        const rid = String(fr.receiver_id);
        if (!byId[rid]) {
          byId[rid] = {
            id: rid,
            full_name: "Traveler",
            username: null,
            avatar_url: null,
            profile_picture: null,
          };
        }
      }
      setUserPool(byId);

      const myId = u ? String(u.id) : "";
      const connSet = new Set(conns.map((c) => String(c.id)));
      setSuggestions(
        searchRows
          .filter((row) => {
            const id = String(row.id);
            if (id === myId) return false;
            if (connSet.has(id)) return false;
            if (row.friend_status === "accepted") return false;
            if (row.friend_status === "pending_sent") return false;
            if (row.friend_status === "pending_received") return false;
            if (row.friend_status === "blocked") return false;
            return true;
          })
          .slice(0, 6),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = useCallback(
    async (fr: FriendRequestOut) => {
      setFrBusy(String(fr.id));
      try {
        await apiFetch(`/social/friend-requests/${String(fr.id)}/accept`, {
          method: "PATCH",
        });
        await load();
      } finally {
        setFrBusy(null);
      }
    },
    [load],
  );

  const decline = useCallback(
    async (fr: FriendRequestOut) => {
      setFrBusy(String(fr.id));
      try {
        await apiFetch(`/social/friend-requests/${String(fr.id)}/decline`, {
          method: "PATCH",
        });
        await load();
      } finally {
        setFrBusy(null);
      }
    },
    [load],
  );

  const cancelSent = useCallback(
    async (fr: FriendRequestOut) => {
      setCancelBusy(String(fr.id));
      try {
        await apiFetch(`/social/friend-requests/${String(fr.id)}`, {
          method: "DELETE",
        });
        await load();
      } finally {
        setCancelBusy(null);
      }
    },
    [load],
  );

  const removeBuddy = useCallback(
    async (buddy: SocialUserOut) => {
      setRemoveBusy(String(buddy.id));
      try {
        await apiFetch("/social/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: buddy.id }),
        });
        await load();
      } catch {
        setErr("Could not remove buddy");
      } finally {
        setRemoveBusy(null);
      }
    },
    [load],
  );

  const connect = useCallback(
    async (row: SocialUserOut) => {
      setConnectBusy(String(row.id));
      try {
        await apiFetch("/social/friend-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: row.id }),
        });
        setSuggestions((prev) => prev.filter((x) => x.id !== row.id));
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not connect");
      } finally {
        setConnectBusy(null);
      }
    },
    [load],
  );

  return (
    <div
      className="min-h-screen w-full pb-24"
      style={{ background: PANEL, color: "#E2E8F0" }}
    >
      <header
        className="sticky top-0 z-20 border-b px-4 py-4"
        style={{ background: PANEL, borderColor: BORDER }}
      >
        <h1
          className="text-center text-lg font-bold tracking-tight"
          style={{ color: "#F8FAFC" }}
        >
          Buddies
        </h1>
        {err ? (
          <p className="mt-1 text-center text-xs text-rose-400">{err}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-slate-900/50 p-1">
          <button
            type="button"
            onClick={() => setTabInUrl("buddies")}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === "buddies" ? "bg-slate-700 text-white" : "text-slate-400"
            }`}
          >
            Buddies
            {buddiesCount > 0 ? (
              <span className="rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-200">
                {buddiesCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTabInUrl("requests")}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === "requests" ? "bg-slate-700 text-white" : "text-slate-400"
            }`}
          >
            Requests
            {receivedCount > 0 ? (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {receivedCount}
              </span>
            ) : null}
            {receivedCount === 0 && totalRequests > 0 ? (
              <span className="rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-200">
                {totalRequests}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-slate-800/60"
              />
            ))}
          </div>
        ) : null}

        {!loading && tab === "buddies" ? (
          <>
            {connections.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: MUTED }}>
                No buddies yet — connect with travelers!
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((c) => {
                  const pb = planBadgeStyle(c.plan ?? null);
                  return (
                    <li
                      key={String(c.id)}
                      className="flex items-center gap-3 rounded-xl border p-3"
                      style={{ background: CARD, borderColor: BORDER }}
                    >
                      <img
                        src={socialAvatarUrl(c)}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-100">
                          {formatDisplayName(c.full_name)}
                        </p>
                        <p className="truncate text-xs" style={{ color: MUTED }}>
                          @{c.username?.trim() ? c.username : "user"}
                        </p>
                        <span
                          className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${pb.className}`}
                        >
                          {pb.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => {
                            sessionStorage.setItem(
                              "gt_open_dm_user_id",
                              c.id,
                            );
                            router.push("/travel-hub");
                          }}
                          className="rounded-lg border border-slate-500/60 bg-slate-800/50 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          disabled={removeBusy === String(c.id)}
                          onClick={() => void removeBuddy(c)}
                          className="rounded-lg border border-rose-700/50 bg-rose-950/30 px-2.5 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <section className="mt-8">
              <h2
                className="mb-3 text-sm font-bold"
                style={{ color: "#F8FAFC" }}
              >
                People You May Know
              </h2>
              {suggestions.length === 0 ? (
                <p
                  className="text-center text-xs"
                  style={{ color: MUTED }}
                >
                  No suggestions right now
                </p>
              ) : (
                <div
                  className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {suggestions.map((row) => {
                    const requested = row.friend_status === "pending_sent";
                    return (
                      <div
                        key={String(row.id)}
                        className="w-[min(200px,78vw)] shrink-0 rounded-xl p-3"
                        style={{ background: CARD, border: `1px solid ${BORDER}` }}
                      >
                        <div className="flex flex-col items-center text-center">
                          <img
                            src={socialAvatarUrl(row)}
                            alt=""
                            className="h-16 w-16 rounded-full object-cover"
                          />
                          <p className="mt-2 line-clamp-1 w-full text-sm font-semibold text-slate-100">
                            {formatDisplayName(row.full_name)}
                          </p>
                          <p
                            className="line-clamp-1 w-full text-xs"
                            style={{ color: MUTED }}
                          >
                            @
                            {row.username?.trim() ? row.username : "user"}
                          </p>
                          <button
                            type="button"
                            disabled={
                              connectBusy === String(row.id) || requested
                            }
                            onClick={() => void connect(row)}
                            className="mt-2 w-full rounded-lg border border-slate-500/50 bg-slate-800/40 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                            style={{ borderColor: BORDER }}
                          >
                            {requested ? "Requested" : "Connect"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

        {!loading && tab === "requests" ? (
          <div className="space-y-6">
            <div>
              <h2
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: MUTED }}
              >
                Received
              </h2>
              {received.length === 0 ? (
                <p className="py-2 text-sm" style={{ color: MUTED }}>
                  No pending requests
                </p>
              ) : (
                <ul className="space-y-2">
                  {received.map((fr) => {
                    const other = poolUser(
                      userPool,
                      String(fr.sender_id),
                    );
                    return (
                      <li
                        key={String(fr.id)}
                        className="flex items-center gap-3 rounded-xl border p-3"
                        style={{ background: CARD, borderColor: BORDER }}
                      >
                        <img
                          src={socialAvatarUrl(other)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-100">
                            {formatDisplayName(other.full_name)}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{ color: MUTED }}
                          >
                            @
                            {other.username?.trim() ? other.username : "user"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={frBusy === String(fr.id)}
                            onClick={() => void accept(fr)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={frBusy === String(fr.id)}
                            onClick={() => void decline(fr)}
                            className="rounded-lg bg-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              className="border-t pt-2"
              style={{ borderColor: BORDER }}
            >
              <h2
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: MUTED }}
              >
                Sent
              </h2>
              {sent.length === 0 ? (
                <p className="py-2 text-sm" style={{ color: MUTED }}>
                  No sent requests
                </p>
              ) : (
                <ul className="space-y-2">
                  {sent.map((fr) => {
                    const other = poolUser(
                      userPool,
                      String(fr.receiver_id),
                    );
                    return (
                      <li
                        key={String(fr.id)}
                        className="flex items-center gap-3 rounded-xl border p-3"
                        style={{ background: CARD, borderColor: BORDER }}
                      >
                        <img
                          src={socialAvatarUrl(other)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-100">
                            {formatDisplayName(other.full_name)}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{ color: MUTED }}
                          >
                            @
                            {other.username?.trim() ? other.username : "user"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-medium text-slate-300">
                            Requested
                          </span>
                          <button
                            type="button"
                            disabled={cancelBusy === String(fr.id)}
                            onClick={() => void cancelSent(fr)}
                            className="rounded-lg border border-slate-500/50 bg-slate-800/50 px-2.5 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
