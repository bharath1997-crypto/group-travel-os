"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";

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

type GroupListItem = { id: string; name: string };

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTripId(raw: string): string | null {
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchRaw, setSearchRaw] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await apiFetch<GroupListItem[]>("/groups");
        if (!cancelled && g.length > 0) setGroupId(g[0].id);
        if (!cancelled) setGroups(g);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const groupList = await apiFetch<GroupListItem[]>("/groups");
        const lists = await Promise.all(
          groupList.map((g) =>
            apiFetch<TripOut[]>(`/groups/${g.id}/trips`).catch(() => [] as TripOut[]),
          ),
        );
        const merged = lists.flat();
        merged.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        if (!cancelled) setTrips(merged);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load trips");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSearchErr(null);
      const id = normalizeTripId(searchRaw);
      if (!id) {
        setSearchErr("Paste a valid trip ID (UUID).");
        return;
      }
      router.push(`/trips/${id}`);
    },
    [searchRaw, router],
  );

  const onCreateTrip = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const t = title.trim();
      if (!groupId) {
        setCreateErr("Create or join a group first.");
        return;
      }
      if (!t) {
        setCreateErr("Title is required.");
        return;
      }
      setCreateErr(null);
      setCreateBusy(true);
      setCreatedId(null);
      try {
        const body: Record<string, string | null> = { title: t };
        const d = description.trim();
        if (d) body.description = d;
        if (start) body.start_date = start;
        if (end) body.end_date = end;
        const trip = await apiFetch<TripOut>(`/groups/${groupId}/trips`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setCreatedId(trip.id);
        setTitle("");
        setDescription("");
        setStart("");
        setEnd("");
        router.push(`/trips/${trip.id}`);
      } catch (err) {
        setCreateErr(err instanceof Error ? err.message : "Failed to create trip");
      } finally {
        setCreateBusy(false);
      }
    },
    [groupId, title, description, start, end, router],
  );

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F3460]">Trips</h1>
          <p className="text-sm text-gray-600">
            Create trips, share the trip ID, preview what others see before they
            join.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen((v) => !v);
            setCreateErr(null);
          }}
          className="shrink-0 rounded-lg bg-[#E94560] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
        >
          {createOpen ? "Close form" : "Create trip"}
        </button>
      </div>

      <form
        onSubmit={onSearch}
        className="mt-8 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="trip-search-id"
            className="block text-xs font-medium text-gray-700"
          >
            Open trip by ID
          </label>
          <input
            id="trip-search-id"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Paste trip UUID"
            className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 font-mono text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
          />
          {searchErr ? (
            <p className="mt-1 text-xs text-red-700">{searchErr}</p>
          ) : null}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#E94560] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
        >
          View trip
        </button>
      </form>

      {createOpen ? (
        <form
          onSubmit={onCreateTrip}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-[#0F3460]">New trip</h2>
          <p className="mt-1 text-xs text-gray-500">
            The trip ID is created automatically — share it so others can preview
            and request to join.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">
                Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
              >
                {groups.length === 0 ? (
                  <option value="">No groups — create one under Groups</option>
                ) : (
                  groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">
                Title <span className="text-red-600">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                placeholder="Summer in Lisbon"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Start
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                End
              </label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
              />
            </div>
          </div>
          {createErr ? (
            <p className="mt-3 text-sm text-red-700">{createErr}</p>
          ) : null}
          {createdId ? (
            <p className="mt-3 font-mono text-xs text-gray-600">
              Last created ID: {createdId}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={createBusy}
              className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
            >
              {createBusy ? "Creating…" : "Create & open"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading trips…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : trips.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <p className="text-lg font-medium text-[#0F3460]">No trips yet</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            Use <span className="font-medium">Create trip</span> above (pick a
            group first).
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {trips.map((t) => (
            <li key={t.id}>
              <Link
                href={`/trips/${t.id}`}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[#2C3E50]">{t.title}</p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{t.id}</p>
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
    </div>
  );
}
