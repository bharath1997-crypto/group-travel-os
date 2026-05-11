"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref, type Database } from "firebase/database";

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

export function LiveTimer({
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
      <div className="rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        Timer idle
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-full border px-3 py-1 text-xs font-bold tabular-nums text-white backdrop-blur transition",
        warn ? "border-amber-300 bg-red-950/85 animate-pulse" : "border-white/35 bg-black/55",
      ].join(" ")}
    >
      {formatMmSs(remaining)}
    </div>
  );
}
