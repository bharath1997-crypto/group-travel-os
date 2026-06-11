"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { emitOpenLounge } from "@/lib/open-lounge";

const MUTED = "#64748B";
const PANEL = "#F8FAFC";
const CARD = "#FFFFFF";
const BORDER = "#E2E8F0";
const DICEBEAR_INITIALS = "https://api.dicebear.com/7.x/initials/svg";

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
  return `${DICEBEAR_INITIALS}/svg?seed=${encodeURIComponent(u.id)}`;
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
    return { label: "Free", className: "bg-slate-100 text-slate-700 border border-slate-200" };
  if (p === "pass_3day" || p === "pass_7day")
    return {
      label: p === "pass_3day" ? "3-Day" : "7-Day",
      className: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  if (p === "pro" || p === "enterprise")
    return { label: "Pro", className: "bg-teal-50 text-teal-700 border border-teal-250" };
  return { label: p, className: "bg-slate-100 text-slate-700 border border-slate-200" };
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
    <div className="min-h-[calc(100dvh-80px)] bg-[#F8FAFC] rounded-3xl p-6 md:p-8 text-slate-850 shadow-sm border border-slate-200/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Buddies
          </h1>
          <p className="mt-1 text-sm text-slate-500">Connect with travel companions and friends</p>
        </div>
        {err ? (
          <p className="text-xs text-rose-500 font-medium">{err}</p>
        ) : null}
        
        <div className="flex items-center gap-1 rounded-xl bg-slate-150 p-1 border border-slate-200/40 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTabInUrl("buddies")}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === "buddies" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Buddies
            {buddiesCount > 0 ? (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                {buddiesCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTabInUrl("requests")}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === "requests" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Requests
            {receivedCount > 0 ? (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {receivedCount}
              </span>
            ) : null}
            {receivedCount === 0 && totalRequests > 0 ? (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                {totalRequests}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="mt-6 mx-auto w-full max-w-2xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-slate-200/60 border border-slate-200/80"
              />
            ))}
          </div>
        ) : null}

        {!loading && tab === "buddies" ? (
          <>
            {connections.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No buddies yet — connect with travelers!
              </p>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0">
                {connections.map((c) => {
                  const pb = planBadgeStyle(c.plan ?? null);
                  return (
                    <li
                      key={String(c.id)}
                      className="flex items-center gap-3 rounded-2xl border p-4 bg-white border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <img
                        src={socialAvatarUrl(c)}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover border border-slate-100 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">
                          {formatDisplayName(c.full_name)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{c.username?.trim() ? c.username : "user"}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${pb.className}`}
                        >
                          {pb.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => {
                            emitOpenLounge({ openDmUserId: String(c.id) });
                          }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          disabled={removeBusy === String(c.id)}
                          onClick={() => void removeBuddy(c)}
                          className="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 transition disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <section className="mt-10 border-t border-slate-200/80 pt-8">
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                People You May Know
              </h2>
              {suggestions.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">
                  No suggestions right now
                </p>
              ) : (
                <div
                  className="flex gap-3 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {suggestions.map((row) => {
                    const requested = row.friend_status === "pending_sent";
                    return (
                      <div
                        key={String(row.id)}
                        className="w-[min(200px,78vw)] shrink-0 rounded-2xl p-4 bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex flex-col items-center text-center">
                          <img
                            src={socialAvatarUrl(row)}
                            alt=""
                            className="h-16 w-16 rounded-full object-cover border border-slate-100 shadow-sm"
                          />
                          <p className="mt-3 line-clamp-1 w-full text-sm font-bold text-slate-900">
                            {formatDisplayName(row.full_name)}
                          </p>
                          <p className="line-clamp-1 w-full text-xs text-slate-500">
                            @{row.username?.trim() ? row.username : "user"}
                          </p>
                          <button
                            type="button"
                            disabled={
                              connectBusy === String(row.id) || requested
                            }
                            onClick={() => void connect(row)}
                            className="mt-3 w-full rounded-lg bg-teal-600 hover:bg-teal-700 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
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
          <div className="space-y-8">
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Received
              </h2>
              {received.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">
                  No pending requests
                </p>
              ) : (
                <ul className="space-y-3 list-none p-0 m-0">
                  {received.map((fr) => {
                    const other = poolUser(
                      userPool,
                      String(fr.sender_id),
                    );
                    return (
                      <li
                        key={String(fr.id)}
                        className="flex items-center gap-3 rounded-2xl border p-4 bg-white border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <img
                          src={socialAvatarUrl(other)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover border border-slate-100 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900">
                            {formatDisplayName(other.full_name)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{other.username?.trim() ? other.username : "user"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={frBusy === String(fr.id)}
                            onClick={() => void accept(fr)}
                            className="rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={frBusy === String(fr.id)}
                            onClick={() => void decline(fr)}
                            className="rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition disabled:opacity-50"
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

            <div className="border-t border-slate-200/80 pt-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Sent
              </h2>
              {sent.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">
                  No sent requests
                </p>
              ) : (
                <ul className="space-y-3 list-none p-0 m-0">
                  {sent.map((fr) => {
                    const other = poolUser(
                      userPool,
                      String(fr.receiver_id),
                    );
                    return (
                      <li
                        key={String(fr.id)}
                        className="flex items-center gap-3 rounded-2xl border p-4 bg-white border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <img
                          src={socialAvatarUrl(other)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover border border-slate-100 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900">
                            {formatDisplayName(other.full_name)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{other.username?.trim() ? other.username : "user"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                            Requested
                          </span>
                          <button
                            type="button"
                            disabled={cancelBusy === String(fr.id)}
                            onClick={() => void cancelSent(fr)}
                            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition disabled:opacity-50"
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
