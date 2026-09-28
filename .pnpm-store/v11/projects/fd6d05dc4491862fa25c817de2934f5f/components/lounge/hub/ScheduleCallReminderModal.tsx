"use client";

import { useEffect, useState } from "react";

import { appendScheduleCallReminder } from "@/lib/lounge/chat-prefs";
import type { ChatInfo } from "@/lib/lounge/hub-types";

type ScheduleCallReminderModalProps = {
  open: { chat: ChatInfo } | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  surface?: string;
  borderColor?: string;
  accent?: string;
};

export function ScheduleCallReminderModal({
  open,
  onClose,
  onSaved,
  showToast,
  surface = "#2d4060",
  borderColor = "rgba(255,255,255,0.08)",
  accent = "#4a9eff",
}: ScheduleCallReminderModalProps) {
  const [title, setTitle] = useState("");
  const [at, setAt] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setAt("");
    }
  }, [open?.chat.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Schedule a call"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col rounded-2xl border shadow-2xl"
        style={{ background: surface, borderColor }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor }}
        >
          <p className="truncate text-[15px] font-bold text-white">
            Schedule a call · {open.chat.name}
          </p>
          <button
            type="button"
            aria-label="Close"
            className="shrink-0 text-slate-400 hover:text-white"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="block text-xs text-slate-300">
            Title
            <input
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Trip planning catch-up"
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              style={{ borderColor }}
            />
          </label>
          <label className="block text-xs text-slate-300">
            When
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white outline-none"
              style={{ borderColor }}
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Saved as a reminder in this browser. Server-side scheduling will
            arrive in a later release.
          </p>
        </div>
        <div
          className="flex items-center justify-end gap-2 border-t px-3 py-3"
          style={{ borderColor }}
        >
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs text-white hover:bg-white/10"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: accent }}
            disabled={!at}
            onClick={() => {
              const ms = new Date(at).getTime();
              if (!ms || Number.isNaN(ms)) {
                showToast("Pick a valid date/time", "error");
                return;
              }
              try {
                appendScheduleCallReminder({
                  chatId: open.chat.id,
                  chatName: open.chat.name,
                  title: title.trim() || "Group call",
                  at: ms,
                });
              } catch {
                /* localStorage unavailable */
              }
              onSaved();
              showToast(
                `Reminder set for ${new Date(ms).toLocaleString()}`,
                "success",
              );
              onClose();
            }}
          >
            Save reminder
          </button>
        </div>
      </div>
    </div>
  );
}
