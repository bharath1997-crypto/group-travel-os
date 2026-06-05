"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Clock, HelpCircle, MapPin, Navigation, Sparkles, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SosButton } from "./SosButton";
import { CountdownTimer } from "./CountdownTimer";
import { Database } from "firebase/database";

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  quick_status?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface LiveSidebarProps {
  tripId: string;
  sessionId: string;
  members: Member[];
  firebaseDb: Database | null;
  isAdmin: boolean;
  onSetMeetPoint: () => void;
  onEndSession: () => void;
  currentUserId: string | null;
}

export function LiveSidebar({
  tripId,
  sessionId,
  members,
  firebaseDb,
  isAdmin,
  onSetMeetPoint,
  onEndSession,
  currentUserId,
}: LiveSidebarProps) {
  const [wayraAlert, setWayraAlert] = useState<string | null>(null);
  const [loadingWayra, setLoadingWayra] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number>(15);

  const fetchWayraAlert = async () => {
    setLoadingWayra(true);
    try {
      const res = await apiFetch<{ alert: string | null }>(`/live-context/${tripId}`);
      setWayraAlert(res.alert);
    } catch (err) {
      console.error("Failed to load Wayra alert:", err);
    } finally {
      setLoadingWayra(false);
    }
  };

  useEffect(() => {
    fetchWayraAlert();
    const interval = setInterval(fetchWayraAlert, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [tripId]);

  const handleStartTimer = async (mins: number) => {
    try {
      await apiFetch(`/trips/${tripId}/timer`, {
        method: "POST",
        body: JSON.stringify({ duration_seconds: mins * 60 }),
      });
    } catch (err) {
      console.error("Failed to start timer:", err);
    }
  };

  return (
    <aside className="w-80 bg-[#0F172A] text-white flex flex-col h-full border-r border-slate-800 shrink-0">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <Navigation className="h-5 w-5 text-[#0F766E]" /> Live Control
        </h2>
        <p className="text-xs text-slate-400 mt-1">Real-time coordination space</p>
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Wayra AI Alert Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BrainCircuit className="h-3.5 w-3.5 text-[#0F766E]" /> Wayra AI
            </span>
            <button
              onClick={fetchWayraAlert}
              disabled={loadingWayra}
              className="text-[10px] text-slate-400 hover:text-white transition"
            >
              Refresh
            </button>
          </div>
          {wayraAlert ? (
            <div className="p-3 bg-[#0F766E]/10 border border-[#0F766E]/20 rounded-xl flex gap-2.5 items-start">
              <Sparkles className="h-4 w-4 text-[#0F766E] shrink-0 mt-0.5" />
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {wayraAlert}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No warnings or coordination alerts.</p>
          )}
        </div>

        {/* Members Status List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Active Crew
          </h3>
          <div className="space-y-2">
            {members.map((mem) => (
              <div
                key={mem.user_id}
                className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-300">
                    {mem.avatar_url ? (
                      <img
                        src={mem.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (mem.full_name || "?").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block truncate max-w-[120px]">
                      {mem.full_name || "Traveler"}
                    </span>
                    {mem.quick_status && (
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        {mem.quick_status === "running_late" && "🏃 Running Late"}
                        {mem.quick_status === "on_my_way" && "🚗 On My Way"}
                        {mem.quick_status === "here" && "✅ I'm Here!"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coordination Controls */}
        {isAdmin && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Coordinator Tools
            </h3>

            {/* Meetpoint button */}
            <button
              onClick={onSetMeetPoint}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#0F766E]/10"
            >
              <MapPin className="h-4 w-4" />
              Set Meet Point Coordinate
            </button>

            {/* Timer quick select */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-medium">Set Group Timer</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleStartTimer(5)}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                >
                  5 Mins
                </button>
                <button
                  onClick={() => handleStartTimer(15)}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                >
                  15 Mins
                </button>
                <button
                  onClick={() => handleStartTimer(30)}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                >
                  30 Mins
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Emergency actions */}
      <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-950/40">
        <SosButton tripId={tripId} />
        {isAdmin && (
          <button
            onClick={onEndSession}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
          >
            End Live Session
          </button>
        )}
      </div>
    </aside>
  );
}
