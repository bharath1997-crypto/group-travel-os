"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THOUGHT_EMOJIS,
  clearMyThought,
  readMyThought,
  saveMyThought,
  thoughtPreview,
} from "@/lib/lounge/connect-thought";
import type { LoungeStatus } from "@/lib/lounge/stickers";

type DropThoughtControlProps = {
  userId: string;
  userName: string;
  showToast: (m: string, t?: "success" | "error") => void;
};

export function DropThoughtControl({
  userId,
  userName,
  showToast,
}: DropThoughtControlProps) {
  const [thought, setThought] = useState<LoungeStatus | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [emoji, setEmoji] = useState<string>(THOUGHT_EMOJIS[0]);

  const refresh = useCallback(() => {
    setThought(readMyThought(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCompose = () => {
    const current = readMyThought(userId);
    setThought(current);
    setDraft(current?.text ?? "");
    setEmoji(current?.text ? pickEmoji(current.text) : THOUGHT_EMOJIS[0]);
    setComposing(true);
  };

  const save = () => {
    let text = draft.trim();
    if (!text) {
      showToast("Write a thought first", "error");
      return;
    }
    const startsWithEmoji = THOUGHT_EMOJIS.some((e) => text.startsWith(e));
    if (!startsWithEmoji) {
      text = `${emoji} ${text}`;
    }
    const saved = saveMyThought(userId, userName, text);
    setThought(saved);
    setComposing(false);
    showToast("Thought saved");
  };

  const remove = () => {
    clearMyThought(userId);
    setThought(null);
    setDraft("");
    setComposing(false);
    showToast("Thought cleared");
  };

  if (composing) {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
        <div className="flex flex-wrap gap-1">
          {THOUGHT_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Use ${e}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                emoji === e ? "bg-[#1d2939] ring-2 ring-[#1d2939]/20" : "hover:bg-black/5"
              }`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="I love my dad, planning Goa…"
          maxLength={139}
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs outline-none focus:border-[#0F766E]"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setComposing(false)}
            className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-[#6b7280]"
          >
            Cancel
          </button>
          {thought ? (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-red-600"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={!draft.trim()}
            className="rounded-lg bg-[#0F766E] px-3 py-1 text-[10px] font-bold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-0.5 text-xs hover:bg-black/[0.03]"
      style={{ borderColor: "#e5e7eb", color: "#374151" }}
      onClick={openCompose}
    >
      <span aria-hidden>{thought ? pickEmoji(thought.text) : "😊"}</span>
      <span className="truncate">
        {thought ? thoughtPreview(thought.text) : "Drop a thought"}
      </span>
    </button>
  );
}

function pickEmoji(text: string): string {
  const first = [...text.trim()][0];
  if (first && THOUGHT_EMOJIS.includes(first as (typeof THOUGHT_EMOJIS)[number])) {
    return first;
  }
  return "😊";
}
