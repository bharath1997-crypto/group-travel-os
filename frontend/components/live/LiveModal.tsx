"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  User,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type TripRow = {
  id: string;
  group_id: string;
  group_name?: string | null;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  members?: { id: string }[];
};

type LiveMode = "group" | "solo";

interface LiveModalProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_FEATURES = [
  "Live GPS map for all members",
  "Shared meeting point + timer",
  "Group chat + walkie-talkie",
  "SOS alert to all members",
] as const;

const SOLO_FEATURES = [
  "Wayra watches your location live",
  "Real-time nearby suggestions",
  "Personal itinerary tracker",
  "SOS to emergency contacts",
] as const;

const HOW_GROUP = [
  "Select your active trip",
  "Share the link — group members join",
  "Everyone's location appears on shared map",
] as const;

const HOW_SOLO = [
  "Select your trip",
  "Wayra activates as your AI companion",
  "Get real-time suggestions + safety alerts",
] as const;

const AVATAR_COLORS = [
  "#0F766E",
  "#8B5CF6",
  "#E94560",
  "#2563EB",
  "#D97706",
  "#0891B2",
] as const;

function formatTripDates(start: string | null, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return "Dates TBD";
}

function avatarColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function LiveModal({ open, onClose }: LiveModalProps) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LiveMode | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const [tripRows, groups] = await Promise.all([
        apiFetch<TripRow[]>("/trips"),
        apiFetch<GroupOut[]>("/groups").catch(() => [] as GroupOut[]),
      ]);
      setTrips(Array.isArray(tripRows) ? tripRows : []);

      const counts: Record<string, number> = {};
      for (const g of groups) {
        counts[g.id] = g.members?.length ?? 0;
      }
      setMemberCounts(counts);
    } catch {
      setTrips([]);
      setMemberCounts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode(null);
    setSelectedTripId(null);
    setHowItWorksOpen(false);
    void loadTrips();
  }, [open, loadTrips]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleCreateTrip = () => {
    onClose();
    router.push("/trips/new");
  };

  const handleGoLive = () => {
    if (!selectedTripId || !mode) return;
    onClose();
    router.push(`/trip-live/${selectedTripId}?mode=${mode}`);
  };

  const howSteps = mode === "solo" ? HOW_SOLO : HOW_GROUP;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        style={{ padding: "28px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="pr-8">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <h2
              id="live-modal-title"
              className="text-[20px] font-bold text-[#0F172A]"
            >
              Trip LIVE
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Real-time coordination for every kind of traveler
          </p>
          <div className="mt-4 border-b border-[#E9ECEF]" />
        </div>

        {/* Mode selector */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Group card */}
          <div
            className={`relative rounded-xl p-5 transition-all ${
              mode === "group"
                ? "border-2 border-[#0F766E] bg-white"
                : "border border-[#E9ECEF] bg-[#F8FAFC]"
            }`}
            style={{ borderWidth: mode === "group" ? 2 : 0.5 }}
          >
            {mode === "group" && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0F766E] text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Users size={32} className="text-[#0F766E]" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-bold text-[#0F172A]">
              Group Trip LIVE
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Coordinate with your travel group in real time
            </p>
            <ul className="mt-3 space-y-1">
              {GROUP_FEATURES.map((f) => (
                <li key={f} className="text-[11px] text-[#64748B]">
                  ✓ {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setMode("group");
                setSelectedTripId(null);
              }}
              className="mt-4 w-full rounded-xl bg-[#0F766E] py-2.5 text-xs font-bold text-white transition hover:bg-[#0D635C]"
            >
              Start Group LIVE
            </button>
          </div>

          {/* Solo card */}
          <div
            className={`relative rounded-xl p-5 transition-all ${
              mode === "solo"
                ? "border-2 border-[#8B5CF6] bg-white"
                : "border border-[#E9ECEF] bg-[#F8FAFC]"
            }`}
            style={{ borderWidth: mode === "solo" ? 2 : 0.5 }}
          >
            {mode === "solo" && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5CF6] text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <User size={32} className="text-[#8B5CF6]" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-bold text-[#0F172A]">
              Solo Trip LIVE
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Travel alone with Wayra AI as your companion
            </p>
            <ul className="mt-3 space-y-1">
              {SOLO_FEATURES.map((f) => (
                <li key={f} className="text-[11px] text-[#64748B]">
                  ✓ {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setMode("solo");
                setSelectedTripId(null);
              }}
              className="mt-4 w-full rounded-xl bg-[#8B5CF6] py-2.5 text-xs font-bold text-white transition hover:bg-[#7C3AED]"
            >
              Start Solo LIVE
            </button>
          </div>
        </div>

        {/* Section B — Trip selector */}
        {mode && (
          <div className="mt-5">
            <p className="text-[13px] font-bold text-[#0F172A]">
              Select your trip
            </p>

            {loading ? (
              <div className="mt-3 flex flex-col items-center gap-2 py-8 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-[#0F766E]" />
                <span className="text-sm">Loading trips…</span>
              </div>
            ) : trips.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-8 text-center">
                <MapPin className="h-10 w-10 text-[#0F766E]" />
                <p className="font-semibold text-slate-800">No trips yet</p>
                <button
                  type="button"
                  onClick={handleCreateTrip}
                  className="rounded-xl bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D635C]"
                >
                  + Create your first trip
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {trips.map((trip) => {
                    const selected = selectedTripId === trip.id;
                    const count = memberCounts[trip.group_id];
                    const initial = (trip.title || "?").trim().charAt(0).toUpperCase();
                    const color = avatarColor(trip.title);

                    return (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => setSelectedTripId(trip.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-[#0F766E] bg-[#F0FDF9]"
                            : "border-[#E9ECEF] bg-white hover:border-slate-300"
                        }`}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {initial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#0F172A]">
                            {trip.title}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {formatTripDates(trip.start_date, trip.end_date)}
                          </p>
                          {mode === "group" && (
                            <p className="text-[11px] text-[#94A3B8]">
                              {typeof count === "number"
                                ? `${count} members`
                                : "— members"}
                            </p>
                          )}
                        </div>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            selected
                              ? "border-[#0F766E] bg-[#0F766E]"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {selected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleCreateTrip}
                  className="mt-3 text-xs font-semibold text-[#0F766E] hover:underline"
                >
                  + Create new trip
                </button>
              </>
            )}
          </div>
        )}

        {/* Section C — Go LIVE button */}
        {mode && selectedTripId && (
          <button
            type="button"
            onClick={handleGoLive}
            className={`mt-5 w-full rounded-xl py-3.5 text-sm font-bold text-white transition ${
              mode === "solo"
                ? "bg-[#8B5CF6] hover:bg-[#7C3AED]"
                : "bg-[#0F766E] hover:bg-[#0D635C]"
            }`}
          >
            {mode === "solo"
              ? "🔴 Go LIVE Solo"
              : "🔴 Go LIVE with Group"}
          </button>
        )}

        {/* Section D — How it works */}
        <div className="mt-5 border-t border-[#E9ECEF] pt-4">
          <button
            type="button"
            onClick={() => setHowItWorksOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
          >
            <span>
              How does Trip LIVE work?{" "}
              {howItWorksOpen ? (
                <ChevronUp size={14} className="inline text-slate-400" />
              ) : (
                <ChevronDown size={14} className="inline text-slate-400" />
              )}
            </span>
          </button>
          {howItWorksOpen && (
            <ol className="mt-3 space-y-2">
              {howSteps.map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-2.5 text-sm text-slate-600"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      mode === "solo"
                        ? "bg-[#8B5CF6]/10 text-[#8B5CF6]"
                        : "bg-[#0F766E]/10 text-[#0F766E]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
