"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_seen_at: string | null;
  is_online: boolean;
  has_mobile_app: boolean;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type PollOptionOut = {
  id: string;
  poll_id: string;
  label: string;
  location_id: string | null;
  vote_count: number;
};

type PollOut = {
  id: string;
  trip_id: string;
  question: string;
  poll_type: string;
  status: string;
  created_by: string;
  closes_at: string | null;
  created_at: string;
  options: PollOptionOut[];
};

type ExpenseSplitOut = {
  id: string;
  expense_id: string;
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

type BalanceSummaryItem = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type LocationOut = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
};

type MeOut = { id: string; full_name: string; username: string | null };

type TripPublicParticipant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  trip_note: string | null;
  is_online: boolean;
};

type TripPublicPreview = {
  public_participants: TripPublicParticipant[];
};

const NAVY = "#0F3460";
const ORANGE = "#E94560";

type TabId = "polls" | "expenses" | "members" | "places";

function avatarDiceBear(userId: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(userId)}`;
}

function tripStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function tripStatusBadgeClass(status: string): string {
  switch (status) {
    case "planning":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "confirmed":
      return "bg-green-100 text-green-800 border border-green-200";
    case "ongoing":
      return "border border-[#E94560]/30 bg-[#fff0f3] text-[#c73652]";
    case "completed":
      return "bg-gray-100 text-gray-700 border border-[#E9ECEF]";
    default:
      return "bg-gray-100 text-gray-600 border border-[#E9ECEF]";
  }
}

function tripStatusDotStyle(status: string): CSSProperties | undefined {
  if (status === "ongoing") return { backgroundColor: ORANGE };
  return undefined;
}

function pollIsOpen(p: PollOut): boolean {
  if (p.status !== "open") return false;
  if (p.closes_at) {
    const end = new Date(p.closes_at).getTime();
    if (Number.isFinite(end) && Date.now() > end) return false;
  }
  return true;
}

function pollClosedLabel(p: PollOut): "OPEN" | "CLOSED" {
  return pollIsOpen(p) ? "OPEN" : "CLOSED";
}

function flagBadge(category: string | null): {
  label: string;
  className: string;
} {
  const c = (category || "custom").toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    dream: {
      label: "dream",
      className: "bg-purple-100 text-purple-800 border border-purple-200",
    },
    interesting: {
      label: "interesting",
      className: "bg-blue-100 text-blue-800 border border-blue-200",
    },
    gang_trip: {
      label: "gang trip",
      className: "border border-[#E94560]/20 bg-[#fff0f3] text-[#2C3E50]",
    },
    visited: {
      label: "visited",
      className: "bg-green-100 text-green-800 border border-green-200",
    },
    custom: {
      label: "custom",
      className: "bg-gray-100 text-gray-700 border border-[#E9ECEF]",
    },
  };
  return (
    map[c] ?? {
      label: c || "custom",
      className: "bg-gray-100 text-gray-700 border border-[#E9ECEF]",
    }
  );
}

function onlineFromLastSeen(
  lastSeenAt: string | null,
  windowMin: number,
): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < windowMin * 60 * 1000;
}

export default function TripDetailPage() {
  const params = useParams();
  const rawId =
    typeof params.tripId === "string"
      ? params.tripId
      : Array.isArray(params.tripId)
        ? params.tripId[0] ?? ""
        : "";
  const tripId = rawId.trim();

  const [trip, setTrip] = useState<TripOut | null>(null);
  const [tripErr, setTripErr] = useState<string | null>(null);
  const [tripLoading, setTripLoading] = useState(true);

  const [group, setGroup] = useState<GroupOut | null>(null);
  const [groupErr, setGroupErr] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const [me, setMe] = useState<MeOut | null>(null);

  const [rosterByUser, setRosterByUser] = useState<Record<string, string | null>>(
    {},
  );

  const [activeTab, setActiveTab] = useState<TabId>("polls");

  const [polls, setPolls] = useState<PollOut[] | null>(null);
  const [pollsErr, setPollsErr] = useState<string | null>(null);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollsTouched, setPollsTouched] = useState(false);

  const [expenses, setExpenses] = useState<ExpenseOut[] | null>(null);
  const [balances, setBalances] = useState<BalanceSummaryItem[] | null>(null);
  const [expensesErr, setExpensesErr] = useState<string | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesTouched, setExpensesTouched] = useState(false);

  const [places, setPlaces] = useState<LocationOut[] | null>(null);
  const [placesErr, setPlacesErr] = useState<string | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesTouched, setPlacesTouched] = useState(false);

  const [votedPollIds, setVotedPollIds] = useState<Set<string>>(() => new Set());

  const [pollFormOpen, setPollFormOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollClosesAt, setPollClosesAt] = useState("");
  const [pollSubmitBusy, setPollSubmitBusy] = useState(false);
  const [pollFormErr, setPollFormErr] = useState<string | null>(null);

  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expSplit, setExpSplit] = useState<Record<string, boolean>>({});
  const [expSubmitBusy, setExpSubmitBusy] = useState(false);
  const [expFormErr, setExpFormErr] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!tripId) {
      setTripErr("Invalid trip");
      setTripLoading(false);
      return;
    }
    setTripLoading(true);
    setTripErr(null);
    try {
      if (typeof window !== "undefined" && !getToken()) {
        throw new Error("Not signed in");
      }
      const t = await apiFetch<TripOut>(`/trips/${tripId}`);
      setTrip(t);
    } catch (e) {
      setTripErr(e instanceof Error ? e.message : "Failed to load trip");
      setTrip(null);
    } finally {
      setTripLoading(false);
    }
  }, [tripId]);

  const loadGroupAndRoster = useCallback(async () => {
    if (!trip?.group_id) return;
    setGroupLoading(true);
    setGroupErr(null);
    try {
      const [g, pub] = await Promise.all([
        apiFetch<GroupOut>(`/groups/${trip.group_id}`),
        apiFetch<TripPublicPreview>(`/trips/${tripId}/public`).catch(
          () => ({ public_participants: [] }) as TripPublicPreview,
        ),
      ]);
      setGroup(g);
      const map: Record<string, string | null> = {};
      for (const p of pub.public_participants) {
        map[p.user_id] = p.trip_note ?? null;
      }
      setRosterByUser(map);
    } catch (e) {
      setGroupErr(e instanceof Error ? e.message : "Failed to load group");
      setGroup(null);
    } finally {
      setGroupLoading(false);
    }
  }, [trip?.group_id, tripId]);

  const loadMe = useCallback(async () => {
    try {
      const u = await apiFetch<MeOut>("/auth/me");
      setMe(u);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (trip?.group_id) void loadGroupAndRoster();
  }, [trip?.group_id, loadGroupAndRoster]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const memberById = useMemo(() => {
    const m = new Map<string, GroupMemberOut>();
    for (const mem of group?.members ?? []) {
      m.set(mem.user_id, mem);
    }
    return m;
  }, [group?.members]);

  const loadPolls = useCallback(async () => {
    setPollsLoading(true);
    setPollsErr(null);
    try {
      const list = await apiFetch<PollOut[]>(`/trips/${tripId}/polls`);
      setPolls(list);
    } catch (e) {
      setPollsErr(e instanceof Error ? e.message : "Failed to load polls");
      setPolls(null);
    } finally {
      setPollsLoading(false);
    }
  }, [tripId]);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    setExpensesErr(null);
    try {
      const [ex, bal] = await Promise.all([
        apiFetch<ExpenseOut[]>(`/trips/${tripId}/expenses`),
        apiFetch<BalanceSummaryItem[]>(
          `/trips/${tripId}/expenses/summary`,
        ),
      ]);
      setExpenses(ex);
      setBalances(bal);
    } catch (e) {
      setExpensesErr(
        e instanceof Error ? e.message : "Failed to load expenses",
      );
      setExpenses(null);
      setBalances(null);
    } finally {
      setExpensesLoading(false);
    }
  }, [tripId]);

  const loadPlaces = useCallback(async () => {
    setPlacesLoading(true);
    setPlacesErr(null);
    try {
      const list = await apiFetch<LocationOut[]>(`/trips/${tripId}/locations`);
      setPlaces(list);
    } catch (e) {
      setPlacesErr(e instanceof Error ? e.message : "Failed to load places");
      setPlaces(null);
    } finally {
      setPlacesLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (activeTab === "polls" && !pollsTouched && tripId) {
      setPollsTouched(true);
      void loadPolls();
    }
  }, [activeTab, pollsTouched, tripId, loadPolls]);

  useEffect(() => {
    if (activeTab === "expenses" && !expensesTouched && tripId) {
      setExpensesTouched(true);
      void loadExpenses();
    }
  }, [activeTab, expensesTouched, tripId, loadExpenses]);

  useEffect(() => {
    if (activeTab === "places" && !placesTouched && tripId) {
      setPlacesTouched(true);
      void loadPlaces();
    }
  }, [activeTab, placesTouched, tripId, loadPlaces]);

  useEffect(() => {
    if (!group?.members?.length) return;
    setExpSplit((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      for (const mem of group.members) next[mem.user_id] = true;
      return next;
    });
  }, [group?.members]);

  const headerMembers = group?.members ?? [];
  const avatarShow = headerMembers.slice(0, 5);
  const avatarMore = Math.max(0, headerMembers.length - 5);

  async function handleVote(poll: PollOut, optionId: string) {
    try {
      await apiFetch<PollOut>(`/polls/${poll.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ option_id: optionId }),
      });
      setVotedPollIds((s) => new Set(s).add(poll.id));
      await loadPolls();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (
        /already voted|conflict/i.test(msg) ||
        msg.toLowerCase().includes("409")
      ) {
        setVotedPollIds((s) => new Set(s).add(poll.id));
        await loadPolls();
        return;
      }
      throw e;
    }
  }

  async function handleCreatePoll(ev: FormEvent) {
    ev.preventDefault();
    setPollFormErr(null);
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2 || opts.length > 4) {
      setPollFormErr("Provide 2–4 options.");
      return;
    }
    let closesIso: string | null = null;
    if (pollClosesAt.trim()) {
      const d = new Date(pollClosesAt);
      if (!Number.isFinite(d.getTime())) {
        setPollFormErr("Invalid close time.");
        return;
      }
      closesIso = d.toISOString();
    }
    setPollSubmitBusy(true);
    try {
      await apiFetch(`/trips/${tripId}/polls`, {
        method: "POST",
        body: JSON.stringify({
          question: pollQuestion.trim(),
          poll_type: "custom",
          options: opts.map((label) => ({ label })),
          closes_at: closesIso,
        }),
      });
      setPollFormOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollClosesAt("");
      await loadPolls();
    } catch (e) {
      setPollFormErr(e instanceof Error ? e.message : "Could not create poll");
    } finally {
      setPollSubmitBusy(false);
    }
  }

  async function handleAddExpense(ev: FormEvent) {
    ev.preventDefault();
    setExpFormErr(null);
    const amount = Number(expAmount);
    if (!expDesc.trim() || !Number.isFinite(amount) || amount <= 0) {
      setExpFormErr("Enter description and a valid amount.");
      return;
    }
    const splitIds = Object.entries(expSplit)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (splitIds.length < 1) {
      setExpFormErr("Select at least one person to split with.");
      return;
    }
    setExpSubmitBusy(true);
    try {
      await apiFetch(`/trips/${tripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: expDesc.trim(),
          amount,
          currency: "USD",
          split_with: splitIds,
        }),
      });
      setExpenseFormOpen(false);
      setExpDesc("");
      setExpAmount("");
      await loadExpenses();
    } catch (e) {
      setExpFormErr(e instanceof Error ? e.message : "Could not add expense");
    } finally {
      setExpSubmitBusy(false);
    }
  }

  if (tripLoading && !trip) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-white" />
          <div className="h-10 w-3/4 animate-pulse rounded-xl bg-white" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (tripErr || !trip) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-red-700">{tripErr ?? "Trip not found"}</p>
          <button
            type="button"
            onClick={() => void loadTrip()}
            className="mt-4 rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: ORANGE }}
          >
            Retry
          </button>
          <Link
            href="/trips"
            className="mt-3 block text-sm"
            style={{ color: NAVY }}
          >
            ← Back to trips
          </Link>
        </div>
      </div>
    );
  }

  const dateLine =
    trip.start_date || trip.end_date
      ? [trip.start_date, trip.end_date].filter(Boolean).join(" → ")
      : "Dates TBD";

  const destLine = trip.description?.trim() || "—";

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 pb-10 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={{ color: NAVY }}
          >
            ← Back to trips
          </Link>
        </div>

        <header className="rounded-2xl border border-[#E9ECEF] bg-white p-5 shadow-sm">
          <h1
            className="text-2xl font-bold tracking-tight md:text-3xl"
            style={{ color: NAVY }}
          >
            {trip.title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{destLine}</p>
          <p className="mt-1 text-sm text-gray-500">{dateLine}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold uppercase ${tripStatusBadgeClass(trip.status)}`}
              style={
                trip.status === "ongoing" ? { backgroundColor: "#FDECEF" } : undefined
              }
            >
              {trip.status === "ongoing" && (
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full"
                  style={tripStatusDotStyle(trip.status)}
                  aria-hidden
                />
              )}
              {tripStatusLabel(trip.status)}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {groupLoading && (
              <div className="h-10 w-48 animate-pulse rounded-full bg-gray-100" />
            )}
            {!groupLoading &&
              avatarShow.map((m) => (
                <img
                  key={m.user_id}
                  src={avatarDiceBear(m.user_id)}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-white ring-2 ring-gray-100"
                  width={40}
                  height={40}
                />
              ))}
            {avatarMore > 0 && (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECEF] bg-gray-50 text-xs font-semibold text-gray-600"
                title={`${avatarMore} more`}
              >
                +{avatarMore}
              </span>
            )}
            {groupErr && (
              <span className="text-xs text-red-600">{groupErr}</span>
            )}
          </div>
        </header>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#E9ECEF] bg-white p-1 shadow-sm">
          {(
            [
              ["polls", "Polls"],
              ["expenses", "Expenses"],
              ["members", "Members"],
              ["places", "Places"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-w-[5.5rem] flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
                activeTab === id
                  ? "text-white shadow-sm"
                  : "bg-transparent text-gray-600 hover:bg-gray-50"
              }`}
              style={
                activeTab === id ? { backgroundColor: ORANGE } : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "polls" && (
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                Polls
              </h2>
              <button
                type="button"
                onClick={() => setPollFormOpen((o) => !o)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9ECEF] bg-white text-lg font-bold text-gray-700 shadow-sm"
                aria-label="Create poll"
                style={{ color: ORANGE }}
              >
                +
              </button>
            </div>

            {pollFormOpen && (
              <form
                onSubmit={handleCreatePoll}
                className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
              >
                <label className="block text-sm font-medium text-gray-700">
                  Question
                  <input
                    className="mt-1 w-full rounded-xl border border-[#E9ECEF] px-3 py-2 text-gray-900"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <p className="mt-3 text-sm font-medium text-gray-700">Options</p>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-xl border border-[#E9ECEF] px-3 py-2"
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[idx] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        className="rounded-xl px-2 text-gray-500 hover:bg-gray-50"
                        onClick={() =>
                          setPollOptions((o) => o.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      className="text-sm font-medium"
                      style={{ color: NAVY }}
                      onClick={() => setPollOptions((o) => [...o, ""])}
                    >
                      + Add option
                    </button>
                )}
                </div>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  Close time (optional)
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-[#E9ECEF] px-3 py-2"
                    value={pollClosesAt}
                    onChange={(e) => setPollClosesAt(e.target.value)}
                  />
                </label>
                {pollFormErr && (
                  <p className="mt-2 text-sm text-red-600">{pollFormErr}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={pollSubmitBusy}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {pollSubmitBusy ? "Creating…" : "Create poll"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#E9ECEF] px-4 py-2 text-sm text-gray-700"
                    onClick={() => setPollFormOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {pollsLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded-2xl bg-white shadow-sm"
                  />
                ))}
              </div>
            )}
            {pollsErr && !pollsLoading && (
              <div className="rounded-2xl border border-red-100 bg-white p-4 text-red-700">
                {pollsErr}
                <button
                  type="button"
                  className="mt-2 block text-sm font-medium"
                  style={{ color: ORANGE }}
                  onClick={() => void loadPolls()}
                >
                  Retry
                </button>
              </div>
            )}
            {polls && !pollsLoading && polls.length === 0 && (
              <p className="text-sm text-gray-500">No polls yet.</p>
            )}
            {polls &&
              !pollsLoading &&
              polls.map((poll) => {
                const totalVotes = poll.options.reduce(
                  (a, o) => a + (o.vote_count || 0),
                  0,
                );
                const maxVotes = Math.max(
                  0,
                  ...poll.options.map((o) => o.vote_count || 0),
                );
                const closed = pollClosedLabel(poll) === "CLOSED";
                const showVote = pollIsOpen(poll) && !votedPollIds.has(poll.id);
                const winningIds = new Set(
                  poll.options
                    .filter((o) => (o.vote_count || 0) === maxVotes && maxVotes > 0)
                    .map((o) => o.id),
                );

                return (
                  <article
                    key={poll.id}
                    className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3
                        className="text-base font-semibold"
                        style={{ color: NAVY }}
                      >
                        {poll.question}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          closed
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {pollClosedLabel(poll)}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {poll.options.map((opt) => {
                        const pct =
                          totalVotes > 0
                            ? Math.round(
                                ((opt.vote_count || 0) / totalVotes) * 100,
                              )
                            : 0;
                        const isWin =
                          closed && winningIds.has(opt.id) && maxVotes > 0;
                        return (
                          <li key={opt.id}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span
                                className={`font-medium ${isWin ? "text-green-700" : "text-gray-800"}`}
                              >
                                {opt.label}
                              </span>
                              <span className="text-gray-500">
                                {opt.vote_count ?? 0} votes
                              </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full transition-[width] ${
                                  isWin ? "bg-green-500" : "bg-gray-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {showVote && (
                              <button
                                type="button"
                                className="mt-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-white"
                                style={{ backgroundColor: ORANGE }}
                                onClick={() => void handleVote(poll, opt.id)}
                              >
                                Vote
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
          </section>
        )}

        {activeTab === "expenses" && (
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                Expenses
              </h2>
              <button
                type="button"
                onClick={() => setExpenseFormOpen((o) => !o)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9ECEF] bg-white text-lg font-bold shadow-sm"
                style={{ color: ORANGE }}
                aria-label="Add expense"
              >
                +
              </button>
            </div>

            {expenseFormOpen && (
              <form
                onSubmit={handleAddExpense}
                className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
              >
                <p className="text-xs text-gray-500">
                  The signed-in member pays; split is shared across selected
                  members (API does not support choosing another payer).
                </p>
                <label className="mt-3 block text-sm font-medium text-gray-700">
                  Description
                  <input
                    className="mt-1 w-full rounded-xl border border-[#E9ECEF] px-3 py-2"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    required
                  />
                </label>
                <label className="mt-3 block text-sm font-medium text-gray-700">
                  Amount
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="mt-1 w-full rounded-xl border border-[#E9ECEF] px-3 py-2"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                  />
                </label>
                <p className="mt-3 text-sm font-medium text-gray-700">
                  Split among
                </p>
                <div className="mt-2 space-y-2">
                  {(group?.members ?? []).map((m) => (
                    <label
                      key={m.user_id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E9ECEF] px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={expSplit[m.user_id] !== false}
                        onChange={(e) =>
                          setExpSplit((s) => ({
                            ...s,
                            [m.user_id]: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm">{m.full_name}</span>
                    </label>
                  ))}
                </div>
                {expFormErr && (
                  <p className="mt-2 text-sm text-red-600">{expFormErr}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={expSubmitBusy}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {expSubmitBusy ? "Saving…" : "Add expense"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#E9ECEF] px-4 py-2 text-sm"
                    onClick={() => setExpenseFormOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {expensesLoading && (
              <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
            )}
            {expensesErr && !expensesLoading && (
              <div className="rounded-2xl border border-red-100 bg-white p-4 text-red-700">
                {expensesErr}
                <button
                  type="button"
                  className="mt-2 block text-sm font-medium"
                  style={{ color: ORANGE }}
                  onClick={() => void loadExpenses()}
                >
                  Retry
                </button>
              </div>
            )}

            {balances && expenses && !expensesLoading && (
              <>
                <div className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: NAVY }}
                  >
                    Who owes whom
                  </h3>
                  {balances.length === 0 ? (
                    <p className="mt-3 text-sm font-medium text-green-700">
                      All settled up!
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {balances.map((row, i) => {
                        const fromN =
                          memberById.get(row.from_user_id)?.full_name ??
                          row.from_user_id;
                        const toN =
                          memberById.get(row.to_user_id)?.full_name ??
                          row.to_user_id;
                        const youOwe =
                          me && row.from_user_id === me.id && row.amount > 0;
                        const owedYou =
                          me && row.to_user_id === me.id && row.amount > 0;
                        return (
                          <li
                            key={`${row.from_user_id}-${row.to_user_id}-${i}`}
                            className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                              youOwe
                                ? "border-[#E94560]/30 bg-[#fff0f3]"
                                : owedYou
                                  ? "border-green-200 bg-green-50"
                                  : "border-gray-100 bg-gray-50"
                            }`}
                          >
                            <img
                              src={avatarDiceBear(row.from_user_id)}
                              alt=""
                              className="h-8 w-8 rounded-full"
                              width={32}
                              height={32}
                            />
                            <span className="font-medium">{fromN}</span>
                            <span className="text-gray-500">owes</span>
                            <img
                              src={avatarDiceBear(row.to_user_id)}
                              alt=""
                              className="h-8 w-8 rounded-full"
                              width={32}
                              height={32}
                            />
                            <span className="font-medium">{toN}</span>
                            <span className="ml-auto font-semibold tabular-nums">
                              ${row.amount.toFixed(2)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="space-y-3">
                  {expenses.length === 0 && (
                    <p className="text-sm text-gray-500">No expenses yet.</p>
                  )}
                  {expenses.map((ex) => {
                    const payer = memberById.get(ex.paid_by);
                    return (
                      <article
                        key={ex.id}
                        className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900">
                            {ex.description}
                          </p>
                          <p className="text-lg font-bold tabular-nums text-gray-900">
                            {ex.currency} {ex.amount.toFixed(2)}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                          <img
                            src={avatarDiceBear(ex.paid_by)}
                            alt=""
                            className="h-8 w-8 rounded-full"
                            width={32}
                            height={32}
                          />
                          <span>
                            Paid by{" "}
                            <span className="font-medium text-gray-800">
                              {payer?.full_name ?? "Member"}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(ex.created_at).toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          Split among {ex.splits.length} member
                          {ex.splits.length === 1 ? "" : "s"}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "members" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Members
            </h2>
            {groupLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl bg-white"
                  />
                ))}
              </div>
            )}
            {groupErr && !groupLoading && (
              <p className="text-sm text-red-600">{groupErr}</p>
            )}
            {!groupLoading &&
              group?.members.map((m) => {
                const online = onlineFromLastSeen(m.last_seen_at, 5);
                const note = rosterByUser[m.user_id];
                return (
                  <div
                    key={m.id}
                    className="flex gap-3 rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
                  >
                    <img
                      src={avatarDiceBear(m.user_id)}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full"
                      width={48}
                      height={48}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-semibold text-gray-900"
                          style={{ color: NAVY }}
                        >
                          {m.full_name}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            m.role === "admin"
                              ? "text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                          style={
                            m.role === "admin"
                              ? { backgroundColor: NAVY }
                              : undefined
                          }
                        >
                          {m.role === "admin" ? "ADMIN" : "MEMBER"}
                        </span>
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: online ? "#22c55e" : "#ef4444",
                          }}
                          title={online ? "Online" : "Offline"}
                          aria-label={online ? "Online" : "Offline"}
                        />
                      </div>
                      {me?.id === m.user_id && me.username ? (
                        <p className="text-sm text-gray-500">
                          @{me.username}
                        </p>
                      ) : null}
                      {note && (
                        <p className="mt-1 text-sm italic text-gray-500">
                          {note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </section>
        )}

        {activeTab === "places" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Places
            </h2>
            {placesLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl bg-white"
                  />
                ))}
              </div>
            )}
            {placesErr && !placesLoading && (
              <div className="rounded-2xl border border-red-100 bg-white p-4 text-red-700">
                {placesErr}
                <button
                  type="button"
                  className="mt-2 block text-sm font-medium"
                  style={{ color: ORANGE }}
                  onClick={() => void loadPlaces()}
                >
                  Retry
                </button>
              </div>
            )}
            {places && !placesLoading && places.length === 0 && (
              <p className="text-sm text-gray-500">No places on this trip.</p>
            )}
            {places &&
              !placesLoading &&
              places.map((loc) => {
                const flag = flagBadge(loc.category);
                const subtitle =
                  loc.address?.trim() ||
                  `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
                return (
                  <article
                    key={loc.id}
                    className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${flag.className}`}
                      >
                        {flag.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
                  </article>
                );
              })}
          </section>
        )}
      </div>
    </div>
  );
}
