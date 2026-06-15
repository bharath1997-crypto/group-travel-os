"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, Play } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Database, ref, onValue } from "firebase/database";

export interface MemberReadiness {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_accepted: boolean;
}

interface ChecklistOverlayProps {
  tripId: string;
  sessionId: string;
  firebaseDb: Database | null;
  isAdmin: boolean;
  onGoLive: () => void;
  currentUserId: string | null;
  initialReadiness?: MemberReadiness[];
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 2000,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Failed after retries");
}

const ITEMS = [
  "I am ready to share my location coordinates",
  "I have verified the meeting point location",
  "My phone battery is charged above 20%",
  "I have reviewed the daily itinerary plans",
];

export function ChecklistOverlay({
  tripId,
  sessionId,
  firebaseDb,
  isAdmin,
  onGoLive,
  currentUserId,
  initialReadiness = [],
}: ChecklistOverlayProps) {
  const [readiness, setReadiness] = useState<MemberReadiness[]>(initialReadiness);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(ITEMS.map(() => false));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (initialReadiness.length > 0) {
      setReadiness(initialReadiness);
    } else {
      const fetchChecklist = async () => {
        try {
          const rows = await fetchWithRetry(() =>
            apiFetch<any[]>(`/live/sessions/${sessionId}/checklist`),
          );
          if (cancelled) return;
          setReadiness(
            rows.map((r) => ({
              user_id: r.user_id,
              full_name: r.full_name,
              avatar_url: r.avatar_url,
              is_accepted: r.is_accepted,
            })),
          );
        } catch {
          /* Firebase listener may still populate readiness */
        }
      };
      fetchChecklist();
    }

    if (!firebaseDb) {
      return () => {
        cancelled = true;
      };
    }

    const dbRef = ref(firebaseDb, `trips/${tripId}/live_session/checklist`);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const val = snapshot.val() as Record<string, { accepted?: boolean }> | null;
      if (!val) return;
      setReadiness((prev) =>
        prev.map((m) => ({
          ...m,
          is_accepted: !!val[m.user_id]?.accepted,
        })),
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, firebaseDb, tripId, initialReadiness]);

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const isAllChecked = checkedItems.every(Boolean);
  const isUserAccepted = readiness.find((r) => r.user_id === currentUserId)?.is_accepted || false;
  const allMembersReady = readiness.length > 0 && readiness.every((r) => r.is_accepted);

  const handleAccept = async () => {
    if (!isAllChecked || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/live/sessions/${sessionId}/checklist/accept`, {
        method: "POST",
      });
      // Update local status
      setReadiness((prev) =>
        prev.map((m) => (m.user_id === currentUserId ? { ...m, is_accepted: true } : m))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl border border-slate-200 shadow-2xl p-8 flex flex-col gap-6 text-slate-800 my-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Live Mode Checklist
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Ensure all team members are coordinated and ready before going active.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* User Checklist */}
          <div className="space-y-4 bg-[#F8FAFC] border border-slate-200/80 p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Your Verification
            </h3>
            {isUserAccepted ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <CheckCircle2 className="h-12 w-12" />
                <span className="font-semibold text-sm">You are ready!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className="w-full flex items-start gap-3 p-2 hover:bg-slate-50 rounded-xl transition text-left"
                  >
                    {checkedItems[idx] ? (
                      <CheckCircle2 className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm text-slate-600 font-medium">
                      {item}
                    </span>
                  </button>
                ))}
                <button
                  disabled={!isAllChecked || submitting}
                  onClick={handleAccept}
                  className="w-full mt-2 py-3 bg-[#0F766E] hover:bg-[#0D635C] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm I&apos;m Ready
                </button>
              </div>
            )}
          </div>

          {/* Member Readiness list */}
          <div className="space-y-4 bg-[#F8FAFC] border border-slate-200/80 p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Member Status
            </h3>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {readiness.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (m.full_name || "?").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
                      {m.full_name || "Traveler"}
                    </span>
                  </div>
                  {m.is_accepted ? (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                      Ready
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                      Waiting
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Go Live Actions */}
        {isAdmin && (
          <div className="border-t border-slate-100 pt-6 flex flex-col items-center gap-3">
            {!allMembersReady && (
              <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
                Waiting for all group members to check in before live tracking can start.
              </p>
            )}
            <button
              disabled={!allMembersReady}
              onClick={onGoLive}
              className="w-full max-w-sm py-4 bg-[#0F766E] hover:bg-[#0D635C] disabled:bg-slate-150 disabled:text-slate-400 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl shadow-slate-200 disabled:shadow-none"
            >
              <Play className="h-5 w-5 fill-current" />
              Go LIVE Mode Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
