"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_seen_at?: string | null;
  is_online?: boolean;
  has_mobile_app?: boolean;
};

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  is_accepting_members?: boolean;
  created_by: string;
  created_at: string;
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
  created_by: string;
  created_at: string;
  updated_at: string;
};

type PendingRequestOut = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  user_full_name: string;
  user_email: string;
};

function decodeJwtSub(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const payload = JSON.parse(atob(b64)) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "planning":
      return "bg-blue-100 text-blue-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "ongoing":
      return "bg-yellow-100 text-yellow-900";
    case "completed":
      return "bg-gray-200 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return d;
}

const INVITE_BASE = "http://localhost:3000/join";

export default function GroupDetailPage() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupOut | null>(null);
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [tripDescription, setTripDescription] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripSubmitting, setTripSubmitting] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestOut[]>(
    [],
  );
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(decodeJwtSub(getToken()));
  }, []);

  const isAdmin = useMemo(
    () =>
      !!group &&
      !!currentUserId &&
      (group.created_by === currentUserId ||
        group.members.some(
          (m) => m.user_id === currentUserId && m.role === "admin",
        )),
    [group, currentUserId],
  );

  const accepting = group?.is_accepting_members ?? true;

  const loadData = useCallback(async () => {
    if (!id) return;
    const [g, t] = await Promise.all([
      apiFetch<GroupOut>(`/groups/${id}`),
      apiFetch<TripOut[]>(`/groups/${id}/trips`),
    ]);
    setGroup(g);
    const sorted = [...t].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setTrips(sorted);
  }, [id]);

  const loadPendingRequests = useCallback(async () => {
    if (!id || !isAdmin) return;
    try {
      const list = await apiFetch<PendingRequestOut[]>(
        `/groups/${id}/join-requests`,
      );
      setPendingRequests(list);
    } catch {
      setPendingRequests([]);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing group id");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadData();
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load group");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadData]);

  useEffect(() => {
    if (!isAdmin || !id) {
      setPendingRequests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<PendingRequestOut[]>(
          `/groups/${id}/join-requests`,
        );
        if (!cancelled) setPendingRequests(list);
      } catch {
        if (!cancelled) setPendingRequests([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, group?.id]);

  const closeTripForm = useCallback(() => {
    setShowTripForm(false);
    setTripTitle("");
    setTripDescription("");
    setTripStart("");
    setTripEnd("");
    setTripError(null);
  }, []);

  const handleToggleAccepting = useCallback(async () => {
    if (!id || toggleLoading) return;
    setToggleLoading(true);
    try {
      await apiFetch(`/groups/${id}/toggle-membership`, { method: "PATCH" });
      const refreshed = await apiFetch<GroupOut>(`/groups/${id}`);
      setGroup((prev) => {
        if (typeof refreshed.is_accepting_members === "boolean") {
          return refreshed;
        }
        if (!prev) return refreshed;
        return {
          ...refreshed,
          is_accepting_members: !(prev.is_accepting_members ?? true),
        };
      });
    } finally {
      setToggleLoading(false);
    }
  }, [id, toggleLoading]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!group?.invite_code) return;
    const url = `${INVITE_BASE}/${group.invite_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }, [group?.invite_code]);

  const handleApprove = useCallback(
    async (requestId: string) => {
      setRequestBusyId(requestId);
      try {
        await apiFetch(`/groups/join-requests/${requestId}/approve`, {
          method: "PATCH",
        });
        await loadPendingRequests();
      } finally {
        setRequestBusyId(null);
      }
    },
    [loadPendingRequests],
  );

  const handleDeny = useCallback(
    async (requestId: string) => {
      setRequestBusyId(requestId);
      try {
        await apiFetch(`/groups/join-requests/${requestId}/deny`, {
          method: "PATCH",
        });
        await loadPendingRequests();
      } finally {
        setRequestBusyId(null);
      }
    },
    [loadPendingRequests],
  );

  const handleCreateTrip = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const title = tripTitle.trim();
      if (!title) {
        setTripError("Title is required.");
        return;
      }
      setTripError(null);
      setTripSubmitting(true);
      try {
        const body: {
          title: string;
          description?: string;
          start_date?: string;
          end_date?: string;
        } = { title };
        const desc = tripDescription.trim();
        if (desc) body.description = desc;
        if (tripStart) body.start_date = tripStart;
        if (tripEnd) body.end_date = tripEnd;

        await apiFetch(`/groups/${id}/trips`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        await loadData();
        closeTripForm();
      } catch (err) {
        setTripError(
          err instanceof Error ? err.message : "Failed to create trip",
        );
      } finally {
        setTripSubmitting(false);
      }
    },
    [
      id,
      tripTitle,
      tripDescription,
      tripStart,
      tripEnd,
      loadData,
      closeTripForm,
    ],
  );

  const inviteUrl = group ? `${INVITE_BASE}/${group.invite_code}` : "";
  const pendingCount = pendingRequests.length;
  const creatorMember = group
    ? group.members.find((m) => m.user_id === group.created_by)
    : undefined;
  const creatorSeed =
    creatorMember?.full_name?.trim() || group?.name || "Group";

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/travel-hub"
        className="inline-flex text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        ← Back to groups
      </Link>

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : group ? (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-[#0F3460]">Members</h2>
            <p className="mt-1 text-xs text-gray-500">
              Green: active on the website recently. Red: inactive. App icon:
              mobile app logged in.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
                >
                  <span className="relative shrink-0">
                    <Avatar name={m.full_name} src={m.avatar_url} size={36} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        m.is_online ? "bg-emerald-500" : "bg-red-400"
                      }`}
                      title={m.is_online ? "Active on site" : "Inactive"}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#2C3E50]">
                      {m.full_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                  </div>
                  {m.has_mobile_app ? (
                    <span className="text-base" title="Mobile app connected">
                      📱
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <header className="mt-10 border-b border-gray-200 pb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar
                  name={creatorSeed}
                  src={creatorMember?.avatar_url ?? null}
                  size={36}
                />
                <div>
                  <h1 className="text-2xl font-semibold text-[#0F3460]">
                    {group.name}
                  </h1>
                  <p className="mt-2 font-mono text-sm text-gray-700">
                    Invite code: {group.invite_code}
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span
                      className={`text-sm font-medium ${accepting ? "text-green-700" : "text-gray-500"}`}
                    >
                      {accepting ? "Accepting Members" : "Closed"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={accepting}
                      disabled={toggleLoading}
                      onClick={() => void handleToggleAccepting()}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:ring-offset-2 disabled:opacity-50 ${accepting ? "bg-[#2ECC71]" : "bg-gray-300"}`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform ${accepting ? "translate-x-5" : "translate-x-0"}`}
                        aria-hidden
                      />
                    </button>
                  </div>

                  {accepting ? (
                    <div className="flex w-full max-w-md flex-col gap-2 sm:items-end">
                      <p className="text-xs text-gray-500">Invite link</p>
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <span className="truncate rounded-lg bg-gray-100 px-3 py-2 text-left text-xs text-gray-800 sm:max-w-xs">
                          {inviteUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyInviteLink()}
                          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          {linkCopied ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setPendingExpanded((v) => !v)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 sm:w-auto"
                    >
                      Pending requests
                      {pendingCount > 0 ? (
                        <span className="inline-flex min-w-[1.5rem] justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          {pendingCount}
                        </span>
                      ) : null}
                    </button>

                    {pendingExpanded ? (
                      <ul className="mt-3 w-full max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm">
                        {pendingRequests.length === 0 ? (
                          <li className="text-sm text-gray-500">
                            No pending requests.
                          </li>
                        ) : (
                          pendingRequests.map((req) => (
                            <li
                              key={req.id}
                              className="flex flex-col gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-start gap-3">
                                <Avatar
                                  name={req.user_full_name}
                                  size={36}
                                  className="mt-0.5"
                                />
                                <div>
                                  <p className="font-medium text-[#2C3E50]">
                                    {req.user_full_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {req.user_email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={requestBusyId === req.id}
                                  onClick={() => void handleApprove(req.id)}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={requestBusyId === req.id}
                                  onClick={() => void handleDeny(req.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Deny
                                </button>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </header>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#0F3460]">Trips</h2>
            <button
              type="button"
              onClick={() => {
                setShowTripForm(true);
                setTripError(null);
              }}
              className="rounded-lg bg-[#E94560] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
            >
              Create Trip
            </button>
          </div>

          {showTripForm ? (
            <form
              onSubmit={handleCreateTrip}
              className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-[#0F3460]">New trip</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="trip-title"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Title <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="trip-title"
                    value={tripTitle}
                    onChange={(e) => setTripTitle(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                    placeholder="Summer in Lisbon"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="trip-description"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Description{" "}
                    <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    id="trip-description"
                    value={tripDescription}
                    onChange={(e) => setTripDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                  />
                </div>
                <div>
                  <label
                    htmlFor="trip-start"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Start date
                  </label>
                  <input
                    id="trip-start"
                    type="date"
                    value={tripStart}
                    onChange={(e) => setTripStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                  />
                </div>
                <div>
                  <label
                    htmlFor="trip-end"
                    className="block text-xs font-medium text-gray-700"
                  >
                    End date
                  </label>
                  <input
                    id="trip-end"
                    type="date"
                    value={tripEnd}
                    onChange={(e) => setTripEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                  />
                </div>
              </div>
              {tripError ? (
                <p className="mt-3 text-sm text-red-700">{tripError}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={tripSubmitting}
                  className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
                >
                  {tripSubmitting ? "Creating…" : "Create Trip"}
                </button>
                <button
                  type="button"
                  onClick={closeTripForm}
                  disabled={tripSubmitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {trips.length === 0 ? (
            <p className="mt-8 text-center text-sm text-gray-600">
              No trips yet. Create one to get started.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {trips.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="flex flex-col gap-3 px-4 py-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-[#2C3E50]">{t.title}</p>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {t.id}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatDate(t.start_date)} → {formatDate(t.end_date)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(t.status)}`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
