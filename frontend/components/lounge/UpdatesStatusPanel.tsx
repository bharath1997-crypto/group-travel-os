"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { GT_LOUNGE_STATUS, type LoungeStatus } from "@/lib/lounge/stickers";
import { readJsonLs, writeJsonLs } from "@/lib/lounge/storage";

type UpdatesStatusPanelProps = {
  userId: string | null;
  userName: string | null;
};

export function UpdatesStatusPanel({ userId, userName }: UpdatesStatusPanelProps) {
  const [statuses, setStatuses] = useState<LoungeStatus[]>([]);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setStatuses(readJsonLs<LoungeStatus[]>(GT_LOUNGE_STATUS, []));
  }, []);

  const myStatus = userId ? statuses.find((s) => s.userId === userId) : null;

  const postStatus = () => {
    if (!userId || !draft.trim()) return;
    const entry: LoungeStatus = {
      userId,
      userName: userName?.trim() || "You",
      text: draft.trim(),
      updatedAt: Date.now(),
    };
    const next = [entry, ...statuses.filter((s) => s.userId !== userId)].slice(0, 20);
    setStatuses(next);
    writeJsonLs(GT_LOUNGE_STATUS, next);
    setDraft("");
    setComposing(false);
  };

  const clearMyStatus = () => {
    if (!userId) return;
    const next = statuses.filter((s) => s.userId !== userId);
    setStatuses(next);
    writeJsonLs(GT_LOUNGE_STATUS, next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-stone-100 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {userName?.charAt(0) || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900">My Status</p>
            <p className="text-[10px] text-stone-500 truncate">
              {myStatus
                ? myStatus.text
                : "Tap + to share what you're up to"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposing((c) => !c)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-primary"
          >
            {composing ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
        {composing ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's happening on your trip?"
              rows={2}
              className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              {myStatus ? (
                <button type="button" onClick={clearMyStatus} className="text-[10px] font-bold text-red-600">
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={postStatus}
                disabled={!draft.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
              >
                Post status
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {statuses.length === 0 ? (
          <p className="py-8 text-center text-xs text-stone-500">No updates from your contacts yet</p>
        ) : (
          statuses.map((s) => (
            <div key={`${s.userId}-${s.updatedAt}`} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {s.userName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">{s.userName}</p>
                  <p className="text-[9px] text-stone-500">
                    {new Date(s.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-800">{s.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
