"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

type TripPublicPreview = {
  trip: {
    id: string;
    group_id: string;
    title: string;
    description: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
  };
  locations: {
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    category: string | null;
  }[];
  member_count_total: number;
  member_count_private: number;
  member_count_public: number;
  public_participants: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    trip_note: string | null;
    is_online: boolean;
  }[];
  viewer_is_member: boolean;
  viewer_has_pending_request: boolean;
  viewer_is_group_admin: boolean;
};

type PendingTripJoin = {
  id: string;
  user_full_name: string;
  user_email: string;
  message: string | null;
};

function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function TripPublicPage() {
  const params = useParams();
  const tripId =
    typeof params.tripId === "string"
      ? params.tripId
      : Array.isArray(params.tripId)
        ? params.tripId[0]
        : "";

  const [data, setData] = useState<TripPublicPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinInfo, setJoinInfo] = useState<string | null>(null);
  const [rosterNote, setRosterNote] = useState("");
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterInfo, setRosterInfo] = useState<string | null>(null);
  const [session, setSession] = useState(false);
  const [adminJoins, setAdminJoins] = useState<PendingTripJoin[]>([]);
  const [adminBusy, setAdminBusy] = useState<string | null>(null);

  useEffect(() => {
    setSession(isLoggedIn());
  }, []);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<TripPublicPreview>(`/trips/${tripId}/public`);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load trip");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.viewer_is_group_admin || !tripId) {
      setAdminJoins([]);
      return;
    }
    let c = false;
    void apiFetch<
      {
        id: string;
        user_full_name: string;
        user_email: string;
        message: string | null;
      }[]
    >(`/trips/${tripId}/join-requests`)
      .then((rows) => {
        if (!c)
          setAdminJoins(
            rows.map((r) => ({
              id: r.id,
              user_full_name: r.user_full_name,
              user_email: r.user_email,
              message: r.message,
            })),
          );
      })
      .catch(() => {
        if (!c) setAdminJoins([]);
      });
    return () => {
      c = true;
    };
  }, [data?.viewer_is_group_admin, tripId]);

  useEffect(() => {
    if (!data?.viewer_is_member || !isLoggedIn()) return;
    let cancelled = false;
    void apiFetch<{ id: string }>("/auth/me").then((me) => {
      if (cancelled) return;
      const self = data.public_participants.find((p) => p.user_id === me.id);
      if (self?.trip_note) setRosterNote(self.trip_note);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function onRequestJoin() {
    if (!isLoggedIn()) {
      setJoinInfo("Sign in to request to join.");
      return;
    }
    setJoinBusy(true);
    setJoinInfo(null);
    try {
      await apiFetch(`/trips/${tripId}/join-requests`, {
        method: "POST",
        body: JSON.stringify({
          message: joinMessage.trim() || null,
        }),
      });
      setJoinInfo("Request sent. A group admin will review it.");
      setJoinMessage("");
      await load();
    } catch (e) {
      setJoinInfo(e instanceof Error ? e.message : "Request failed");
    } finally {
      setJoinBusy(false);
    }
  }

  async function onApproveJoin(requestId: string) {
    setAdminBusy(requestId);
    try {
      await apiFetch(`/trips/join-requests/${requestId}/approve`, {
        method: "PATCH",
      });
      await load();
      const rows = await apiFetch<
        {
          id: string;
          user_full_name: string;
          user_email: string;
          message: string | null;
        }[]
      >(`/trips/${tripId}/join-requests`);
      setAdminJoins(
        rows.map((r) => ({
          id: r.id,
          user_full_name: r.user_full_name,
          user_email: r.user_email,
          message: r.message,
        })),
      );
    } finally {
      setAdminBusy(null);
    }
  }

  async function onDenyJoin(requestId: string) {
    setAdminBusy(requestId);
    try {
      await apiFetch(`/trips/join-requests/${requestId}/deny`, {
        method: "PATCH",
      });
      await load();
      const rows = await apiFetch<
        {
          id: string;
          user_full_name: string;
          user_email: string;
          message: string | null;
        }[]
      >(`/trips/${tripId}/join-requests`);
      setAdminJoins(
        rows.map((r) => ({
          id: r.id,
          user_full_name: r.user_full_name,
          user_email: r.user_email,
          message: r.message,
        })),
      );
    } finally {
      setAdminBusy(null);
    }
  }

  async function onSaveRosterNote() {
    setRosterBusy(true);
    setRosterInfo(null);
    try {
      await apiFetch(`/trips/${tripId}/roster`, {
        method: "PATCH",
        body: JSON.stringify({ note: rosterNote.trim() || null }),
      });
      setRosterInfo("Saved.");
      await load();
    } catch (e) {
      setRosterInfo(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRosterBusy(false);
    }
  }

  const tripsHref = session ? "/trips" : "/login";

  if (!tripId) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-700">Missing trip id.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
        <p className="text-sm text-gray-600">Loading trip…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 md:p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? "Not found"}
        </p>
        <Link
          href={tripsHref}
          className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          {session ? "← Back to trips" : "← Sign in"}
        </Link>
      </div>
    );
  }

  const t = data.trip;

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={tripsHref}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {session ? "← Trips" : "← Sign in"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {t.start_date ?? "—"} → {t.end_date ?? "—"} ·{" "}
            <span className="capitalize">{t.status.replace("_", " ")}</span>
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <span className="font-mono text-xs text-gray-500">ID: {t.id}</span>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(t.id)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            Copy trip ID
          </button>
        </div>
      </div>

      {t.description ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-700">
          {t.description}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Places & geo</h2>
          <p className="mt-1 text-xs text-gray-500">
            Shared preview only — no trip chat or feed here.
          </p>
          {data.locations.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No locations linked yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.locations.map((loc) => (
                <li
                  key={loc.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-gray-900">{loc.name}</p>
                  {loc.address ? (
                    <p className="mt-1 text-sm text-gray-600">{loc.address}</p>
                  ) : null}
                  <a
                    href={mapsLink(loc.latitude, loc.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                  >
                    Open map
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Who’s going</h2>
          <p className="mt-1 text-xs text-gray-500">
            Private profiles are counted but not named. No messaging from this
            screen.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium text-gray-900">
                {data.member_count_total}
              </span>{" "}
              in this trip’s group
            </li>
            <li>
              <span className="font-medium text-gray-900">
                {data.member_count_public}
              </span>{" "}
              with a public profile (names below)
            </li>
            <li>
              <span className="font-medium text-gray-900">
                {data.member_count_private}
              </span>{" "}
              with a private profile (hidden names)
            </li>
          </ul>

          <ul className="mt-6 space-y-4">
            {data.public_participants.map((p) => (
              <li
                key={p.user_id}
                className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4"
              >
                <div className="relative shrink-0">
                  <Avatar name={p.full_name} src={p.avatar_url} size={44} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                      p.is_online ? "bg-emerald-500" : "bg-red-400"
                    }`}
                    title={p.is_online ? "Active on site" : "Not active"}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{p.full_name}</p>
                  {p.trip_note ? (
                    <p className="mt-1 text-sm text-gray-600">
                      &ldquo;{p.trip_note}&rdquo;
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">No note yet</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {data.viewer_is_group_admin ? (
        <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <h3 className="text-sm font-semibold text-amber-950">
            Pending join requests (admin)
          </h3>
          {adminJoins.length === 0 ? (
            <p className="mt-2 text-sm text-amber-900/80">No pending requests.</p>
          ) : (
          <ul className="mt-3 space-y-3">
            {adminJoins.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{r.user_full_name}</p>
                  <p className="text-sm text-gray-600">{r.user_email}</p>
                  {r.message ? (
                    <p className="mt-1 text-sm text-gray-700">&ldquo;{r.message}&rdquo;</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={adminBusy === r.id}
                    onClick={() => void onApproveJoin(r.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={adminBusy === r.id}
                    onClick={() => void onDenyJoin(r.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
          )}
        </section>
      ) : null}

      <div className="mt-10 border-t border-gray-200 pt-8">
        {data.viewer_is_member ? (
          <div className="max-w-lg space-y-4">
            <p className="text-sm font-medium text-gray-900">You’re in this group</p>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Your public trip note (optional)
              </label>
              <textarea
                value={rosterNote}
                onChange={(e) => setRosterNote(e.target.value)}
                rows={3}
                placeholder="What you’re looking forward to…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                type="button"
                disabled={rosterBusy}
                onClick={() => void onSaveRosterNote()}
                className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {rosterBusy ? "Saving…" : "Save note"}
              </button>
              {rosterInfo ? (
                <p className="mt-2 text-sm text-gray-600">{rosterInfo}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Request to join
            </h3>
            <p className="text-sm text-gray-600">
              Ask to join this trip’s group. You won’t see chats until a group
              admin approves.
            </p>
            {data.viewer_has_pending_request ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Your request is pending.
              </p>
            ) : (
              <>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  rows={3}
                  placeholder="Optional message to admins"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <button
                  type="button"
                  disabled={joinBusy}
                  onClick={() => void onRequestJoin()}
                  className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {joinBusy ? "Sending…" : "Request to join"}
                </button>
              </>
            )}
            {joinInfo ? (
              <p className="text-sm text-gray-600">{joinInfo}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
