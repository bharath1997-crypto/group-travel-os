"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Edit3 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Activity {
  time?: string | null;
  description: string;
}

interface DayPlan {
  day_number: number;
  date?: string | null;
  destination?: string | null;
  departure_time?: string | null;
  activities?: Activity[] | null;
}

interface TripPlanProps {
  tripId: string;
  isAdmin: boolean;
  onEditRequest: () => void;
}

export function TripPlan({ tripId, isAdmin, onEditRequest }: TripPlanProps) {
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<DayPlan[]>(`/trips/${tripId}/live-plan`);
      if (Array.isArray(res)) {
        setPlans(res);
      }
    } catch (err) {
      console.error("Failed to fetch live plan:", err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0F766E]" />
        <span className="text-xs text-slate-400">Loading live itinerary...</span>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Calendar className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-700">No active itinerary plan</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">Set up a daily plan to coordinate effectively.</p>
        {isAdmin && (
          <button
            onClick={onEditRequest}
            className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D635C] text-white text-xs font-semibold rounded-xl transition"
          >
            Create Plan
          </button>
        )}
      </div>
    );
  }

  const activeDay = plans[activeDayIdx];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#0F766E]" />
          <span className="text-sm font-bold text-slate-800">Trip Plan</span>
        </div>
        {isAdmin && (
          <button
            onClick={onEditRequest}
            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Day Selector Tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto px-2 py-1.5 bg-slate-50/50 gap-1.5">
        {plans.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setActiveDayIdx(idx)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
              activeDayIdx === idx
                ? "bg-[#0F766E] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Day {day.day_number}
          </button>
        ))}
      </div>

      {/* Day Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeDay && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1 p-3 bg-[#CCFBF1]/40 border border-[#CCFBF1] rounded-xl">
              {activeDay.destination && (
                <div className="flex items-center gap-1.5 text-xs text-[#0F766E] font-bold">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Target: {activeDay.destination}</span>
                </div>
              )}
              {activeDay.departure_time && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Departure: {activeDay.departure_time}</span>
                </div>
              )}
            </div>

            {/* Activities Timeline */}
            <div className="space-y-3 pl-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Timeline
              </span>
              {activeDay.activities && activeDay.activities.length > 0 ? (
                <div className="relative border-l border-slate-100 pl-4 space-y-4 ml-2.5">
                  {activeDay.activities.map((act, aIdx) => (
                    <div key={aIdx} className="relative group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[22.5px] top-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 group-hover:bg-[#0F766E] transition-all" />
                      <div className="flex flex-col gap-0.5">
                        {act.time && (
                          <span className="text-[10px] font-bold text-[#0F766E] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {act.time}
                          </span>
                        )}
                        <p className="text-xs font-semibold text-slate-700 leading-normal">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No scheduled activities.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
