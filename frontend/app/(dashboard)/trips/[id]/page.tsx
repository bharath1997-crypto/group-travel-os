"use client";

import dynamic from "next/dynamic";
import L from "leaflet";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { LoadingSkeleton, TabSwitcher } from "@/components/trips";
import { apiFetch, apiFetchWithStatus } from "@/lib/api";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const MapBounds = dynamic(
  () =>
    Promise.all([import("react-leaflet"), import("react")]).then(
      ([leaf, React]) => {
        function Inner({ pts }: { pts: [number, number][] }) {
          const map = leaf.useMap();
          React.useEffect(() => {
            if (pts.length === 0) return;
            map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
          }, [map, pts]);
          return null;
        }
        return Inner;
      },
    ),
  { ssr: false },
);
const MapClick = dynamic(
  () =>
    import("react-leaflet").then((leaf) => {
      function Inner({
        onPick,
      }: {
        onPick: (lat: number, lng: number) => void;
      }) {
        leaf.useMapEvents({
          click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";

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

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type ExpenseOut = {
  id: string;
  trip_id: string;
  paid_by: string;
  description: string;
  amount: number;
  currency: string;
  created_at: string;
  splits: { id: string; user_id: string; amount: number; is_settled: boolean }[];
};

type BalanceSummaryItem = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type PollOptionOut = {
  id: string;
  poll_id: string;
  label: string;
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

type LocationOut = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
};

type ParsedTripDesc = {
  v?: number;
  type?: string;
  locations?: unknown[];
  legs?: unknown[];
  td?: number;
  ec?: number;
  budget?: number;
  day_notes?: Record<string, string>;
};

type TabId =
  | "overview"
  | "itinerary"
  | "expenses"
  | "polls"
  | "members"
  | "map";

function diceBear(id: string) {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(id)}`;
}

function parseDesc(desc: string | null): ParsedTripDesc {
  if (!desc) return {};
  try {
    return JSON.parse(desc) as ParsedTripDesc;
  } catch {
    return {};
  }
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mergeDescNotes(
  desc: string | null,
  dayKey: string,
  note: string,
): string {
  const p = parseDesc(desc);
  const next = {
    ...p,
    day_notes: { ...(p.day_notes ?? {}), [dayKey]: note },
  };
  let s = JSON.stringify(next);
  if (s.length > 1000) s = s.slice(0, 1000);
  return s;
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [tab, setTab] = useState<TabId>("overview");
  const [trip, setTrip] = useState<TripOut | null>(null);
  const [group, setGroup] = useState<GroupOut | null>(null);
  const [expenses, setExpenses] = useState<ExpenseOut[]>([]);
  const [balances, setBalances] = useState<BalanceSummaryItem[]>([]);
  const [polls, setPolls] = useState<PollOut[]>([]);
  const [locations, setLocations] = useState<LocationOut[]>([]);
  const [weather, setWeather] = useState<{
    temp: number;
    code: string;
  } | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<{
    m: string;
    k: "success" | "error";
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expFormOpen, setExpFormOpen] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expSplit, setExpSplit] = useState<string[]>([]);
  const [expSaving, setExpSaving] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollA, setPollA] = useState("");
  const [pollB, setPollB] = useState("");
  const [pollSaving, setPollSaving] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pinName, setPinName] = useState("");
  const [pins, setPins] = useState<
    {
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      flag_type: string;
    }[]
  >([]);

  const showToast = useCallback((m: string, k: "success" | "error" = "success") => {
    setToast({ m, k });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    const rTrip = await apiFetchWithStatus<TripOut>(`/trips/${id}`);
    if (rTrip.status === 401) {
      setLoading(false);
      router.push("/login");
      return;
    }
    if (!rTrip.data) {
      setTrip(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setTrip(rTrip.data);
    setEditTitle(rTrip.data.title);

    const [rG, rE, rB, rP, rL, rMe, rPins] = await Promise.all([
      apiFetchWithStatus<GroupOut>(`/groups/${rTrip.data.group_id}`),
      apiFetchWithStatus<ExpenseOut[]>(`/trips/${id}/expenses`),
      apiFetchWithStatus<BalanceSummaryItem[]>(
        `/trips/${id}/expenses/summary`,
      ),
      apiFetchWithStatus<PollOut[]>(`/trips/${id}/polls`),
      apiFetchWithStatus<LocationOut[]>(`/trips/${id}/locations`),
      apiFetchWithStatus<{ id: string }>("/auth/me"),
      apiFetchWithStatus<
        {
          id: string;
          latitude: number;
          longitude: number;
          name: string;
          flag_type: string;
        }[]
      >("/pins"),
    ]);
    if (
      [rG, rE, rB, rP, rL, rMe].some((x) => x.status === 401)
    ) {
      setLoading(false);
      router.push("/login");
      return;
    }
    if (rG.data) setGroup(rG.data);
    setExpenses(rE.data ?? []);
    setBalances(rB.data ?? []);
    setPolls(rP.data ?? []);
    setLocations(rL.data ?? []);
    if (rMe.data) setMe(rMe.data);
    setPins((rPins.data ?? []).slice(0, 50));

    const dest =
      rTrip.data.description &&
      (parseDesc(rTrip.data.description).locations as { n?: string }[] | undefined)?.[0]
        ?.n;
    const lat =
      (parseDesc(rTrip.data.description).locations as { la?: number }[] | undefined)?.[0]
        ?.la;
    const lon =
      (parseDesc(rTrip.data.description).locations as { lo?: number }[] | undefined)?.[0]
        ?.lo;
    let le = lat;
    let ln = lon;
    if ((le == null || ln == null) && (rL.data?.[0])) {
      le = rL.data[0].latitude;
      ln = rL.data[0].longitude;
    }
    if (typeof le === "number" && typeof ln === "number") {
      try {
        const w = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${le}&longitude=${ln}&current=temperature_2m,weather_code`,
        );
        const j = (await w.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        const code = j.current?.weather_code ?? 0;
        const emoji =
          code === 0
            ? "☀️"
            : code <= 3
              ? "⛅"
              : code <= 48
                ? "☁️"
                : code <= 67
                  ? "🌧️"
                  : "🌤️";
        setWeather({
          temp: j.current?.temperature_2m ?? 0,
          code: emoji,
        });
      } catch {
        setWeather(null);
      }
    } else {
      setWeather(null);
    }

    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsed = useMemo(() => parseDesc(trip?.description ?? null), [trip]);

  const isBiz = parsed.type === "business";

  const spent = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const budget = parsed.ec ?? parsed.budget ?? 0;

  const tripDays = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return { cur: 1, tot: 1, left: 0 };
    const a = new Date(trip.start_date + "T12:00:00");
    const b = new Date(trip.end_date + "T12:00:00");
    const t = new Date(todayYmd() + "T12:00:00");
    const tot = Math.max(
      1,
      Math.ceil((b.getTime() - a.getTime()) / 86400000) + 1,
    );
    const cur = Math.min(
      tot,
      Math.max(
        1,
        Math.floor((t.getTime() - a.getTime()) / 86400000) + 1,
      ),
    );
    const left = Math.max(0, tot - cur);
    return { cur, tot, left };
  }, [trip]);

  const countdown = useMemo(() => {
    if (!trip?.start_date) return null;
    const start = new Date(trip.start_date + "T12:00:00");
    const today = new Date(todayYmd() + "T12:00:00");
    const d = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    if (trip.status === "completed")
      return { kind: "done" as const };
    if (d > 0) return { kind: "up" as const, days: d };
    if (trip.status !== "completed" && trip.end_date) {
      return {
        kind: "active" as const,
        day: tripDays.cur,
        tot: tripDays.tot,
        left: tripDays.left,
      };
    }
    return { kind: "active" as const, day: tripDays.cur, tot: tripDays.tot, left: tripDays.left };
  }, [trip, tripDays]);

  const members = group?.members ?? [];

  const mapPts: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    const locs = parsed.locations as
      | { la?: number; lo?: number; lat?: number; lon?: number }[]
      | undefined;
    if (locs?.length) {
      for (const l of locs) {
        const la = l.la ?? l.lat;
        const lo = l.lo ?? l.lon;
        if (typeof la === "number" && typeof lo === "number")
          pts.push([la, lo]);
      }
    }
    if (pts.length === 0) {
      for (const l of locations) {
        pts.push([l.latitude, l.longitude]);
      }
    }
    return pts;
  }, [parsed, locations]);

  const saveDayNote = async (dayKey: string) => {
    if (!trip) return;
    const note = noteDrafts[dayKey] ?? "";
    const merged = mergeDescNotes(trip.description, dayKey, note);
    setExpSaving(true);
    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: merged }),
      });
      setTrip((t) => (t ? { ...t, description: merged } : t));
      showToast("Note saved", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setExpSaving(false);
    }
  };

  const saveTripTitle = async () => {
    if (!trip || !editTitle.trim()) return;
    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      setTrip((t) => (t ? { ...t, title: editTitle.trim() } : t));
      setEditOpen(false);
      showToast("Trip updated", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const submitExpense = async () => {
    if (!trip || !id) return;
    const amt = parseFloat(expAmount);
    if (!expDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      showToast("Fill description and amount", "error");
      return;
    }
    if (expSplit.length === 0) {
      showToast("Pick who to split with", "error");
      return;
    }
    setExpSaving(true);
    try {
      await apiFetch(`/trips/${id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: expDesc.trim().slice(0, 300),
          amount: amt,
          currency: "INR",
          split_with: expSplit,
        }),
      });
      setExpFormOpen(false);
      setExpDesc("");
      setExpAmount("");
      showToast("Expense added", "success");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setExpSaving(false);
    }
  };

  const createPoll = async () => {
    if (!id) return;
    const oa = pollA.trim();
    const ob = pollB.trim();
    if (!pollQ.trim() || oa.length < 1 || ob.length < 1) {
      showToast("Question and two options required", "error");
      return;
    }
    setPollSaving(true);
    try {
      await apiFetch(`/trips/${id}/polls`, {
        method: "POST",
        body: JSON.stringify({
          question: pollQ.trim(),
          poll_type: "custom",
          options: [{ label: oa }, { label: ob }],
        }),
      });
      setPollOpen(false);
      setPollQ("");
      setPollA("");
      setPollB("");
      showToast("Poll created", "success");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setPollSaving(false);
    }
  };

  const voteOn = async (pollId: string, optionId: string) => {
    try {
      await apiFetch(`/polls/${pollId}/vote`, {
        method: "POST",
        body: JSON.stringify({ option_id: optionId }),
      });
      showToast("Vote recorded", "success");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Vote failed", "error");
    }
  };

  const savePin = async () => {
    if (!pendingPin || !pinName.trim()) {
      showToast("Name the pin", "error");
      return;
    }
    try {
      await apiFetch("/pins", {
        method: "POST",
        body: JSON.stringify({
          lat: pendingPin.lat,
          lng: pendingPin.lng,
          name: pinName.trim(),
          flag_type: "trip",
        }),
      });
      setPinMode(false);
      setPendingPin(null);
      setPinName("");
      showToast("Pin saved", "success");
      const r = await apiFetchWithStatus<
        {
          id: string;
          latitude: number;
          longitude: number;
          name: string;
          flag_type: string;
        }[]
      >("/pins");
      setPins(r.data ?? []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["date", "description", "amount", "currency"].join(","),
      ...expenses.map((e) =>
        [
          e.created_at,
          `"${e.description.replace(/"/g, '""')}"`,
          e.amount,
          e.currency,
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trip-${id}-expenses.csv`;
    a.click();
    showToast("CSV exported", "success");
  };

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-[#6C757D]">Invalid trip</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton variant="trip-detail" className="px-4" />;
  }

  if (notFound || !trip) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
        <p className="text-[#2C3E50]">Trip not found.</p>
        <button
          type="button"
          onClick={() => router.push("/trips")}
          className="rounded-xl bg-[#E94560] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to trips
        </button>
      </div>
    );
  }

  const legsRaw = parsed.legs as
    | {
        f?: string;
        t?: string;
        d?: number;
        tr?: string;
        br?: string;
      }[]
    | undefined;

  const locRaw = parsed.locations as
    | { n?: string; d?: string; p?: string }[]
    | undefined;

  return (
    <div className="min-h-0 pb-10">
      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[200] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.k === "success" ? "bg-green-600" : "bg-[#E94560]"
          }`}
        >
          {toast.m}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => router.push("/trips")}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#6C757D] hover:text-[#0F3460]"
      >
        ← All Trips
      </button>

      <header
        className="relative overflow-hidden rounded-2xl px-5 py-6 text-white"
        style={{
          background:
            isBiz
              ? "linear-gradient(135deg, #0F3460 0%, #06182d 100%)"
              : "linear-gradient(135deg, #E94560 0%, #ff9f43 100%)",
          minHeight: 140,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12] text-2xl leading-relaxed"
          aria-hidden
        >
          {"✈️ 🗺️ 📍 💸 🏖️ ✈️ 🧳 ".repeat(8)}
        </div>
        <button
          type="button"
          className="absolute right-4 top-4 text-xl text-white/90"
          onClick={() => setEditOpen(true)}
          aria-label="Edit"
        >
          ✏️
        </button>
        <div className="relative">
          <h1 className="text-[22px] font-bold">{trip.title}</h1>
          <p className="mt-1 text-[13px] text-white/80">
            📍 {trip.title.split(" ").slice(0, 4).join(" ")} ·{" "}
            {trip.start_date && trip.end_date
              ? `${trip.start_date} → ${trip.end_date}`
              : "Dates TBD"}
          </p>
          <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold capitalize">
            {trip.status}
          </span>
          <div className="mt-4 flex items-center pl-2">
            {members.slice(0, 5).map((m, i) => (
              <img
                key={m.id}
                src={diceBear(m.user_id)}
                alt=""
                className="-ml-2 h-8 w-8 rounded-full border-2 border-white/50 bg-white"
                style={{ zIndex: 5 - i }}
              />
            ))}
            {members.length > 5 ? (
              <span className="-ml-1 text-xs font-bold">+{members.length - 5}</span>
            ) : null}
          </div>
        </div>
      </header>

      {editOpen ? (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="font-bold text-[#0F3460]">Edit trip name</p>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: BORDER }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="text-sm text-[#6C757D]"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-bold text-white"
                onClick={() => void saveTripTitle()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 bg-white">
        <TabSwitcher<TabId>
          tabs={[
            { id: "overview", label: "🏠 Overview" },
            { id: "itinerary", label: "🗺️ Itinerary" },
            { id: "expenses", label: "💸 Expenses" },
            { id: "polls", label: "🗳️ Polls" },
            { id: "members", label: "👥 Members" },
            { id: "map", label: "📍 Map" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-6 px-1">
        {tab === "overview" ? (
          <OverviewTab
            weather={weather}
            trip={trip}
            countdown={countdown}
            spent={spent}
            budget={budget}
            expensesLen={expenses.length}
            pollsLen={polls.length}
            membersLen={members.length}
            locationsLen={locations.length}
            expenses={expenses}
            polls={polls}
          />
        ) : null}

        {tab === "itinerary" ? (
          <ItineraryTab
            trip={trip}
            legsRaw={legsRaw}
            locRaw={locRaw}
            dayNotes={parsed.day_notes ?? {}}
            noteDrafts={noteDrafts}
            setNoteDrafts={setNoteDrafts}
            onSaveDay={saveDayNote}
            saving={expSaving}
          />
        ) : null}

        {tab === "expenses" ? (
          <ExpensesTab
            expenses={expenses}
            balances={balances}
            spent={spent}
            me={me}
            isBiz={isBiz}
            onAdd={() => {
              setExpFormOpen(true);
              setExpSplit(members.map((m) => m.user_id));
            }}
            expFormOpen={expFormOpen}
            setExpFormOpen={setExpFormOpen}
            expDesc={expDesc}
            setExpDesc={setExpDesc}
            expAmount={expAmount}
            setExpAmount={setExpAmount}
            expSplit={expSplit}
            setExpSplit={setExpSplit}
            members={members}
            onSubmit={submitExpense}
            expSaving={expSaving}
            exportCsv={isBiz ? exportCsv : undefined}
          />
        ) : null}

        {tab === "polls" ? (
          <PollsTab
            polls={polls}
            me={me}
            onVote={voteOn}
            pollOpen={pollOpen}
            setPollOpen={setPollOpen}
            pollQ={pollQ}
            setPollQ={setPollQ}
            pollA={pollA}
            setPollA={setPollA}
            pollB={pollB}
            setPollB={setPollB}
            createPoll={createPoll}
            pollSaving={pollSaving}
          />
        ) : null}

        {tab === "members" ? (
          <MembersTab
            members={members}
            expenses={expenses}
            balances={balances}
          />
        ) : null}

        {tab === "map" ? (
          <TripMapTab
            mapPts={mapPts}
            pins={pins}
            NAVY={NAVY}
            CORAL={CORAL}
            BORDER={BORDER}
            pinMode={pinMode}
            setPinMode={setPinMode}
            onMapPick={(la, ln) => setPendingPin({ lat: la, lng: ln })}
            pendingPin={pendingPin}
            pinName={pinName}
            setPinName={setPinName}
            onSavePin={savePin}
          />
        ) : null}
      </div>
    </div>
  );
}

function OverviewTab({
  weather,
  trip,
  countdown,
  spent,
  budget,
  expensesLen,
  pollsLen,
  membersLen,
  locationsLen,
  expenses,
  polls,
}: {
  weather: { temp: number; code: string } | null;
  trip: TripOut;
  countdown:
    | { kind: "up"; days: number }
    | { kind: "active"; day: number; tot: number; left: number }
    | { kind: "done" }
    | null;
  spent: number;
  budget: number;
  expensesLen: number;
  pollsLen: number;
  membersLen: number;
  locationsLen: number;
  expenses: ExpenseOut[];
  polls: PollOut[];
}) {
  const barPct =
    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const barColor =
    barPct >= 90 ? "#E94560" : barPct >= 70 ? "#F5A623" : "#22C55E";

  const recent = [
    ...expenses.map((e) => ({
      k: `e-${e.id}`,
      t: e.created_at,
      label: e.description,
      sub: `₹${e.amount.toFixed(0)}`,
    })),
    ...polls.map((p) => ({
      k: `p-${p.id}`,
      t: p.created_at,
      label: p.question,
      sub: "Poll",
    })),
  ]
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="rounded-2xl border bg-white p-4"
          style={{ borderColor: BORDER }}
        >
          <p className="text-xs font-bold uppercase text-[#ADB5BD]">
            Weather
          </p>
          {weather ? (
            <p className="mt-2 text-2xl">
              {weather.code}{" "}
              <span className="text-lg font-bold text-[#0F3460]">
                {Math.round(weather.temp)}°C
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#6C757D]">Unavailable</p>
          )}
          <p className="text-sm text-[#6C757D]">Near {trip.title.slice(0, 32)}</p>
        </div>
        <div
          className="rounded-2xl border bg-white p-4"
          style={{ borderColor: BORDER }}
        >
          <p className="text-xs font-bold uppercase text-[#ADB5BD]">
            Countdown
          </p>
          {!countdown ? (
            <p className="mt-2 text-sm text-[#6C757D]">—</p>
          ) : countdown.kind === "up" ? (
            <p className="mt-2 font-bold text-[#E94560]">
              Starts in {countdown.days} days 🎉
            </p>
          ) : countdown.kind === "active" ? (
            <p className="mt-2 text-sm text-[#0F3460]">
              Day {countdown.day} of {countdown.tot} · {countdown.left} days left
            </p>
          ) : (
            <p className="mt-2 font-bold text-green-600">Completed ✓</p>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border bg-white p-4"
        style={{ borderColor: BORDER }}
      >
        <p className="text-sm font-bold text-[#0F3460]">Budget</p>
        {budget > 0 ? (
          <>
            <p className="mt-2 text-sm text-[#6C757D]">
              ₹{spent.toLocaleString("en-IN")} of ₹
              {budget.toLocaleString("en-IN")} spent
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E9ECEF]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, background: barColor }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm italic text-[#ADB5BD]">No budget set</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [expensesLen, "expenses"],
          [pollsLen, "polls"],
          [membersLen, "members"],
          [locationsLen, "places"],
        ].map(([n, l]) => (
          <div
            key={l as string}
            className="rounded-xl border bg-white p-3 text-center"
            style={{ borderColor: BORDER }}
          >
            <p className="text-xl font-bold text-[#0F3460]">{n as number}</p>
            <p className="text-[11px] uppercase text-[#ADB5BD]">{l as string}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-[#0F3460]">Recent activity</p>
        <ul className="space-y-2">
          {recent.length === 0 ? (
            <li className="text-sm text-[#6C757D]">No recent items.</li>
          ) : (
            recent.map((r) => (
              <li
                key={r.k}
                className="flex justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: BORDER }}
              >
                <span className="line-clamp-1">{r.label}</span>
                <span className="shrink-0 text-[#ADB5BD]">{r.sub}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ItineraryTab({
  trip,
  legsRaw,
  locRaw,
  dayNotes,
  noteDrafts,
  setNoteDrafts,
  onSaveDay,
  saving,
}: {
  trip: TripOut;
  legsRaw?: { f?: string; t?: string; d?: number; tr?: string; br?: string }[];
  locRaw?: { n?: string; d?: string; p?: string }[];
  dayNotes: Record<string, string>;
  noteDrafts: Record<string, string>;
  setNoteDrafts: (f: (p: Record<string, string>) => Record<string, string>) => void;
  onSaveDay: (k: string) => void | Promise<void>;
  saving: boolean;
}) {
  const days: { key: string; label: string; date: string }[] = [];
  if (locRaw?.length) {
    locRaw.forEach((loc, i) => {
      const d = loc.d || `day-${i}`;
      days.push({
        key: d + String(i),
        label: `Day ${i + 1}`,
        date: d,
      });
    });
  } else if (trip.start_date && trip.end_date) {
    const a = new Date(trip.start_date + "T12:00:00");
    const b = new Date(trip.end_date + "T12:00:00");
    let di = 0;
    for (let x = a.getTime(); x <= b.getTime(); x += 86400000) {
      di++;
      const dt = new Date(x);
      const ds = dt.toISOString().slice(0, 10);
      days.push({ key: `d-${ds}`, label: `Day ${di}`, date: ds });
    }
  }

  return (
    <div className="space-y-6">
      {legsRaw?.map((leg, i) => (
        <div
          key={`leg-${i}`}
          className="border-l-[3px] pl-3"
          style={{ borderColor: CORAL }}
        >
          <p className="text-sm font-semibold text-[#0F3460]">
            {leg.f} → {leg.t} · {leg.d} km · {leg.tr}
            {leg.br ? ` · ${leg.br}` : ""}
          </p>
        </div>
      ))}

      {days.map((d) => (
        <div key={d.key} className="space-y-2">
          <div
            className="inline-block rounded-lg px-3 py-1 text-xs font-bold text-white"
            style={{ background: NAVY }}
          >
            {d.label} · {d.date}
          </div>
          <div className="rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}>
            <textarea
              value={
                noteDrafts[d.key] ??
                dayNotes[d.key] ??
                ""
              }
              onChange={(e) =>
                setNoteDrafts((p) => ({
                  ...p,
                  [d.key]: e.target.value,
                }))
              }
              placeholder="Add a note for this day…"
              rows={2}
              className="w-full resize-none rounded-lg border px-2 py-2 text-sm outline-none"
              style={{ borderColor: BORDER }}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveDay(d.key)}
              className="mt-2 text-xs font-bold text-[#E94560] disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        </div>
      ))}

      {days.length === 0 && !legsRaw?.length ? (
        <p className="text-sm text-[#6C757D]">
          No itinerary data yet — edit trip description from planner or add locations.
        </p>
      ) : null}
    </div>
  );
}

function ExpensesTab({
  expenses,
  balances,
  spent,
  me,
  isBiz,
  onAdd,
  expFormOpen,
  setExpFormOpen,
  expDesc,
  setExpDesc,
  expAmount,
  setExpAmount,
  expSplit,
  setExpSplit,
  members,
  onSubmit,
  expSaving,
  exportCsv,
}: {
  expenses: ExpenseOut[];
  balances: BalanceSummaryItem[];
  spent: number;
  me: { id: string } | null;
  isBiz: boolean;
  onAdd: () => void;
  expFormOpen: boolean;
  setExpFormOpen: (v: boolean) => void;
  expDesc: string;
  setExpDesc: (s: string) => void;
  expAmount: string;
  setExpAmount: (s: string) => void;
  expSplit: string[];
  setExpSplit: (u: string[]) => void;
  members: GroupMemberOut[];
  onSubmit: () => void | Promise<void>;
  expSaving: boolean;
  exportCsv?: () => void;
}) {
  const yours = useMemo(() => {
    if (!me) return 0;
    let s = 0;
    for (const e of expenses) {
      for (const sp of e.splits) {
        if (sp.user_id === me.id) s += sp.amount;
      }
    }
    return Math.round(s * 100) / 100;
  }, [expenses, me]);

  const byCat = useMemo(() => {
    const m = new Map<string, ExpenseOut[]>();
    for (const e of expenses) {
      const cat = e.description.split(/[\[\]]/)[1] || "General";
      const arr = m.get(cat) ?? [];
      arr.push(e);
      m.set(cat, arr);
    }
    return m;
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border bg-white p-4"
        style={{ borderColor: BORDER }}
      >
        <p className="text-sm text-[#0F3460]">
          Total spent:{" "}
          <span className="font-bold">₹{spent.toLocaleString("en-IN")}</span>
        </p>
        <p className="text-sm text-[#6C757D]">
          Your share: ₹{yours.toLocaleString("en-IN")}
        </p>
        {balances.length > 0 ? (
          <ul className="mt-2 text-xs text-[#6C757D]">
            {balances.slice(0, 6).map((b) => (
              <li key={`${b.from_user_id}-${b.to_user_id}`}>
                {b.from_user_id.slice(0, 6)} → {b.to_user_id.slice(0, 6)} : ₹
                {b.amount.toFixed(0)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[#ADB5BD]">No balances.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-[#E94560] px-4 py-2.5 text-sm font-bold text-white"
        >
          + Add Expense
        </button>
        {isBiz && exportCsv ? (
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border px-4 py-2.5 text-sm font-bold"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            📊 Export CSV
          </button>
        ) : null}
        {isBiz ? (
          <button
            type="button"
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#ADB5BD]"
            disabled
            title="Coming soon"
          >
            📄 Export PDF
          </button>
        ) : null}
      </div>

      {expFormOpen ? (
        <div
          className="rounded-2xl border bg-white p-4"
          style={{ borderColor: BORDER }}
        >
          <input
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            placeholder="Description"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <input
            type="number"
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            placeholder="Amount ₹"
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <p className="mt-3 text-xs font-bold text-[#6C757D]">Split with</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={expSplit.includes(m.user_id)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setExpSplit([...expSplit, m.user_id]);
                    else
                      setExpSplit(expSplit.filter((id) => id !== m.user_id));
                  }}
                />
                {m.full_name}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={expSaving}
              onClick={() => void onSubmit()}
              className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              className="text-sm text-[#6C757D]"
              onClick={() => setExpFormOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {[...byCat.entries()].map(([cat, arr]) => (
        <div key={cat}>
          <p className="mb-2 text-sm font-bold text-[#0F3460]">{cat}</p>
          <ul className="space-y-2">
            {arr.map((e) => (
              <li
                key={e.id}
                className="flex justify-between rounded-xl border bg-white px-3 py-2 text-sm"
                style={{ borderColor: BORDER }}
              >
                <span className="line-clamp-2">{e.description}</span>
                <span className="shrink-0 font-semibold">
                  ₹{e.amount.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {expenses.length === 0 ? (
        <p className="text-sm text-[#6C757D]">No expenses yet.</p>
      ) : null}
    </div>
  );
}

function PollsTab({
  polls,
  me,
  onVote,
  pollOpen,
  setPollOpen,
  pollQ,
  setPollQ,
  pollA,
  setPollA,
  pollB,
  setPollB,
  createPoll,
  pollSaving,
}: {
  polls: PollOut[];
  me: { id: string } | null;
  onVote: (pollId: string, opt: string) => void;
  pollOpen: boolean;
  setPollOpen: (v: boolean) => void;
  pollQ: string;
  setPollQ: (s: string) => void;
  pollA: string;
  setPollA: (s: string) => void;
  pollB: string;
  setPollB: (s: string) => void;
  createPoll: () => void | Promise<void>;
  pollSaving: boolean;
}) {
  const maxVotes = useMemo(
    () => Math.max(1, ...polls.flatMap((p) => p.options.map((o) => o.vote_count))),
    [polls],
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setPollOpen(true)}
        className="rounded-xl bg-[#E94560] px-4 py-2.5 text-sm font-bold text-white"
      >
        + Create Poll
      </button>

      {pollOpen ? (
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <input
            value={pollQ}
            onChange={(e) => setPollQ(e.target.value)}
            placeholder="Question"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <input
            value={pollA}
            onChange={(e) => setPollA(e.target.value)}
            placeholder="Option A"
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <input
            value={pollB}
            onChange={(e) => setPollB(e.target.value)}
            placeholder="Option B"
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pollSaving}
              className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-bold text-white"
              onClick={() => void createPoll()}
            >
              Create
            </button>
            <button
              type="button"
              className="text-sm text-[#6C757D]"
              onClick={() => setPollOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {polls.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border bg-white p-4"
          style={{ borderColor: BORDER }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-bold text-[#0F3460]">{p.question}</p>
            <span className="rounded-full bg-[#F8F9FA] px-2 py-0.5 text-[11px] font-bold uppercase text-[#6C757D]">
              {p.status}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {p.options.map((o) => (
              <li key={o.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{o.label}</span>
                  <span>{o.vote_count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E9ECEF]">
                  <div
                    className="h-full rounded-full bg-[#E94560]"
                    style={{
                      width: `${(o.vote_count / maxVotes) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {p.status === "open" && me ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onVote(p.id, o.id)}
                  className="rounded-lg border px-3 py-1 text-xs font-bold"
                  style={{ borderColor: NAVY, color: NAVY }}
                >
                  Vote {o.label.slice(0, 12)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      {polls.length === 0 ? (
        <p className="text-sm text-[#6C757D]">No polls yet.</p>
      ) : null}
    </div>
  );
}

function MembersTab({
  members,
  expenses,
  balances,
}: {
  members: GroupMemberOut[];
  expenses: ExpenseOut[];
  balances: BalanceSummaryItem[];
}) {
  const spentBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const cur = m.get(e.paid_by) ?? 0;
      m.set(e.paid_by, cur + e.amount);
    }
    return m;
  }, [expenses]);

  return (
    <ul className="space-y-3">
      {members.map((m) => {
        const owe = balances
          .filter((b) => b.from_user_id === m.user_id)
          .reduce((s, b) => s + b.amount, 0);
        const owed = balances
          .filter((b) => b.to_user_id === m.user_id)
          .reduce((s, b) => s + b.amount, 0);
        return (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3"
            style={{ borderColor: BORDER }}
          >
            <img
              src={diceBear(m.user_id)}
              className="h-11 w-11 rounded-full"
              alt=""
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0F3460]">{m.full_name}</p>
              <p className="text-xs text-[#ADB5BD]">{m.role}</p>
              <p className="text-xs text-[#6C757D]">
                Spent (paid): ₹
                {(spentBy.get(m.user_id) ?? 0).toLocaleString("en-IN")}
                {" · "}
                Balance: owes ₹{owe.toFixed(0)} / owed ₹{owed.toFixed(0)}
              </p>
            </div>
            <Link
              href="/travel-hub"
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: CORAL, color: CORAL }}
            >
              Message
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TripMapTab({
  mapPts,
  pins,
  NAVY,
  CORAL,
  BORDER,
  pinMode,
  setPinMode,
  onMapPick,
  pendingPin,
  pinName,
  setPinName,
  onSavePin,
}: {
  mapPts: [number, number][];
  pins: {
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    flag_type: string;
  }[];
  NAVY: string;
  CORAL: string;
  BORDER: string;
  pinMode: boolean;
  setPinMode: (v: boolean) => void;
  onMapPick: (lat: number, lng: number) => void;
  pendingPin: { lat: number; lng: number } | null;
  pinName: string;
  setPinName: (s: string) => void;
  onSavePin: () => void | Promise<void>;
}) {
  const center = mapPts[0] ?? [20, 77];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPinMode(!pinMode)}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${
            pinMode ? "bg-[#E94560] text-white" : "border border-[#E9ECEF] bg-white"
          }`}
        >
          + Add Pin
        </button>
      </div>
      <p className="text-xs text-[#6C757D]">
        {pinMode
          ? "Click the map to place a pin."
          : "Route (dashed) and saved pins."}
      </p>
      <div
        className="h-[min(70vh,560px)] w-full overflow-hidden rounded-2xl border"
        style={{ borderColor: BORDER }}
      >
        <MapContainer
          center={center}
          zoom={5}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {mapPts.length > 0 ? <MapBounds pts={mapPts} /> : null}
          {pinMode ? <MapClick onPick={onMapPick} /> : null}
          {mapPts.length > 1 ? (
            <Polyline
              positions={mapPts}
              pathOptions={{ color: CORAL, weight: 3, dashArray: "8 4" }}
            />
          ) : null}
          {mapPts.map((pt, i) => (
            <Marker
              key={`m-${i}`}
              position={pt}
              icon={L.divIcon({
                className: "",
                html: `<div style="width:28px;height:28px;border-radius:50%;background:${CORAL};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${i + 1}</div>`,
                iconSize: [28, 28],
              })}
            />
          ))}
          {pins.map((p) => (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={L.divIcon({
                className: "",
                html: `<div style="padding:2px 6px;background:${NAVY};color:#fff;border-radius:6px;font-size:11px;">${p.name.slice(0, 12)}</div>`,
                iconSize: [96, 28],
                iconAnchor: [48, 14],
              })}
            />
          ))}
        </MapContainer>
      </div>
      {pendingPin ? (
        <div className="rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}>
          <p className="text-xs text-[#6C757D]">
            {pendingPin.lat.toFixed(4)}, {pendingPin.lng.toFixed(4)}
          </p>
          <input
            value={pinName}
            onChange={(e) => setPinName(e.target.value)}
            placeholder="Pin name"
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: BORDER }}
          />
          <button
            type="button"
            className="mt-2 rounded-lg bg-[#E94560] px-4 py-2 text-sm font-bold text-white"
            onClick={() => void onSavePin()}
          >
            Save pin
          </button>
        </div>
      ) : null}
    </div>
  );
}
