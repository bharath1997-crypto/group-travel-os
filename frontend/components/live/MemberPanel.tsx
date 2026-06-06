"use client";

import { useEffect, useState } from "react";
import { Users, Clock, Compass, Activity, MapPin } from "lucide-react";

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  quick_status?: string | null;
  lat?: number | null;
  lng?: number | null;
  timestamp?: number | null; // epoch time in milliseconds
}

interface MemberPanelProps {
  members: Member[];
  meetPoint: { lat: number | null; lng: number | null; name?: string | null };
  currentUserId: string | null;
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

  return R * c; // in meters
}

export function MemberPanel({ members, meetPoint, currentUserId }: MemberPanelProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000); // update timestamps every 10s
    return () => clearInterval(timer);
  }, []);

  const getMemberStatus = (mem: Member) => {
    if (mem.lat === null || mem.lng === null || !mem.lat || !mem.lng) {
      return { label: "Offline", color: "#475569", text: "text-slate-400" };
    }

    const ageMs = mem.timestamp ? now - mem.timestamp : null;
    if (ageMs !== null && ageMs > 120000) {
      // no update >2min
      return { label: "Stale", color: "#94A3B8", text: "text-[#94A3B8]" };
    }

    // If meetpoint is set, calculate distance to it
    if (meetPoint.lat !== null && meetPoint.lng !== null) {
      const dist = calculateDistance(mem.lat, mem.lng, meetPoint.lat, meetPoint.lng);
      if (dist <= 100) {
        return { label: `Arrived (${Math.round(dist)}m)`, color: "#22C55E", text: "text-[#22C55E]" };
      } else if (dist <= 500) {
        return { label: `Near (${Math.round(dist)}m)`, color: "#3B82F6", text: "text-[#3B82F6]" };
      } else {
        return { label: `On the way (${(dist / 1000).toFixed(1)}km)`, color: "#F59E0B", text: "text-[#F59E0B]" };
      }
    }

    // Default status if no meetpoint is set but online
    return { label: "On the way", color: "#F59E0B", text: "text-[#F59E0B]" };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#0F766E]" />
          <span className="text-sm font-bold text-slate-800">Crew Status</span>
        </div>
        <span className="px-2 py-0.5 bg-slate-200 text-[10px] font-bold text-slate-600 rounded-full">
          {members.length} Total
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {members.map((mem) => {
          const status = getMemberStatus(mem);
          const isMe = mem.user_id === currentUserId;

          return (
            <div
              key={mem.user_id}
              className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl transition hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                {/* Avatar / Profile Initials */}
                <div className="relative">
                  <span className="h-9 w-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">
                    {mem.avatar_url ? (
                      <img src={mem.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (mem.full_name || "?").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  {/* Status indicator dot */}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: status.color }}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                      {mem.full_name || "Traveler"}
                    </span>
                    {isMe && (
                      <span className="px-1.5 py-0.5 bg-[#CCFBF1] text-[#0F766E] text-[8px] font-bold rounded-md uppercase">
                        You
                      </span>
                    )}
                  </div>

                  {mem.quick_status && (
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      {mem.quick_status === "running_late" && "🏃 Running Late"}
                      {mem.quick_status === "on_my_way" && "🚗 On My Way"}
                      {mem.quick_status === "here" && "✅ I'm Here!"}
                    </span>
                  )}
                </div>
              </div>

              {/* Status & distance label */}
              <div className="text-right flex flex-col gap-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${status.text}`}>
                  {status.label}
                </span>
                {mem.lat && mem.lng && (
                  <span className="text-[9px] text-slate-400 font-semibold flex items-center justify-end gap-0.5">
                    <Compass className="h-2.5 w-2.5" />
                    Live GPS
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
