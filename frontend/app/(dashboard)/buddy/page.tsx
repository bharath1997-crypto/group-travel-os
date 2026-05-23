"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { useCallback, useEffect, useMemo, useState } from "react";

type OrganizerBrief = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type BuddyTripRow = {
  id: string;
  organizer_id: string;
  organizer: OrganizerBrief | null;
  destination: string;
  date_from: string;
  date_to: string;
  max_size: number;
  current_size: number;
  vibe_tags: string[];
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const VIBE_FILTERS = [
  "Adventure",
  "Chill",
  "Party",
  "Culture",
  "Nature",
] as const;

function dicebear(seed: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function avatarForTrip(t: BuddyTripRow): string {
  const u = t.organizer;
  const url = u?.avatar_url?.trim();
  if (url) return url;
  return dicebear(u?.id ?? t.organizer_id);
}

export default function BuddyTripsPage() {
  const { user } = useDashboardUser();
  const selfId = user?.id ?? "";

  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [destination, setDestination] = useState("");
  const [vibePick, setVibePick] = useState<Record<string, boolean>>({});

  const [browseRows, setBrowseRows] = useState<BuddyTripRow[]>([]);
  const [mineRows, setMineRows] = useState<BuddyTripRow[]>([]);
  const [requests, setRequests] = useState<Record<string, any[]>>({});
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [modalTrip, setModalTrip] = useState<BuddyTripRow | null>(null);
  const [joinMsg, setJoinMsg] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);

  const [createDest, setCreateDest] = useState("");
  const [createFrom, setCreateFrom] = useState("");
  const [createTo, setCreateTo] = useState("");
  const [createMax, setCreateMax] = useState(10);
  const [createTags, setCreateTags] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const activeVibes = useMemo(
    () =>
      Object.entries(vibePick)
        .filter(([, v]) => v)
        .map(([k]) => k.toLowerCase()),
    [vibePick],
  );

  const filteredBrowse = useMemo(() => {
    if (!activeVibes.length) return browseRows;
    return browseRows.filter((t) => {
      const tags = t.vibe_tags.map((x) => x.toLowerCase());
      return activeVibes.every((v) => tags.some((tg) => tg.includes(v)));
    });
  }, [browseRows, activeVibes]);

  const loadBrowse = useCallback(async () => {
    if (!getToken()) {
      setErrorBanner("Please sign in.");
      return;
    }
    setLoading(true);
    setErrorBanner(null);
    try {
      const qs = new URLSearchParams({ status: "open" });
      if (destination.trim()) qs.set("destination", destination.trim());
      const data = await apiFetch<BuddyTripRow[]>(`/buddy/trips?${qs}`);
      setBrowseRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setBrowseRows([]);
      const hint = e instanceof Error ? e.message : String(e);
      setErrorBanner(
        process.env.NODE_ENV === "development"
          ? `${hint}\nAPI: ${API_BASE}`
          : "Could not load trips.",
      );
    } finally {
      setLoading(false);
    }
  }, [destination]);

  const loadMine = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await apiFetch<BuddyTripRow[]>("/buddy/trips?mine=true");
      setMineRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMineRows([]);
      const hint = e instanceof Error ? e.message : String(e);
      setErrorBanner(
        process.env.NODE_ENV === "development"
          ? `${hint}\nAPI: ${API_BASE}`
          : "Could not load your trips.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTab = useCallback(async () => {
    if (tab === "browse") await loadBrowse();
    else await loadMine();
  }, [tab, loadBrowse, loadMine]);

  useEffect(() => {
    void loadBrowse();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial browse load only
  }, []);

  const submitJoin = async () => {
    if (!modalTrip) return;
    setJoinBusy(true);
    try {
      await apiFetch(`/buddy/trips/${modalTrip.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: joinMsg.trim() || undefined }),
      });
      setModalTrip(null);
      setJoinMsg("");
      await loadBrowse();
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      setErrorBanner(hint);
    } finally {
      setJoinBusy(false);
    }
  };

  const submitCreate = async () => {
    if (!createDest.trim() || !createFrom || !createTo) {
      setErrorBanner("Destination and dates required.");
      return;
    }
    setCreateBusy(true);
    setErrorBanner(null);
    try {
      const tags = createTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch("/buddy/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: createDest.trim(),
          date_from: createFrom,
          date_to: createTo,
          max_size: createMax,
          vibe_tags: tags,
          description: createDesc.trim() || undefined,
        }),
      });
      setCreateDest("");
      setCreateTags("");
      setCreateDesc("");
      await loadMine();
      setTab("mine");
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      setErrorBanner(hint);
    } finally {
      setCreateBusy(false);
    }
  };

  const loadRequests = async (tripId: string) => {
    try {
      const data = await apiFetch<any[]>((`/buddy/trips/${tripId}/requests`));
      setRequests((p) => ({ ...p, [tripId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestAction = async (tripId: string, reqId: string, approve: boolean) => {
    try {
      await apiFetch((`/buddy/trips/${tripId}/requests/${reqId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      await loadRequests(tripId);
      if (approve) await loadMine();
    } catch (e) {
      console.error(e);
    }
  };

  const rows = tab === "browse" ? filteredBrowse : mineRows;

  return (
    <div className="min-h-[calc(100dvh-80px)] text-[#0F3460]">
      <div className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-[#0F3460] px-3 py-4 text-white shadow-md md:-mx-5 md:px-5">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-lg font-bold tracking-tight md:text-xl">
            Buddy trips
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-teal-100/95 md:text-sm">
            Meet travelers headed to the same destination — request to join curated groups.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("browse");
                void loadBrowse();
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold md:text-sm ${
                tab === "browse"
                  ? "bg-teal-400 text-[#0F3460]"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Browse trips
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("mine");
                void loadMine();
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold md:text-sm ${
                tab === "mine"
                  ? "bg-teal-400 text-[#0F3460]"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              My trips
            </button>
            <button
              type="button"
              onClick={() => void refreshTab()}
              className="ml-auto rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 md:text-sm"
            >
              Refresh
            </button>
          </div>

          {tab === "browse" ? (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
              <label className="flex min-w-[200px] flex-1 flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                  Destination contains
                </span>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Tokyo, Lisbon…"
                  className="rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadBrowse()}
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-900/30 hover:bg-teal-400"
              >
                Search
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 rounded-xl border border-white/15 bg-white/5 p-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
              <label className="lg:col-span-3">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  Destination
                </span>
                <input
                  value={createDest}
                  onChange={(e) => setCreateDest(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <label className="lg:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  From
                </span>
                <input
                  type="date"
                  value={createFrom}
                  onChange={(e) => setCreateFrom(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <label className="lg:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  To
                </span>
                <input
                  type="date"
                  value={createTo}
                  onChange={(e) => setCreateTo(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <label className="lg:col-span-1">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  Max size
                </span>
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={createMax}
                  onChange={(e) => setCreateMax(Number(e.target.value))}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <label className="lg:col-span-4">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  Vibes (comma-separated)
                </span>
                <input
                  value={createTags}
                  onChange={(e) => setCreateTags(e.target.value)}
                  placeholder="Adventure, Chill"
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <label className="lg:col-span-12">
                <span className="text-[11px] font-semibold uppercase text-teal-100">
                  Description
                </span>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-[#0F3460]"
                />
              </label>
              <div className="lg:col-span-12">
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={() => void submitCreate()}
                  className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-400 disabled:opacity-50"
                >
                  {createBusy ? "Creating…" : "Create buddy trip"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-0">
        {tab === "browse" ? (
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <span className="w-full text-xs font-semibold text-slate-500">
              Vibe filters
            </span>
            {VIBE_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() =>
                  setVibePick((p) => ({
                    ...p,
                    [v]: !p[v],
                  }))
                }
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  vibePick[v]
                    ? "bg-[#0F3460] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : null}

        {errorBanner ? (
          <div className="mb-4 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            {errorBanner}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="h-24 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
            {tab === "browse"
              ? "No open trips match — widen destination or reset vibe chips."
              : "You have no buddy trips yet — create one above."}
          </div>
        ) : null}

        <ul className="space-y-4">
          {!loading
            ? rows.map((t) => {
                const spots = Math.max(0, t.max_size - t.current_size);
                const mineOrg = selfId && t.organizer_id === selfId;
                return (
                  <li
                    key={t.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <img
                        src={avatarForTrip(t)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-full border border-slate-200 bg-slate-50 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-[#0F3460]">
                            {t.destination}
                          </h2>
                          {mineOrg ? (
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                              You organize
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {t.date_from} → {t.date_to}
                        </p>
                        <p className="text-sm text-slate-600">
                          Organizer{" "}
                          <span className="font-semibold text-[#0F3460]">
                            {t.organizer?.full_name ?? "Traveler"}
                          </span>
                        </p>
                        {t.description ? (
                          <p className="mt-2 text-sm text-slate-600">{t.description}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.vibe_tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-gradient-to-r from-teal-50 to-indigo-50 px-3 py-1 text-[11px] font-bold text-[#0F3460] ring-1 ring-teal-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-44 md:items-end">
                        <p className="text-right text-sm font-bold text-slate-700">
                          {t.current_size}/{t.max_size} joined
                        </p>
                        <p className="text-right text-xs text-slate-500">
                          {spots} spots left · {t.status}
                        </p>
                        {tab === "browse" &&
                        t.status === "open" &&
                        selfId &&
                        !mineOrg &&
                        selfId !== t.organizer_id ? (
                          <button
                            type="button"
                            onClick={() => setModalTrip(t)}
                            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-teal-400"
                          >
                            Request to join
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {mineOrg && tab === "mine" && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            const next = !expandedRequests[t.id];
                            setExpandedRequests((p) => ({ ...p, [t.id]: next }));
                            if (next && !requests[t.id]) {
                              void loadRequests(t.id);
                            }
                          }}
                          className="flex items-center text-sm font-semibold text-[#0F3460] hover:text-[#0c2d52]"
                        >
                          <span>Requests</span>
                          <span className="ml-1">{expandedRequests[t.id] ? "▲" : "▼"}</span>
                        </button>
                        
                        {expandedRequests[t.id] && (
                          <div className="mt-3 space-y-2">
                            {!requests[t.id] ? (
                              <p className="text-xs text-slate-500">Loading...</p>
                            ) : requests[t.id].length === 0 ? (
                              <p className="text-xs text-slate-500">No pending requests.</p>
                            ) : (
                              requests[t.id].map((r: any) => (
                                <div key={r.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
                                  <div className="flex items-center gap-2">
                                    <img src={dicebear(r.user_id)} alt="" className="h-8 w-8 rounded-full border border-slate-200 bg-white" />
                                    <div>
                                      <span className="font-semibold text-[#0F3460]">{r.user?.full_name ?? "Traveler"}</span>
                                      {r.message && <p className="mt-0.5 text-xs text-slate-600">&ldquo;{r.message}&rdquo;</p>}
                                      <p className="text-[10px] text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 self-end md:self-center">
                                    <button
                                      type="button"
                                      onClick={() => void handleRequestAction(t.id, r.id, true)}
                                      className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                                    >
                                      ✅ Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleRequestAction(t.id, r.id, false)}
                                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                    >
                                      ❌ Decline
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })
            : null}
        </ul>
      </div>

      {modalTrip ? (
        <div className="fixed inset-0 z-[3500] flex items-end justify-center bg-black/45 p-3 md:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#0F3460]">
              Join {modalTrip.destination}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Tell the organizer why you&apos;d be a great buddy traveler (optional).
            </p>
            <textarea
              value={joinMsg}
              onChange={(e) => setJoinMsg(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#0F3460]"
              placeholder="Hey! I'd love to join..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setModalTrip(null);
                  setJoinMsg("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={joinBusy}
                onClick={() => void submitJoin()}
                className="rounded-xl bg-[#0F3460] px-5 py-2 text-sm font-bold text-white hover:bg-[#0c2d52] disabled:opacity-50"
              >
                {joinBusy ? "Sending…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
