"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Clock, Compass, MapPin, Navigation, Share2, Move, Footprints, Hand, AlertTriangle } from "lucide-react";
import { ref, update as rtdbUpdate, onValue, type Database } from "firebase/database";
import { apiFetch } from "@/lib/api";

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  quick_status?: string | null;
  lat: number | null;
  lng: number | null;
  updated_at?: number | null;
  is_accepted?: boolean;
}

interface MemberPanelProps {
  tripId: string;
  firebaseDb: Database | null;
  members: Member[];
  meetPoint: { lat: number | null; lng: number | null; name?: string | null };
  currentUserId: string | null;
  isAdmin: boolean;
  onSetMeetPointClick?: () => void;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function MemberPanel({
  tripId,
  firebaseDb,
  members,
  meetPoint,
  currentUserId,
  isAdmin,
  onSetMeetPointClick,
}: MemberPanelProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [timerState, setTimerState] = useState<{
    started_by?: string;
    started_at?: number;
    duration_seconds?: number;
    is_active?: boolean;
  } | null>(null);

  const [myQuickStatus, setMyQuickStatus] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("Locating meeting address...");

  // Keep time updated
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen to Timer state
  useEffect(() => {
    if (!firebaseDb) return;
    const r = ref(firebaseDb, `trips/${tripId}/timer`);
    const unsub = onValue(r, (snap) => {
      setTimerState(snap.val());
    });
    return () => unsub();
  }, [firebaseDb, tripId]);

  // Listen to my quick status from Firebase
  useEffect(() => {
    if (!firebaseDb || !currentUserId) return;
    const r = ref(firebaseDb, `trips/${tripId}/quick_status/${currentUserId}`);
    const unsub = onValue(r, (snap) => {
      const val = snap.val();
      if (val && val.status) {
        setMyQuickStatus(val.status);
      }
    });
    return () => unsub();
  }, [firebaseDb, currentUserId, tripId]);

  // Resolve meeting point address
  useEffect(() => {
    if (meetPoint.lat && meetPoint.lng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${meetPoint.lat}&lon=${meetPoint.lng}`
      )
        .then((r) => r.json())
        .then((data) => {
          setAddress(data.display_name || "Latitude: " + meetPoint.lat + ", Longitude: " + meetPoint.lng);
        })
        .catch(() => {
          setAddress(`Latitude: ${meetPoint.lat}, Longitude: ${meetPoint.lng}`);
        });
    } else {
      setAddress("No meeting point set yet.");
    }
  }, [meetPoint.lat, meetPoint.lng]);

  // Handle Quick Status Tap
  const handleQuickStatusTap = async (status: string) => {
    if (!firebaseDb || !currentUserId) return;
    const timestamp = Date.now();
    const updates: Record<string, any> = {};
    updates[`trips/${tripId}/quick_status/${currentUserId}`] = { status, timestamp };
    updates[`trips/${tripId}/locations/${currentUserId}/quick_status`] = status;
    updates[`trips/${tripId}/locations/${currentUserId}/updated_at`] = Math.floor(Date.now() / 1000);

    try {
      await rtdbUpdate(ref(firebaseDb), updates);
      setMyQuickStatus(status);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Timer Handlers
  const handleTimerAction = async (action: "pause" | "resume" | "reset" | "set") => {
    if (!firebaseDb || !isAdmin) return;

    if (action === "set") {
      const minutesStr = prompt("Enter timer duration in minutes:");
      if (!minutesStr) return;
      const mins = parseInt(minutesStr, 10);
      if (isNaN(mins) || mins <= 0) {
        alert("Please enter a valid number of minutes.");
        return;
      }
      const duration = mins * 60;
      await rtdbUpdate(ref(firebaseDb, `trips/${tripId}/timer`), {
        started_by: currentUserId,
        started_at: Math.floor(Date.now() / 1000),
        duration_seconds: duration,
        is_active: true,
      });
    } else if (action === "pause") {
      if (!timerState) return;
      const elapsed = now - (timerState.started_at || now);
      const remaining = Math.max(0, (timerState.duration_seconds || 0) - elapsed);
      await rtdbUpdate(ref(firebaseDb, `trips/${tripId}/timer`), {
        duration_seconds: remaining,
        is_active: false,
      });
    } else if (action === "resume") {
      if (!timerState) return;
      await rtdbUpdate(ref(firebaseDb, `trips/${tripId}/timer`), {
        started_at: Math.floor(Date.now() / 1000),
        is_active: true,
      });
    } else if (action === "reset") {
      await rtdbUpdate(ref(firebaseDb, `trips/${tripId}/timer`), {
        started_by: null,
        started_at: null,
        duration_seconds: 0,
        is_active: false,
      });
    }
  };

  // Timer Remaining Calculations
  const remainingTime = useMemo(() => {
    if (!timerState) return 0;
    if (!timerState.is_active) return timerState.duration_seconds || 0;
    const elapsed = now - (timerState.started_at || now);
    return Math.max(0, (timerState.duration_seconds || 0) - elapsed);
  }, [timerState, now]);

  const progressPercent = useMemo(() => {
    if (!timerState || !timerState.duration_seconds) return 0;
    return (remainingTime / timerState.duration_seconds) * 100;
  }, [timerState, remainingTime]);

  const strokeDashoffset = useMemo(() => {
    const circumference = 213.6;
    return circumference - (progressPercent / 100) * circumference;
  }, [progressPercent]);

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Process and sort members
  const processedMembers = useMemo(() => {
    const list = members.map((m) => {
      let distance = Infinity;
      if (m.lat && m.lng && meetPoint.lat && meetPoint.lng) {
        distance = calculateDistance(m.lat, m.lng, meetPoint.lat, meetPoint.lng);
      }
      const isStale = m.updated_at ? now - m.updated_at > 120 : true;

      let status = "stale";
      let statusColor = "#94A3B8";
      let statusLabel = "Stale";

      if (m.lat === null || m.lng === null) {
        status = "offline";
        statusColor = "#475569";
        statusLabel = "Offline";
      } else if (!isStale) {
        if (distance <= 100) {
          status = "arrived";
          statusColor = "#22C55E";
          statusLabel = "Arrived";
        } else if (distance <= 500) {
          status = "near";
          statusColor = "#3B82F6";
          statusLabel = "Near";
        } else {
          status = "way";
          statusColor = "#F59E0B";
          statusLabel = "On the way";
        }
      }

      return {
        ...m,
        distance,
        status,
        statusColor,
        statusLabel,
      };
    });

    // Sort: arrived first, then by distance ascending
    return list.sort((a, b) => {
      if (a.status === "arrived" && b.status !== "arrived") return -1;
      if (a.status !== "arrived" && b.status === "arrived") return 1;
      return a.distance - b.distance;
    });
  }, [members, meetPoint, now]);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto select-none pr-1">
      {/* SECTION 1: Members list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
          <Users size={14} className="text-[#0F766E]" />
          Crew Members ({members.length})
        </h3>
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {processedMembers.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full border border-slate-800 bg-slate-800 flex items-center justify-center overflow-hidden text-xs font-black text-slate-300">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.full_name || "M").charAt(0).toUpperCase()
                    )}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900"
                    style={{ backgroundColor: m.statusColor }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">
                      {m.full_name || "Traveler"}
                    </span>
                    {m.user_id === currentUserId && (
                      <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1 py-0.2 rounded font-black">YOU</span>
                    )}
                    {m.is_accepted ? (
                      <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">READY</span>
                    ) : (
                      <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">WAITING</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {m.statusLabel === "Arrived" && "Arrived"}
                    {m.statusLabel === "Near" && `Near (${Math.round(m.distance)}m)`}
                    {m.statusLabel === "On the way" && `On the way (${(m.distance / 1000).toFixed(1)}km)`}
                    {m.statusLabel === "Stale" && "Stale update"}
                    {m.statusLabel === "Offline" && "Offline"}
                  </span>
                </div>
              </div>
              <span
                className="text-[9px] font-black uppercase px-2 py-0.5 rounded border"
                style={{
                  color: m.statusColor,
                  borderColor: m.statusColor + "40",
                  backgroundColor: m.statusColor + "10",
                }}
              >
                {m.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Meeting point */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
          <MapPin size={14} className="text-[#EF4444]" />
          Meeting Point
        </h3>
        <div className="flex gap-3 items-start mb-4">
          <div className="h-9 w-9 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center shrink-0 text-red-500">
            <MapPin size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{meetPoint.name || "Target Spot"}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">{address}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={!meetPoint.lat}
            onClick={() => {
              if (meetPoint.lat) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${meetPoint.lat},${meetPoint.lng}`);
              }
            }}
            className="flex items-center justify-center gap-1 px-2 py-2 bg-[#0F766E] hover:bg-[#0D635C] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#0F766E]/20"
          >
            <Navigation size={12} /> Navigate
          </button>
          <button
            disabled={!meetPoint.lat}
            onClick={() => {
              if (meetPoint.lat) {
                navigator.clipboard.writeText(`${meetPoint.lat}, ${meetPoint.lng}`);
                alert("Coordinates copied to clipboard!");
              }
            }}
            className="flex items-center justify-center gap-1 px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
          >
            <Share2 size={12} /> Share
          </button>
          <button
            onClick={onSetMeetPointClick}
            className="flex items-center justify-center gap-1 px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
          >
            <Move size={12} /> Move
          </button>
        </div>
      </div>

      {/* SECTION 3: Countdown timer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 w-full text-left flex items-center gap-1.5">
          <Clock size={14} className="text-teal-400" />
          Countdown Timer
        </h3>
        <div className="relative flex items-center justify-center h-28 w-28 mb-4">
          <svg className="h-full w-full rotate-[-90deg]">
            <circle cx="56" cy="56" r="34" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
            <circle
              cx="56"
              cy="56"
              r="34"
              className="stroke-[#0F766E] transition-all duration-300"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray="213.6"
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-slate-100 tabular-nums">
              {formatTime(remainingTime)}
            </span>
            <span className="text-[8px] uppercase font-black text-slate-500 tracking-widest mt-0.5">
              {timerState?.is_active ? "Active" : "Paused"}
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2 w-full">
            {timerState?.is_active ? (
              <button
                onClick={() => handleTimerAction("pause")}
                className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold transition border border-amber-500/20"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => handleTimerAction("resume")}
                disabled={!timerState || !timerState.duration_seconds}
                className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50 rounded-lg text-[10px] font-bold transition border border-emerald-500/20"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => handleTimerAction("reset")}
              className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold transition border border-red-500/20"
            >
              Reset
            </button>
            <button
              onClick={() => handleTimerAction("set")}
              className="flex-1 py-1.5 bg-[#0F766E]/10 hover:bg-[#0F766E]/20 text-teal-400 rounded-lg text-[10px] font-bold transition border border-teal-500/20"
            >
              Set Time
            </button>
          </div>
        )}
      </div>

      {/* SECTION 4: Quick status (2x2 grid) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
          <Compass size={14} className="text-amber-500 animate-pulse" />
          Broadcast Quick Status
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleQuickStatusTap("on_my_way")}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
              myQuickStatus === "on_my_way"
                ? "bg-[#E1F5EE] border-[#0F766E] text-[#0F766E]"
                : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <Footprints size={14} />
            <span>On my way</span>
          </button>
          <button
            onClick={() => handleQuickStatusTap("wait_for_me")}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
              myQuickStatus === "wait_for_me"
                ? "bg-[#E1F5EE] border-[#0F766E] text-[#0F766E]"
                : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <Hand size={14} />
            <span>Wait for me</span>
          </button>
          <button
            onClick={() => handleQuickStatusTap("at_spot")}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
              myQuickStatus === "at_spot"
                ? "bg-[#E1F5EE] border-[#0F766E] text-[#0F766E]"
                : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <MapPin size={14} />
            <span>At the spot</span>
          </button>
          <button
            onClick={() => handleQuickStatusTap("need_help")}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
              myQuickStatus === "need_help"
                ? "bg-[#E1F5EE] border-[#0F766E] text-[#0F766E]"
                : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <AlertTriangle size={14} />
            <span>Need help</span>
          </button>
        </div>
      </div>
    </div>
  );
}
