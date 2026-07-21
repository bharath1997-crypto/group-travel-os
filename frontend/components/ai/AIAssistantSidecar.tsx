"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import WayraIcon from "@/components/ui/WayraIcon";
import { apiFetchWithStatus } from "@/lib/api";
import { OPEN_WAYRA_EVENT, TOGGLE_WAYRA_EVENT, type OpenWayraDetail } from "@/lib/open-wayra";
import { Maximize2, Minimize2, Minus, Square } from "lucide-react";
import {
  classifyMode,
  detectBirdState,
  localAssistantReply,
  resolveAppGuideReply,
} from "@/lib/wayra/intent";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      suggestedActions?: {
        type: string;
        label: string;
        target?: string | null;
        payload?: Record<string, unknown> | null;
      }[];
    }
  | { id: string; role: "system"; text: string };

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

const QUICK_PROMPTS_DEFAULT = [
  "Explain this page",
  "What should I do next?",
  "Help me finish this",
];

const QUICK_PROMPTS_BY_PAGE: Record<string, string[]> = {
  dashboard: [
    "What should I do first on Rovvy?",
    "How do I create a group?",
  ],
};

const OFFLINE_HELP_REPLY =
  "I'm in offline help mode right now. Ask how to plan a trip, create a group, run polls, or split expenses—I can walk you through Rovvy without the full assistant.";

function appendAssistantFallback(
  userMessage: string,
  page: string,
  activeTab: string | undefined,
  ctx: Record<string, unknown>,
): string {
  return (
    localAssistantReply(userMessage, page, activeTab, ctx) ?? OFFLINE_HELP_REPLY
  );
}

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
  const pathname = usePathname() ?? "";
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [birdState, setBirdState] = useState<"flying" | "perched">("perched");
  const prevModeRef = useRef<"flying" | "perched">("perched");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [size, setSize] = useState<"normal" | "expanded" | "fullscreen">("normal");

  const sizeClasses = useMemo(() => {
    switch (size) {
      case "expanded":
        return "bottom-[96px] right-6 h-[min(720px,90vh)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-[560px] sm:max-w-[560px]";
      case "fullscreen":
        return "inset-4 sm:inset-6 h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] w-[calc(100vw-2rem)] sm:w-[calc(100vw-3rem)] max-w-full";
      case "normal":
      default:
        return "bottom-[96px] right-6 h-[min(520px,85vh)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-[380px] sm:max-w-[380px]";
    }
  }, [size]);

  // DRAGGABLE POSITION FOR THE FLOATING LOGO (remembered in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rovvy_ai_btn_pos");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback to default
        }
      }
    }
    return { x: -1, y: -1 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragStartCoords = useRef({ x: 0, y: 0 });
  const touchStartCoords = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Only drag on left-click
    setIsDragging(true);
    dragStartCoords.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    touchStartCoords.current = { x: touch.clientX, y: touch.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      const btnSize = 56; // size of the button
      newX = Math.max(16, Math.min(newX, window.innerWidth - btnSize - 16));
      newY = Math.max(16, Math.min(newY, window.innerHeight - btnSize - 16));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      const dist = Math.sqrt(
        Math.pow(e.clientX - dragStartCoords.current.x, 2) +
        Math.pow(e.clientY - dragStartCoords.current.y, 2)
      );
      if (dist < 6) {
        setIsOpen((prev) => !prev);
      }
      if (position.x !== -1) {
        localStorage.setItem("rovvy_ai_btn_pos", JSON.stringify(position));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      let newX = touch.clientX - dragStart.x;
      let newY = touch.clientY - dragStart.y;

      const btnSize = 56;
      newX = Math.max(16, Math.min(newX, window.innerWidth - btnSize - 16));
      newY = Math.max(16, Math.min(newY, window.innerHeight - btnSize - 16));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      setIsDragging(false);
      const touch = e.changedTouches[0];
      if (touch) {
        const dist = Math.sqrt(
          Math.pow(touch.clientX - touchStartCoords.current.x, 2) +
          Math.pow(touch.clientY - touchStartCoords.current.y, 2)
        );
        if (dist < 6) {
          setIsOpen((prev) => !prev);
        }
      }
      if (position.x !== -1) {
        localStorage.setItem("rovvy_ai_btn_pos", JSON.stringify(position));
      }
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dragStart, position]);

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

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenWayraDetail | undefined>;
      setIsOpen(true);
      const p = ce.detail?.prompt?.trim();
      if (p) setInput(p);
    };
    const onToggle = () => {
      setIsOpen((prev) => !prev);
    };
    window.addEventListener(OPEN_WAYRA_EVENT, onOpen as EventListener);
    window.addEventListener(TOGGLE_WAYRA_EVENT, onToggle);
    return () => {
      window.removeEventListener(OPEN_WAYRA_EVENT, onOpen as EventListener);
      window.removeEventListener(TOGGLE_WAYRA_EVENT, onToggle);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rovvy:wayra-state", { detail: { isOpen } })
      );
    }
  }, [isOpen]);

  const showActionHint = useCallback((msg: string) => {
    setActionHint(msg);
    window.setTimeout(() => setActionHint(null), 4000);
  }, []);

  const sendMessage = useCallback(
    async (override?: string) => {
      const userMessage = (override ?? input).trim();
      if (!userMessage || loading) return;

      const bird = detectBirdState(userMessage);
      const modeChanged = bird !== prevModeRef.current;
      if (modeChanged) {
        prevModeRef.current = bird;
      }
      setBirdState(bird);

      const userRow: ChatMessage = { id: newId(), role: "user", text: userMessage };
      const systemRow: ChatMessage | null = modeChanged
        ? {
            id: newId(),
            role: "system",
            text:
              bird === "flying"
                ? "✦ Wayra · travel guide"
                : "✦ Wayra · app guide",
          }
        : null;

      setInput("");
      setMessages((m) => [...m, userRow, ...(systemRow ? [systemRow] : [])]);

      const ctx = (context ?? {}) as Record<string, unknown>;
      const wayraMode = classifyMode(userMessage);

      // Fast path: known App Guide intents answered locally (matches backend).
      if (wayraMode === "app_guide") {
        const instant = resolveAppGuideReply(userMessage);
        if (instant) {
          setMessages((m) => [
            ...m,
            { id: newId(), role: "assistant", text: instant },
          ]);
          return;
        }
      }

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
          setMessages((m) => [
            ...m,
            {
              id: newId(),
              role: "assistant",
              text: "Sign in to chat with Wayra and get personalized travel help.",
            },
          ]);
          return;
        }

        if (status < 200 || status >= 300 || !data) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          setMessages((m) => [
            ...m,
            { id: newId(), role: "assistant", text: fallback },
          ]);
          return;
        }

        if (!data.message || typeof data.message !== "string") {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          setMessages((m) => [
            ...m,
            { id: newId(), role: "assistant", text: fallback },
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
        const fallback = appendAssistantFallback(
          userMessage,
          page,
          activeTab,
          ctx,
        );
        setMessages((m) => [
          ...m,
          { id: newId(), role: "assistant", text: fallback },
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

  const pageLabel = page.replace(/_/g, "/").replace(/^/, "/");

  const quickPrompts = useMemo(
    () => QUICK_PROMPTS_BY_PAGE[page] ?? QUICK_PROMPTS_DEFAULT,
    [page],
  );

  const headerStatus =
    birdState === "flying"
      ? loading
        ? "AI Travel Guide · thinking..."
        : "AI Travel Guide"
      : "App Guide · online";

  const isExplorerRoute =
    pathname.startsWith("/explore/events") ||
    pathname.startsWith("/explore/shorts") ||
    pathname.startsWith("/activities") ||
    pathname.startsWith("/weather");
  if (isExplorerRoute) {
    return null;
  }

  const isLiveRoute = pathname === "/live" || pathname.startsWith("/live/");

  return (
    <>
      {/* ALWAYS VISIBLE DRAGGABLE LOGO BUTTON — hidden on Live (opened via map More menu) */}
      {!isLiveRoute ? (
      <div
        style={
          position.x === -1 || position.y === -1
            ? {
                position: "fixed",
                bottom: "96px",
                right: "24px",
                zIndex: 50,
              }
            : {
                position: "fixed",
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 50,
              }
        }
        className={`pointer-events-auto flex items-center justify-center select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="group flex h-14 w-14 items-center justify-center rounded-full border border-[#E9ECEF] bg-white shadow-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
          aria-label={isOpen ? "Close Wayra" : "Open Wayra"}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <WayraIcon state={birdState} size={0.9} variant="raw" animate={true} />
        </button>
      </div>
      ) : null}

      {/* FLOATABLE ASSISTANT PANEL */}
      {isOpen ? (
        <div
          id={panelId}
          className={`pointer-events-auto fixed z-[2999] flex flex-col overflow-hidden rounded-2xl border border-[#E9ECEF] bg-[#F8F9FA] shadow-2xl transition-all duration-300 ease-in-out ${sizeClasses}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#E9ECEF] bg-white px-4 py-3">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <WayraIcon
                state={birdState}
                size={0.42}
                variant={birdState === "flying" ? "fog" : "navy"}
                animate={true}
              />
              <div className="min-w-0">
                <h2
                  id={`${panelId}-title`}
                  className="text-sm font-bold text-[#0F3460] sm:text-base"
                >
                  Wayra
                </h2>
                <p
                  className={
                    birdState === "flying"
                      ? "text-[10px] text-[#E94560]"
                      : "text-[10px] text-[#0F3460]"
                  }
                >
                  {headerStatus}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {/* Minimize/Off-screen Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none"
                title="Minimize assistant (off-screen)"
                aria-label="Minimize Wayra"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              {/* Expand / Restore Button */}
              <button
                type="button"
                onClick={() => setSize(size === "expanded" ? "normal" : "expanded")}
                className="hidden sm:inline-flex rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none"
                title={size === "expanded" ? "Restore normal width" : "Expand width"}
                aria-label={size === "expanded" ? "Restore normal width" : "Expand width"}
              >
                {size === "expanded" ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setSize(size === "fullscreen" ? "normal" : "fullscreen")}
                className="rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none"
                title={size === "fullscreen" ? "Exit fullscreen" : "Make fullscreen"}
                aria-label={size === "fullscreen" ? "Exit fullscreen" : "Make fullscreen"}
              >
                {size === "fullscreen" ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
                aria-label="Close Wayra"
              >
                <span className="text-lg leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-b border-[#E9ECEF] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6C757D]">
              Quick prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q) => (
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
              <p className="rounded-xl border border-[#E9ECEF] bg-white p-3 text-[13px] leading-relaxed text-[#2C3E50]">
                Hi — I&apos;m <strong>Wayra</strong>. Ask how{" "}
                <strong>{pageLabel}</strong> works, or get destination ideas. App
                how-tos work offline; travel tips need the assistant when it&apos;s up.
              </p>
            ) : null}

            {messages.map((m) => {
              if (m.role === "system") {
                return (
                  <p
                    key={m.id}
                    className="py-1 text-center text-[10px] text-[#6C757D]"
                  >
                    {m.text}
                  </p>
                );
              }
              return (
                <div key={m.id} className="flex w-full">
                  {m.role === "user" ? (
                    <div className="ml-auto max-w-[90%]">
                      <div className="rounded-2xl rounded-br-md bg-[#E94560]/12 px-3.5 py-2 text-[13px] leading-relaxed text-[#2C3E50]">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className="mr-auto max-w-[90%]">
                      <div className="rounded-2xl rounded-bl-md border border-[#E9ECEF] bg-white px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-[#2C3E50]">
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
              );
            })}
            {loading ? (
              <div
                className="flex items-center gap-2 text-xs text-[#6C757D]"
                aria-live="polite"
              >
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
                  aria-hidden
                />
                Wayra is thinking…
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
                placeholder="Ask Wayra…"
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
    </>
  );


}
