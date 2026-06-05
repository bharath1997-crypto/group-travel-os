"use client";

import { useState } from "react";
import { Plus, Trash2, Calendar, MapPin, Clock, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Activity {
  time: string;
  description: string;
}

interface DayPlan {
  day_number: number;
  destination: string;
  departure_time: string;
  activities: Activity[];
}

interface TripPlannerProps {
  tripId: string;
  onPlanSaved: () => void;
}

export function TripPlanner({ tripId, onPlanSaved }: TripPlannerProps) {
  const [days, setDays] = useState<DayPlan[]>([
    {
      day_number: 1,
      destination: "",
      departure_time: "",
      activities: [{ time: "", description: "" }],
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDay = () => {
    setDays((prev) => [
      ...prev,
      {
        day_number: prev.length + 1,
        destination: "",
        departure_time: "",
        activities: [{ time: "", description: "" }],
      },
    ]);
  };

  const removeDay = (index: number) => {
    if (days.length <= 1) return;
    setDays((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-index days
      return next.map((d, i) => ({ ...d, day_number: i + 1 }));
    });
  };

  const updateDayField = (index: number, field: keyof DayPlan, value: any) => {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const addActivity = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, activities: [...d.activities, { time: "", description: "" }] }
          : d
      )
    );
  };

  const removeActivity = (dayIndex: number, activityIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              activities: d.activities.filter((_, ai) => ai !== activityIndex),
            }
          : d
      )
    );
  };

  const updateActivityField = (
    dayIndex: number,
    activityIndex: number,
    field: keyof Activity,
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const nextActivities = d.activities.map((act, ai) =>
          ai === activityIndex ? { ...act, [field]: value } : act
        );
        return { ...d, activities: nextActivities };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/plan`, {
        method: "POST",
        body: JSON.stringify({ days }),
      });
      onPlanSaved();
    } catch (err: any) {
      setError(err?.message || "Failed to save trip plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-[#F8FAFC] min-h-screen text-slate-800">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#0F766E]" /> Edit Trip Itinerary
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Build your day-by-day plan. Wayra AI uses this context to monitor the group&apos;s schedule and generate alerts.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm bg-red-50 text-red-600 border border-red-100 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {days.map((day, dIdx) => (
            <div
              key={dIdx}
              className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="font-bold text-[#0F766E] text-lg">
                  Day {day.day_number} Plan
                </span>
                {days.length > 1 && (
                  <button
                    onClick={() => removeDay(dIdx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Destination/Target Area
                  </label>
                  <input
                    type="text"
                    value={day.destination}
                    onChange={(e) => updateDayField(dIdx, "destination", e.target.value)}
                    placeholder="e.g. Louvre Museum area"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F766E] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Start / Departure Time
                  </label>
                  <input
                    type="time"
                    value={day.departure_time}
                    onChange={(e) => updateDayField(dIdx, "departure_time", e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F766E] transition"
                  />
                </div>
              </div>

              {/* Activities */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Activities & Events
                  </span>
                  <button
                    onClick={() => addActivity(dIdx)}
                    className="text-xs font-bold text-[#0F766E] hover:text-[#0D635C] flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Activity
                  </button>
                </div>

                <div className="space-y-2">
                  {day.activities.map((act, aIdx) => (
                    <div key={aIdx} className="flex gap-3 items-center">
                      <input
                        type="time"
                        value={act.time}
                        onChange={(e) =>
                          updateActivityField(dIdx, aIdx, "time", e.target.value)
                        }
                        className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0F766E] transition"
                      />
                      <input
                        type="text"
                        value={act.description}
                        onChange={(e) =>
                          updateActivityField(dIdx, aIdx, "description", e.target.value)
                        }
                        placeholder="Activity description (e.g. Guided tour)"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0F766E] transition"
                      />
                      {day.activities.length > 1 && (
                        <button
                          onClick={() => removeActivity(dIdx, aIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 border-t border-slate-100 pt-6">
          <button
            onClick={addDay}
            className="px-6 py-3 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Add Day
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-3 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save and Activate LIVE Mode
          </button>
        </div>
      </div>
    </div>
  );
}
