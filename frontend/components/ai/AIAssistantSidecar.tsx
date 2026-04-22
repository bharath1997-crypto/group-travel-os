"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { apiFetchWithStatus } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestedActions?: {
    type: string;
    label: string;
    target?: string | null;
    payload?: Record<string, unknown> | null;
  }[];
};

type AIAssistantResponseBody = {
  message: string;
  suggested_actions?: {
    type: string;
    label: string;
    target?: string | null;
    payload?: Record<string, unknown> | null;
  }[];
  summary?: Record<string, unknown> | null;
};

export interface AIAssistantSidecarProps {
  page: string;
  tripId?: string;
  groupId?: string;
  activeTab?: string;
  context?: Record<string, unknown>;
  className?: string;
}

const QUICK_PROMPTS = [
  "What should I do next?",
  "Explain this page",
  "Summarize my task",
  "Help me finish this",
];

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AIAssistantSidecar({
  page,
  tripId,
  groupId,
  activeTab,
  context,
  className = "",
}: AIAssistantSidecarProps) {
  const router = useRouter();
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, isOpen, scrollToEnd]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const showActionHint = useCallback((msg: string) => {
    setActionHint(msg);
    window.setTimeout(() => setActionHint(null), 4000);
  }, []);

  const sendMessage = useCallback(
    async (override?: string) => {
      const userMessage = (override ?? input).trim();
      if (!userMessage || loading) return;

      setInput("");
      setMessages((m) => [
        ...m,
        { id: newId(), role: "user", text: userMessage },
      ]);
      setLoading(true);

      try {
        const { data, status } = await apiFetchWithStatus<AIAssistantResponseBody>(
          "/ai/assistant",
          {
            method: "POST",
            body: JSON.stringify({
              page,
              user_message: userMessage,
              trip_id: tripId ?? null,
              group_id: groupId ?? null,
              active_tab: activeTab ?? null,
              context: context ?? {},
            }),
          },
        );

        if (status === 401) {
          router.push("/login");
          return;
        }

        if (status < 200 || status >= 300 || !data) {
          const inline =
            status === 404
              ? "The assistant service was not found on the server. Restart the API after registering the /ai/assistant route."
              : status === 400
                ? "The assistant is not available yet (for example, OPENAI_API_KEY may be missing on the server) or the request was rejected."
                : status >= 500
                  ? "The assistant hit a server error. Try again in a moment."
                  : "Could not reach the assistant. Check that the API is running and try again.";
          showToast(inline);
          setMessages((m) => [
            ...m,
            { id: newId(), role: "assistant", text: inline },
          ]);
          return;
        }

        if (!data.message || typeof data.message !== "string") {
          const err =
            "The assistant returned an unexpected response. Please try again.";
          showToast(err);
          setMessages((m) => [
            ...m,
            { id: newId(), role: "assistant", text: err },
          ]);
          return;
        }

        setMessages((m) => [
          ...m,
          {
            id: newId(),
            role: "assistant",
            text: data.message,
            suggestedActions: data.suggested_actions?.map((a) => ({
              type: a.type,
              label: a.label,
              target: a.target,
              payload: a.payload,
            })),
          },
        ]);
      } catch {
        const err = "Network error. Check your connection and that the API is reachable.";
        showToast(err);
        setMessages((m) => [
          ...m,
          { id: newId(), role: "assistant", text: err },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      activeTab,
      context,
      groupId,
      input,
      loading,
      page,
      router,
      showToast,
      tripId,
    ],
  );

  const onActionPill = useCallback(
    (type: string, label: string, target?: string | null) => {
      if (type === "open_tab" && target && target.trim()) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("travello-ai-open-tab", { detail: target }),
          );
        }
        showActionHint(`Suggested action: ${label}`);
        return;
      }
      showActionHint(`Suggested action: ${label} (no changes were made on your data)`);
    },
    [showActionHint],
  );

  return (
    <div
      className={`pointer-events-none fixed bottom-0 right-0 z-50 p-0 ${className}`.trim()}
    >
      <div className="pointer-events-auto flex max-w-full flex-col items-end gap-3 pr-4 pb-4 pl-2 sm:pr-5 sm:pb-5">
        {isOpen ? (
          <div
            id={panelId}
            className="relative flex h-[min(520px,85vh)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E9ECEF] bg-[#F8F9FA] shadow-xl sm:w-[380px] sm:max-w-[380px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
          >
            {toast ? (
              <div className="absolute right-2 top-2 z-10 max-w-[85%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-right text-xs text-red-800 shadow">
                {toast}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-2 border-b border-[#E9ECEF] bg-white px-4 py-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="text-2xl" aria-hidden>
                  🤖
                </span>
                <div className="min-w-0">
                  <h2
                    id={`${panelId}-title`}
                    className="text-sm font-bold text-[#0F3460] sm:text-base"
                  >
                    Travello Assistant
                  </h2>
                  <p className="text-xs text-[#6C757D]">Task help for this page</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
                aria-label="Close assistant"
              >
                <span className="text-lg leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>

            <div className="shrink-0 space-y-2 border-b border-[#E9ECEF] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6C757D]">
                Quick prompts
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    disabled={loading}
                    className="max-w-full rounded-full border border-[#E9ECEF] bg-[#F8F9FA] px-2.5 py-1 text-left text-[11px] text-[#2C3E50] hover:border-[#E94560]/40 focus:outline-none focus:ring-2 focus:ring-[#E94560]/30 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F8F9FA] px-3 py-3"
              role="log"
            >
              {messages.length === 0 ? (
                <p className="rounded-xl border border-[#E9ECEF] bg-white p-3 text-sm leading-relaxed text-[#2C3E50]">
                  Hi — I’m your Travello sidecar assistant. I can explain this page, summarize
                  what’s going on, and help you figure out the next step.
                </p>
              ) : null}

              {messages.map((m) => (
                <div key={m.id} className="flex w-full">
                  {m.role === "user" ? (
                    <div className="ml-auto max-w-[90%]">
                      <div className="rounded-2xl rounded-br-md bg-[#E94560]/12 px-3 py-2 text-sm text-[#2C3E50]">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className="mr-auto max-w-[90%]">
                      <div className="rounded-2xl rounded-bl-md border border-[#E9ECEF] bg-white px-3 py-2 text-sm text-[#2C3E50]">
                        {m.text}
                      </div>
                      {m.suggestedActions && m.suggestedActions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.suggestedActions.map((a, i) => (
                            <button
                              key={`${a.type}-${a.label}-${i}`}
                              type="button"
                              onClick={() =>
                                onActionPill(a.type, a.label, a.target)
                              }
                              className="rounded-full border border-[#0F3460]/20 bg-white px-2.5 py-1 text-[11px] text-[#0F3460] hover:bg-[#0F3460] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {loading ? (
                <div
                  className="flex items-center gap-2 text-xs text-[#6C757D]"
                  aria-live="polite"
                >
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
                    aria-hidden
                  />
                  Assistant is thinking…
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            {actionHint ? (
              <div className="shrink-0 border-t border-[#E9ECEF] bg-[#F0F4F8] px-3 py-2 text-center text-xs text-[#2C3E50]">
                {actionHint}
              </div>
            ) : null}

            <div className="shrink-0 border-t border-[#E9ECEF] bg-white p-3">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Ask for help on this page…"
                  className="min-h-[40px] flex-1 resize-y rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2 text-sm text-[#2C3E50] placeholder:text-[#6C757D] focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  className="h-fit shrink-0 self-end rounded-xl bg-[#E94560] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#E94560]/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#0F3460] text-2xl shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:ring-offset-2"
          aria-label={isOpen ? "Close Travello assistant" : "Open Travello assistant"}
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
        >
          <span aria-hidden>🤖</span>
          <span
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#0F3460] bg-[#E94560]"
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
