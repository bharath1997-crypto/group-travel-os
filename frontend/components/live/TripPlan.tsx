"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Plus, CheckCircle, Play, AlertCircle, Trash2, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Activity {
  time?: string | null;
  description: string;
  status?: string | null; // "active" | "completed" | "upcoming"
}

interface DayPlan {
  day_number: number;
  date?: string | null;
  destination?: string | null;
  departure_time?: string | null;
  activities?: Activity[] | null;
  status?: string | null; // "completed" | "in_progress" | "tomorrow"
}

interface TripPlanProps {
  tripId: string;
  isAdmin: boolean;
}

export function TripPlan({ tripId, isAdmin }: TripPlanProps) {
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for adding activity
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<DayPlan[]>(`/trips/${tripId}/live-plan`);
      if (Array.isArray(res)) {
        // Enforce default status fields client-side if missing
        const hydrated = res.map((day) => ({
          ...day,
          status: day.status || "tomorrow",
          activities: (day.activities || []).map((act) => ({
            ...act,
            status: act.status || "upcoming",
          })),
        }));
        setPlans(hydrated);
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

  const handleSavePlan = async (updatedPlans: DayPlan[]) => {
    setIsSaving(true);
    try {
      const payload = {
        days: updatedPlans.map((d) => ({
          day_number: d.day_number,
          date: d.date || null,
          destination: d.destination || "",
          departure_time: d.departure_time || "",
          activities: (d.activities || []).map((a) => ({
            time: a.time || null,
            description: a.description,
            status: a.status || "upcoming",
          })),
        })),
      };
      await apiFetch(`/trips/${tripId}/live-plan`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPlans(updatedPlans);
    } catch (err) {
      console.error("Failed to save plan:", err);
      alert("Failed to save plan changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDay = () => {
    const nextDayNum = plans.length + 1;
    const newDay: DayPlan = {
      day_number: nextDayNum,
      destination: "New Destination",
      departure_time: "08:00",
      status: "tomorrow",
      activities: [],
    };
    const nextPlans = [...plans, newDay];
    handleSavePlan(nextPlans);
    setActiveDayIdx(nextPlans.length - 1);
  };

  const handleUpdateDayStatus = (dayIdx: number, newStatus: string) => {
    const nextPlans = plans.map((p, idx) => {
      if (idx === dayIdx) {
        return { ...p, status: newStatus };
      }
      return p;
    });
    handleSavePlan(nextPlans);
  };

  const handleAddActivity = () => {
    if (!newDesc.trim()) return;
    const nextPlans = plans.map((p, idx) => {
      if (idx === activeDayIdx) {
        const currentActs = p.activities || [];
        return {
          ...p,
          activities: [
            ...currentActs,
            { time: newTime || null, description: newDesc.trim(), status: "upcoming" },
          ],
        };
      }
      return p;
    });
    handleSavePlan(nextPlans);
    setNewTime("");
    setNewDesc("");
    setShowAddForm(false);
  };

  const handleUpdateActivityStatus = (actIdx: number, newStatus: string) => {
    const nextPlans = plans.map((p, idx) => {
      if (idx === activeDayIdx) {
        const acts = (p.activities || []).map((act, aIdx) => {
          if (aIdx === actIdx) {
            return { ...act, status: newStatus };
          }
          // Only one activity can be active at a time
          if (newStatus === "active" && act.status === "active") {
            return { ...act, status: "completed" };
          }
          return act;
        });
        return { ...p, activities: acts };
      }
      return p;
    });
    handleSavePlan(nextPlans);
  };

  const handleDeleteActivity = (actIdx: number) => {
    const nextPlans = plans.map((p, idx) => {
      if (idx === activeDayIdx) {
        const acts = (p.activities || []).filter((_, aIdx) => aIdx !== actIdx);
        return { ...p, activities: acts };
      }
      return p;
    });
    handleSavePlan(nextPlans);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0F766E]" />
        <span className="text-xs text-slate-400">Loading live itinerary...</span>
      </div>
    );
  }

  const activeDay = plans[activeDayIdx];

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
      {/* Tab/Day Selector Row */}
      <div className="flex border-b border-slate-200 overflow-x-auto px-3 py-2 bg-slate-50 gap-2 items-center">
        {plans.map((day, idx) => {
          let badgeColor = "bg-slate-400/10 text-slate-500";
          if (day.status === "completed") badgeColor = "bg-emerald-500/10 text-emerald-600";
          else if (day.status === "in_progress") badgeColor = "bg-[#0F766E]/10 text-[#0F766E]";

          return (
            <button
              key={idx}
              onClick={() => {
                setActiveDayIdx(idx);
                setShowAddForm(false);
              }}
              className={`px-3 py-2 text-xs font-black rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                activeDayIdx === idx
                  ? "bg-[#0F766E] text-white border-[#0F766E] shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              Day {day.day_number}
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${activeDayIdx === idx ? "bg-white/20 text-white" : badgeColor}`}>
                {day.status === "completed" && "Done"}
                {day.status === "in_progress" && "Live"}
                {day.status === "tomorrow" && "Soon"}
              </span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            onClick={handleAddDay}
            className="p-2 bg-white border border-dashed border-slate-300 hover:border-slate-400 text-slate-500 hover:text-slate-700 rounded-xl transition shrink-0"
            title="Add Day"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Day Details panel */}
      {activeDay ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Day Card Header info */}
          <div className="flex items-center justify-between border border-slate-200 rounded-2xl p-3 bg-slate-50">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-[#0F766E]" />
                <span className="text-xs font-black text-slate-800">
                  {activeDay.destination || "Coordinating Location"}
                </span>
              </div>
              {activeDay.departure_time && (
                <span className="text-[10px] text-slate-500 font-bold block mt-1">
                  Starts: {activeDay.departure_time}
                </span>
              )}
            </div>

            {isAdmin && (
              <select
                value={activeDay.status || "tomorrow"}
                onChange={(e) => handleUpdateDayStatus(activeDayIdx, e.target.value)}
                className="text-xs font-bold border border-slate-200 bg-white rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-[#0F766E]"
              >
                <option value="tomorrow">Upcoming</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>

          {/* Activities Timeline */}
          <div className="flex-1">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 pl-1">
              Timeline Activities
            </h4>
            <div className="relative border-l border-slate-200 pl-4 ml-2.5 space-y-4">
              {(activeDay.activities || []).map((act, idx) => {
                const isActive = act.status === "active";
                const isCompleted = act.status === "completed";

                let dotColor = "bg-slate-300";
                if (isActive) dotColor = "bg-[#0F766E]";
                else if (isCompleted) dotColor = "bg-emerald-500";

                return (
                  <div key={idx} className="relative flex items-start justify-between gap-4 group">
                    {/* Timeline Dot */}
                    <span className={`absolute -left-[22.5px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm transition-all ${dotColor}`} />

                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        {act.time && (
                          <span className={`text-[10px] font-bold ${isActive ? "text-[#0F766E]" : "text-slate-400"}`}>
                            {act.time}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[8px] bg-teal-500/20 text-[#0F766E] px-1.5 py-0.2 rounded font-black tracking-wide">
                            ACTIVE
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.2 rounded font-black tracking-wide">
                            COMPLETED
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isActive ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
                        {act.description}
                      </p>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                        {!isCompleted && !isActive && (
                          <button
                            onClick={() => handleUpdateActivityStatus(idx, "active")}
                            className="p-1 hover:bg-slate-100 text-[#0F766E] rounded"
                            title="Set Active"
                          >
                            <Play size={12} fill="currentColor" />
                          </button>
                        )}
                        {isActive && (
                          <button
                            onClick={() => handleUpdateActivityStatus(idx, "completed")}
                            className="p-1 hover:bg-slate-100 text-emerald-600 rounded"
                            title="Complete"
                          >
                            <CheckCircle size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteActivity(idx)}
                          className="p-1 hover:bg-slate-100 text-red-500 rounded"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Activity Button/Form */}
              {isAdmin && (
                <div className="pt-2">
                  {showAddForm ? (
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3 max-w-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Time (e.g. 14:30)"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-[#0F766E]"
                        />
                        <input
                          type="text"
                          placeholder="Activity details"
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          className="text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-[#0F766E]"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-[10px] font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddActivity}
                          className="px-3 py-1 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-lg text-[10px] font-bold shadow"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-300 hover:border-slate-400 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold transition-all bg-white"
                    >
                      <Plus size={14} /> Add Activity
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
          <Calendar className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No days in live itinerary</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Click below to start scheduling.</p>
          {isAdmin && (
            <button
              onClick={handleAddDay}
              className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D635C] text-white text-xs font-semibold rounded-xl transition shadow"
            >
              Initialize Itinerary
            </button>
          )}
        </div>
      )}
    </div>
  );
}
