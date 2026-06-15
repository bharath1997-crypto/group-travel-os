"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, MapPin, Sparkles, Plus, Loader2, Landmark, Tag, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category?: string | null;
  created_at: string;
}

interface PinnedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string | null;
}

interface WayraRecommendation {
  name: string;
  type: string;
  distance: number;
  description: string;
}

interface ActivityPanelProps {
  tripId: string;
  currentUserId: string | null;
  members: Array<{ user_id: string; full_name: string | null }>;
}

export function ActivityPanel({ tripId, currentUserId, members }: ActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<"expenses" | "places" | "wayra">("expenses");
  
  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [places, setPlaces] = useState<PinnedPlace[]>([]);
  const [wayraPicks, setWayraPicks] = useState<WayraRecommendation[]>([]);
  
  // Loading states
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingWayra, setLoadingWayra] = useState(false);

  // Expense modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Food");
  const [expCurrency, setExpCurrency] = useState("USD");
  const [selectedSplitMembers, setSelectedSplitMembers] = useState<string[]>([]);
  const [savingExpense, setSavingExpense] = useState(false);

  // Initial selected split members is all group members
  useEffect(() => {
    if (members.length > 0) {
      setSelectedSplitMembers(members.map(m => m.user_id));
    }
  }, [members]);

  const fetchExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const res = await apiFetch<Expense[]>(`/trips/${tripId}/expenses`);
      if (Array.isArray(res)) setExpenses(res);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [tripId]);

  const fetchPlaces = useCallback(async () => {
    setLoadingPlaces(true);
    try {
      const res = await apiFetch<PinnedPlace[]>(`/trips/${tripId}/locations`);
      if (Array.isArray(res)) setPlaces(res);
    } catch (err) {
      console.error("Failed to load pinned places:", err);
    } finally {
      setLoadingPlaces(false);
    }
  }, [tripId]);

  const fetchWayraRecommendations = useCallback(async () => {
    setLoadingWayra(true);
    try {
      const res = await apiFetch<{ picks: WayraRecommendation[] }>(`/wayra/nearby/${tripId}`);
      if (res?.picks && Array.isArray(res.picks)) setWayraPicks(res.picks);
    } catch (err) {
      console.error("Failed to load Wayra recommendations:", err);
    } finally {
      setLoadingWayra(false);
    }
  }, [tripId]);

  // Load active tab data
  useEffect(() => {
    if (activeTab === "expenses") fetchExpenses();
    else if (activeTab === "places") fetchPlaces();
    else if (activeTab === "wayra") fetchWayraRecommendations();
  }, [activeTab, fetchExpenses, fetchPlaces, fetchWayraRecommendations]);

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount || Number(expAmount) <= 0) return;

    setSavingExpense(true);
    try {
      await apiFetch(`/trips/${tripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: expDesc.trim(),
          amount: Number(expAmount),
          currency: expCurrency,
          split_with: selectedSplitMembers,
          split_type: "equal",
          category: expCategory,
        }),
      });
      setExpDesc("");
      setExpAmount("");
      setShowAddExpense(false);
      fetchExpenses();
    } catch (err) {
      console.error("Failed to create expense:", err);
      alert("Failed to add expense.");
    } finally {
      setSavingExpense(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
      {/* Sub tabs header */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-1.5">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            activeTab === "expenses"
              ? "bg-[#0F766E] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          <DollarSign size={14} /> Expenses
        </button>
        <button
          onClick={() => setActiveTab("places")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            activeTab === "places"
              ? "bg-[#0F766E] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          <MapPin size={14} /> Pinned Places
        </button>
        <button
          onClick={() => setActiveTab("wayra")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            activeTab === "wayra"
              ? "bg-[#0F766E] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles size={14} /> Wayra Nearby
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* EXPENSES SUB-TAB */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 text-white rounded-2xl p-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Group Spending</p>
                <p className="text-xl font-black mt-1 text-teal-400">
                  ${totalExpenseAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">USD</span>
                </p>
              </div>
              <button
                onClick={() => setShowAddExpense(true)}
                className="px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D635C] rounded-xl text-xs font-bold shadow-md shadow-[#0F766E]/20 transition flex items-center gap-1"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {loadingExpenses ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#0F766E]" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">No shared expenses logged yet.</p>
            ) : (
              <div className="space-y-2.5">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{exp.description}</p>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600 inline-block mt-1">
                        {exp.category || "General"}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-850">
                      ${exp.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PINNED PLACES SUB-TAB */}
        {activeTab === "places" && (
          <div className="space-y-3">
            {loadingPlaces ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#0F766E]" />
              </div>
            ) : places.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">No saved coordinates pinned to this trip.</p>
            ) : (
              <div className="space-y-2.5">
                {places.map((place) => (
                  <div key={place.id} className="flex items-start gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="h-8 w-8 bg-teal-50 text-[#0F766E] rounded-xl flex items-center justify-center shrink-0 border border-teal-100">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{place.name}</p>
                      <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
                        Lat: {place.latitude.toFixed(4)}, Lng: {place.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WAYRA RECOMMENDATIONS SUB-TAB */}
        {activeTab === "wayra" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 flex gap-3 items-start">
              <div className="h-8 w-8 bg-teal-500/15 text-teal-400 rounded-xl flex items-center justify-center shrink-0 border border-teal-500/25">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-teal-400 tracking-wider">Wayra AI Recommendations</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Real-time suggestions computed based on your current crew location centroids.
                </p>
              </div>
            </div>

            {loadingWayra ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#0F766E]" />
              </div>
            ) : wayraPicks.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">Wayra is generating nearby points of interest...</p>
            ) : (
              <div className="space-y-3">
                {wayraPicks.map((pick, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-black text-slate-800">{pick.name}</span>
                      <span className="text-[9px] font-black uppercase bg-[#CCFBF1] text-[#0F766E] border border-teal-100 px-2 py-0.5 rounded-full">
                        {pick.distance} mi
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-550 leading-relaxed font-semibold">{pick.description}</p>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">
                      Category: {pick.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Expense Modal Overlay */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddExpenseSubmit}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-left"
          >
            <div>
              <h4 className="text-md font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={18} className="text-teal-400" /> Log Shared Expense
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">Split cost equally among chosen crew members.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lunch at beach side"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2.5 bg-slate-950 text-slate-200 focus:outline-none focus:border-[#0F766E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2.5 bg-slate-950 text-slate-200 focus:outline-none focus:border-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2.5 bg-slate-950 text-slate-200 focus:outline-none focus:border-[#0F766E]"
                  >
                    <option value="Food">Food & Drink</option>
                    <option value="Transport">Transport</option>
                    <option value="Stay">Lodging</option>
                    <option value="Tickets">Entry Tickets</option>
                    <option value="General">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Split With</label>
                <div className="border border-slate-800 bg-slate-950 rounded-xl p-2.5 max-h-[100px] overflow-y-auto space-y-2">
                  {members.map((m) => {
                    const isSelected = selectedSplitMembers.includes(m.user_id);
                    return (
                      <label key={m.user_id} className="flex items-center gap-2 text-xs font-bold text-slate-350 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedSplitMembers(selectedSplitMembers.filter(id => id !== m.user_id));
                            } else {
                              setSelectedSplitMembers([...selectedSplitMembers, m.user_id]);
                            }
                          }}
                          className="rounded text-[#0F766E] focus:ring-[#0F766E] bg-slate-900 border-slate-800"
                        />
                        <span>{m.full_name || "Traveler"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowAddExpense(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingExpense || selectedSplitMembers.length === 0}
                className="flex-1 py-2.5 bg-[#0F766E] hover:bg-[#0D635C] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#0F766E]/20 flex items-center justify-center gap-1.5"
              >
                {savingExpense ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Log Split"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
