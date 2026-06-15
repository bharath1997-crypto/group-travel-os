"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref, type Database } from "firebase/database";
import { Clock } from "lucide-react";

type TimerState = {
  started_at?: number;
  duration_seconds?: number;
  is_active?: boolean;
};

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.max(0, totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CountdownTimer({
  tripId,
  firebaseDb,
  onComplete,
}: {
  tripId: string;
  firebaseDb: Database | null;
  onComplete?: () => void;
}) {
  const [state, setState] = useState<TimerState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!firebaseDb || !tripId) return undefined;
    const r = ref(firebaseDb, `trips/${tripId}/timer`);
    const off = onValue(r, (snap) => {
      const v = snap.val() as TimerState | null;
      setState(v && typeof v === "object" ? v : null);
    });
    return () => off();
  }, [firebaseDb, tripId]);

  useEffect(() => {
    if (!state?.is_active) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state?.is_active]);

  const remaining = useMemo(() => {
    if (!state?.is_active || !state.started_at || !state.duration_seconds)
      return null;
    void tick;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - Number(state.started_at);
    return Math.max(0, Number(state.duration_seconds) - elapsed);
  }, [state, tick]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining > 0) return;
    onComplete?.();
  }, [onComplete, remaining]);

  const warn = remaining !== null && remaining <= 60;

  if (!state?.is_active || remaining === null) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500 rounded-full">
        <Clock className="h-3.5 w-3.5" />
        <span>Timer Inactive</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-4 py-2 border rounded-full text-sm font-bold tabular-nums transition ${
        warn
          ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
          : "border-slate-200 bg-white text-[#0F766E]"
      }`}
    >
      <Clock className="h-4 w-4" />
      <span>{formatMmSs(remaining)}</span>
    </div>
  );
}
