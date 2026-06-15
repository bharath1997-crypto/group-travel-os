"use client";

import { useEffect, useState } from "react";
import { MapPin, CheckCircle2, Award, Users, Plus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface MeetPoint {
  id: string;
  trip_id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_official: boolean;
  confirmed_by: string[]; // List of user IDs who confirmed arrival
}

interface MeetingPointProps {
  tripId: string;
  isAdmin: boolean;
  onSetMeetPointClick: () => void;
  currentUserId: string | null;
  meetPointListUpdatedTrigger?: number; // to allow external reload triggers
}

export function MeetingPoint({
  tripId,
  isAdmin,
  onSetMeetPointClick,
  currentUserId,
  meetPointListUpdatedTrigger,
}: MeetingPointProps) {
  const [points, setPoints] = useState<MeetPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetPoints = async () => {
    try {
      const res = await apiFetch<MeetPoint[]>(`/trips/${tripId}/meet-points`);
      if (Array.isArray(res)) {
        setPoints(res);
      }
    } catch (err) {
      console.error("Failed to load meet points:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetPoints();
  }, [tripId, meetPointListUpdatedTrigger]);

  const handleConfirmArrival = async (pointId: string) => {
    try {
      await apiFetch(`/meet-points/${pointId}/confirm`, {
        method: "PATCH",
      });
      fetchMeetPoints();
    } catch (err) {
      console.error("Failed to confirm meet point arrival:", err);
    }
  };

  const handleMakeOfficial = async (pointId: string) => {
    try {
      await apiFetch(`/trips/${tripId}/meet-points/${pointId}/official`, {
        method: "PATCH",
      });
      fetchMeetPoints();
    } catch (err) {
      console.error("Failed to set official meet point:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0F766E]" />
        <span className="text-xs text-slate-400">Loading meet coordinates...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#0F766E]" />
          <span className="text-sm font-bold text-slate-800">Meet Points</span>
        </div>
        {isAdmin && (
          <button
            onClick={onSetMeetPointClick}
            className="p-1 px-2.5 bg-[#0F766E]/10 hover:bg-[#0F766E]/20 text-[#0F766E] rounded-xl transition flex items-center gap-1 text-[10px] font-bold"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {points.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400 italic">No meet points established yet.</p>
            {isAdmin && (
              <button
                onClick={onSetMeetPointClick}
                className="mt-3 px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D635C] text-white text-xs font-semibold rounded-xl transition shadow"
              >
                Place Meet Point
              </button>
            )}
          </div>
        ) : (
          points.map((pt) => {
            const hasConfirmed = currentUserId ? pt.confirmed_by?.includes(currentUserId) : false;

            return (
              <div
                key={pt.id}
                className={`p-3.5 border rounded-2xl transition flex flex-col gap-3 ${
                  pt.is_official
                    ? "bg-[#CCFBF1]/20 border-[#CCFBF1] shadow-sm"
                    : "bg-slate-50 border-slate-200/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2.5 items-start">
                    <div className={`p-2 rounded-xl mt-0.5 ${pt.is_official ? "bg-[#0F766E] text-white" : "bg-slate-200 text-slate-600"}`}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-850 block leading-tight">
                        {pt.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                        Lat: {pt.latitude.toFixed(5)}, Lng: {pt.longitude.toFixed(5)}
                      </span>
                    </div>
                  </div>

                  {pt.is_official && (
                    <span className="px-2 py-0.5 bg-[#0F766E]/20 text-[#0F766E] text-[8px] font-extrabold uppercase rounded-md tracking-wider flex items-center gap-0.5">
                      <Award className="h-2.5 w-2.5" /> Official
                    </span>
                  )}
                </div>

                {/* Confirm / Action Row */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {pt.confirmed_by?.length || 0} Arrived
                  </span>

                  <div className="flex gap-2">
                    {isAdmin && !pt.is_official && (
                      <button
                        onClick={() => handleMakeOfficial(pt.id)}
                        className="px-2.5 py-1.5 border border-[#0F766E] text-[#0F766E] hover:bg-[#0F766E] hover:text-white rounded-lg text-[10px] font-bold transition"
                      >
                        Make Official
                      </button>
                    )}
                    <button
                      disabled={hasConfirmed}
                      onClick={() => handleConfirmArrival(pt.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                        hasConfirmed
                          ? "bg-slate-100 text-slate-400"
                          : "bg-[#0F766E] hover:bg-[#0D635C] text-white shadow-sm"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {hasConfirmed ? "Arrived" : "I'm Here"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
