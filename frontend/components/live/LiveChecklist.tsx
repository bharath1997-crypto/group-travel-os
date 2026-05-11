"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onValue, ref, type Database } from "firebase/database";

import { apiFetch } from "@/lib/api";

type Member = {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_accepted?: boolean;
};

type Props = {
  tripId: string;
  sessionId: string;
  members: Member[];
  currentUserId: string | null;
  firebaseDb: Database | null;
  onAcceptedAll?: () => void;
};

const ITEMS = [
  "I'm ready to share my location",
  "I have the meeting point details",
  "My battery is above 20%",
  "I've reviewed the trip plan",
  "I accept location sharing for this session",
];

export function LiveChecklistPanel({
  tripId,
  sessionId,
  members,
  currentUserId,
  firebaseDb: _firebaseDb,
  onAcceptedAll,
}: Props) {
  const [boxes, setBoxes] = useState<boolean[]>(() => ITEMS.map(() => false));
  const [saving, setSaving] = useState(false);
  const [acceptedRemote, setAcceptedRemote] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<
          { user_id: string; is_accepted: boolean }[]
        >(`/live/sessions/${sessionId}/checklist`);
        if (!cancelled) {
          const m: Record<string, boolean> = {};
          rows.forEach((r) => {
            m[r.user_id] = r.is_accepted;
          });
          setAcceptedRemote((prev) => ({ ...prev, ...m }));
        }
      } catch {
        /* stale view */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!_firebaseDb || !tripId) return undefined;
    const r = ref(_firebaseDb, `trips/${tripId}/live_session/checklist`);
    const off = onValue(r, (snap) => {
      const raw = snap.val() as Record<string, { accepted?: boolean }> | null;
      if (!raw || typeof raw !== "object") return;
      const m: Record<string, boolean> = {};
      Object.keys(raw).forEach((uid) => {
        m[uid] = Boolean(raw[uid]?.accepted);
      });
      setAcceptedRemote((prev) => ({ ...prev, ...m }));
    });
    return () => off();
  }, [_firebaseDb, tripId]);

  const mergedMembers = useMemo(() => {
    return members.map((m) => ({
      ...m,
      accepted: acceptedRemote[m.user_id] ?? m.is_accepted ?? false,
    }));
  }, [acceptedRemote, members]);

  const toggleBox = useCallback((i: number) => {
    setBoxes((prev) => {
      const n = [...prev];
      n[i] = !n[i];
      return n;
    });
  }, []);

  const pendingCount = mergedMembers.filter((m) => !m.accepted).length;

  const allBoxes = boxes.every(Boolean);

  async function submit() {
    if (!allBoxes) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ all_accepted: boolean }>(
        `/live/sessions/${sessionId}/checklist/accept`,
        { method: "POST" },
      );
      if (res.all_accepted) onAcceptedAll?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[#1f3a61] bg-[#0f1f44] px-5 py-5 text-[#eaf0fc]">
      <div>
        <p className="text-sm font-semibold text-[#eaf0fc]">Pre-live checklist</p>
        <p className="mt-1 text-xs text-[#8fa6d3]">
          Confirm everyone is coordinated before GPS sharing goes live.
        </p>
      </div>

      <ul className="space-y-3">
        {ITEMS.map((label, idx) => (
          <li key={label} className="flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={boxes[idx]}
              onClick={() => toggleBox(idx)}
              className={[
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                boxes[idx]
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-[#3c5688] bg-[#0f1f44]",
              ].join(" ")}
            >
              {boxes[idx] ? (
                <span className="text-xs font-bold leading-none">✓</span>
              ) : null}
            </button>
            <span className="text-sm leading-snug">{label}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!allBoxes || saving}
        onClick={() => submit()}
        className="w-full rounded-xl py-3 text-sm font-bold text-[#081021] shadow transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: "#E94560" }}
      >
        {saving ? "Saving…" : "Accept & ready"}
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8fa6d3]">
          Member readiness
        </p>
        <p className="mt-1 text-sm text-[#cae0ff]">
          Waiting for{" "}
          <span className="font-semibold text-white">{pendingCount}</span>{" "}
          member{pendingCount === 1 ? "" : "s"}…
        </p>

        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-3">
          {mergedMembers.map((m) => (
            <div key={m.user_id} className="flex flex-col items-center gap-1">
              <div className="relative">
                <span
                  className={[
                    "flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-semibold shadow-sm",
                    m.accepted ? "border-emerald-400" : "border-[#3c5688]",
                  ].join(" ")}
                  style={{
                    background: m.avatar_url ? undefined : "linear-gradient(to bottom,#1d3b78,#081021)",
                  }}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{(m.full_name || "?").slice(0, 1)}</span>
                  )}
                </span>
                <span
                  className={[
                    "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#0f1f44] text-[10px] font-bold shadow",
                    m.accepted ? "bg-emerald-500 text-[#082210]" : "bg-slate-500 text-white",
                  ].join(" ")}
                  title={m.accepted ? "Accepted" : "Waiting"}
                  aria-hidden
                >
                  {m.accepted ? "✓" : "⋯"}
                </span>
              </div>
              <span className="max-w-[4.75rem] truncate text-[10px] text-[#8fa6d3]">
                {m.user_id === currentUserId ? "You" : m.full_name?.split?.(" ")?.[0] || "Traveler"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
