"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import WayraIcon from "@/components/ui/WayraIcon";
import { apiFetchWithStatus } from "@/lib/api";
import { OPEN_WAYRA_EVENT, TOGGLE_WAYRA_EVENT, WAYRA_CONTEXT_EVENT, type OpenWayraDetail } from "@/lib/open-wayra";
import { Maximize2, Minimize2, Minus } from "lucide-react";
import {
  classifyMode,
  detectBirdState,
  extractLiveSelectedPlace,
  isAppHowToQuestion,
  isLivePage,
  localAssistantReply,
  resolveAppGuideReply,
  resolveLiveMapContextReply,
} from "@/lib/wayra/intent";
import {
  buildLiveMapTapBrief,
  liveQuickPromptsForPlace,
  WAYRA_PLACE_PICKED_EVENT,
  prepareLiveWayraContext,
  type WayraPlacePickedDetail,
} from "@/lib/wayra/live-map-context";
import { isGenericPlaceName } from "@/lib/wayra/place-region";

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

const PANEL_LAYOUT_KEY = "rovvy_wayra_panel_layout";
const PANEL_MIN_WIDTH = 280;
const PANEL_MIN_HEIGHT = 320;
const PANEL_EDGE_MARGIN = 16;

type PanelBounds = { x: number; y: number; width: number; height: number };
type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function viewportPanelLimits() {
  if (typeof window === "undefined") {
    return { maxW: 600, maxH: 720 };
  }
  return {
    maxW: window.innerWidth - PANEL_EDGE_MARGIN * 2,
    maxH: window.innerHeight - PANEL_EDGE_MARGIN * 2,
  };
}

function defaultPanelBounds(): PanelBounds {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 380, height: 520 };
  }
  const { maxW, maxH } = viewportPanelLimits();
  const width = Math.min(380, maxW);
  const height = Math.min(520, Math.round(window.innerHeight * 0.85), maxH);
  return {
    x: Math.max(PANEL_EDGE_MARGIN, window.innerWidth - width - 24),
    y: Math.max(PANEL_EDGE_MARGIN, window.innerHeight - height - 96),
    width,
    height,
  };
}

function clampPanelBounds(bounds: PanelBounds): PanelBounds {
  if (typeof window === "undefined") return bounds;
  const { maxW, maxH } = viewportPanelLimits();
  const width = Math.min(Math.max(bounds.width, PANEL_MIN_WIDTH), maxW);
  const height = Math.min(Math.max(bounds.height, PANEL_MIN_HEIGHT), maxH);
  const x = Math.min(
    Math.max(bounds.x, PANEL_EDGE_MARGIN),
    window.innerWidth - width - PANEL_EDGE_MARGIN,
  );
  const y = Math.min(
    Math.max(bounds.y, PANEL_EDGE_MARGIN),
    window.innerHeight - height - PANEL_EDGE_MARGIN,
  );
  return { x, y, width, height };
}

function loadPanelBounds(): PanelBounds {
  if (typeof window === "undefined") return defaultPanelBounds();
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelBounds>;
      if (
        typeof parsed.x === "number" &&
        typeof parsed.y === "number" &&
        typeof parsed.width === "number" &&
        typeof parsed.height === "number"
      ) {
        return clampPanelBounds(parsed as PanelBounds);
      }
    }
  } catch {
    /* ignore corrupt layout */
  }
  return defaultPanelBounds();
}

function savePanelBounds(bounds: PanelBounds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(bounds));
}

function applyResize(
  start: PanelBounds,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): PanelBounds {
  let { x, y, width, height } = start;

  if (handle.includes("e")) width += dx;
  if (handle.includes("w")) {
    width -= dx;
    x += dx;
  }
  if (handle.includes("s")) height += dy;
  if (handle.includes("n")) {
    height -= dy;
    y += dy;
  }

  return clampPanelBounds({ x, y, width, height });
}

const RESIZE_HANDLES: { id: ResizeHandle; className: string; title: string }[] = [
  { id: "n", className: "left-3 right-3 top-0 h-2 cursor-ns-resize", title: "Resize top" },
  { id: "s", className: "left-3 right-3 bottom-0 h-2 cursor-ns-resize", title: "Resize bottom" },
  { id: "e", className: "right-0 top-3 bottom-3 w-2 cursor-ew-resize", title: "Resize right" },
  { id: "w", className: "left-0 top-3 bottom-3 w-2 cursor-ew-resize", title: "Resize left" },
  { id: "nw", className: "left-0 top-0 h-4 w-4 cursor-nwse-resize", title: "Resize top-left" },
  { id: "ne", className: "right-0 top-0 h-4 w-4 cursor-nesw-resize", title: "Resize top-right" },
  { id: "sw", className: "left-0 bottom-0 h-4 w-4 cursor-nesw-resize", title: "Resize bottom-left" },
  { id: "se", className: "right-0 bottom-0 h-4 w-4 cursor-nwse-resize", title: "Resize bottom-right" },
];

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
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingAutoSendRef = useRef<string | null>(null);
  const pendingTapBriefRef = useRef<string | null>(null);
  const lastTapBriefPinRef = useRef<string | null>(null);
  const tapBriefShownPinRef = useRef<string | null>(null);
  const panelInteractionRef = useRef<
    | { kind: "move"; startX: number; startY: number; origin: PanelBounds }
    | { kind: "resize"; handle: ResizeHandle; startX: number; startY: number; origin: PanelBounds }
    | null
  >(null);
  const [liveContext, setLiveContext] = useState<Record<string, unknown>>({});

  const mergedContext = useMemo(
    () => ({ ...(context ?? {}), ...liveContext }),
    [context, liveContext],
  );

  const [panelBounds, setPanelBounds] = useState<PanelBounds>(() => loadPanelBounds());
  const [isPanelInteracting, setIsPanelInteracting] = useState(false);
  const isWidePanel = panelBounds.width >= 560;

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

  const finishPanelInteraction = useCallback(() => {
    panelInteractionRef.current = null;
    setIsPanelInteracting(false);
    setPanelBounds((current) => {
      const clamped = clampPanelBounds(current);
      savePanelBounds(clamped);
      return clamped;
    });
  }, []);

  const onPanelHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      panelInteractionRef.current = {
        kind: "move",
        startX: e.clientX,
        startY: e.clientY,
        origin: panelBounds,
      };
      setIsPanelInteracting(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelBounds],
  );

  const onPanelHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const interaction = panelInteractionRef.current;
      if (!interaction || interaction.kind !== "move") return;
      const dx = e.clientX - interaction.startX;
      const dy = e.clientY - interaction.startY;
      setPanelBounds(
        clampPanelBounds({
          ...interaction.origin,
          x: interaction.origin.x + dx,
          y: interaction.origin.y + dy,
        }),
      );
    },
    [],
  );

  const onResizePointerDown = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      panelInteractionRef.current = {
        kind: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origin: panelBounds,
      };
      setIsPanelInteracting(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [panelBounds],
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const interaction = panelInteractionRef.current;
    if (!interaction || interaction.kind !== "resize") return;
    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;
    setPanelBounds(applyResize(interaction.origin, interaction.handle, dx, dy));
  }, []);

  const toggleWidePanel = useCallback(() => {
    setPanelBounds((current) => {
      const { maxW, maxH } = viewportPanelLimits();
      const next = clampPanelBounds({
        ...current,
        width: isWidePanel ? Math.min(380, maxW) : Math.min(600, maxW),
        height: isWidePanel ? current.height : Math.min(780, Math.round(window.innerHeight * 0.92), maxH),
      });
      savePanelBounds(next);
      return next;
    });
  }, [isWidePanel]);

  useEffect(() => {
    const onResize = () => {
      setPanelBounds((current) => clampPanelBounds(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      if (!p) return;
      if (ce.detail?.autoSend) {
        pendingAutoSendRef.current = p;
      } else {
        setInput(p);
      }
    };
    const onToggle = () => {
      setIsOpen((prev) => !prev);
    };
    const onContext = (e: Event) => {
      const ce = e as CustomEvent<Record<string, unknown> | undefined>;
      if (ce.detail && typeof ce.detail === "object") {
        setLiveContext(ce.detail);
      }
    };
    window.addEventListener(OPEN_WAYRA_EVENT, onOpen as EventListener);
    window.addEventListener(TOGGLE_WAYRA_EVENT, onToggle);
    window.addEventListener(WAYRA_CONTEXT_EVENT, onContext as EventListener);
    const onPlacePicked = (e: Event) => {
      const ce = e as CustomEvent<WayraPlacePickedDetail | undefined>;
      const detail = ce.detail;
      if (!detail) return;
      const pinKey = `${detail.lat.toFixed(5)},${detail.lng.toFixed(5)}`;
      if (lastTapBriefPinRef.current === pinKey) return;
      lastTapBriefPinRef.current = pinKey;

      const briefCtx: Record<string, unknown> = {
        pathname: "/live",
        selectedPlace: {
          name: detail.name ?? null,
          lat: detail.lat,
          lng: detail.lng,
        },
      };
      const brief = buildLiveMapTapBrief(briefCtx);
      pendingTapBriefRef.current = brief;
      if (ce.detail?.autoOpen) setIsOpen(true);
    };
    window.addEventListener(WAYRA_PLACE_PICKED_EVENT, onPlacePicked as EventListener);
    return () => {
      window.removeEventListener(OPEN_WAYRA_EVENT, onOpen as EventListener);
      window.removeEventListener(TOGGLE_WAYRA_EVENT, onToggle);
      window.removeEventListener(WAYRA_CONTEXT_EVENT, onContext as EventListener);
      window.removeEventListener(WAYRA_PLACE_PICKED_EVENT, onPlacePicked as EventListener);
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

  const pushTapBrief = useCallback((brief: string, pinKey: string) => {
    pendingTapBriefRef.current = null;
    tapBriefShownPinRef.current = pinKey;
    setMessages((m) => {
      if (m.some((row) => row.role === "assistant" && row.text === brief)) return m;
      return [...m, { id: newId(), role: "assistant", text: brief }];
    });
  }, []);

  const replaceTapBrief = useCallback((brief: string) => {
    setMessages((m) => {
      let replaced = false;
      const next = m.map((row) => {
        if (
          !replaced &&
          row.role === "assistant" &&
          row.text.startsWith("You picked") &&
          row.text.includes("on the Live map at")
        ) {
          replaced = true;
          if (row.text === brief) return row;
          return { ...row, text: brief };
        }
        return row;
      });
      return replaced ? next : m;
    });
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

      const ctx = mergedContext as Record<string, unknown>;
      const wayraMode = classifyMode(userMessage);

      const liveMapReply = resolveLiveMapContextReply(userMessage, page, ctx);
      if (liveMapReply) {
        setMessages((m) => [
          ...m,
          { id: newId(), role: "assistant", text: liveMapReply },
        ]);
        return;
      }

      // Fast path: App Guide how-tos only (on Live, trip-prep questions go to the LLM).
      const onLivePage = isLivePage(page, ctx);
      const allowAppGuideFastPath =
        wayraMode === "app_guide" && (!onLivePage || isAppHowToQuestion(userMessage));

      if (allowAppGuideFastPath) {
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

      const apiContext = await prepareLiveWayraContext(page, ctx);

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
              context: apiContext,
            }),
          },
          60_000,
        );

        if (status === 401) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          setMessages((m) => [
            ...m,
            {
              id: newId(),
              role: "assistant",
              text: `${fallback}\n\n— Sign in for personalized AI responses from Wayra.`,
            },
          ]);
          return;
        }

        if (status === 408) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          setMessages((m) => [
            ...m,
            {
              id: newId(),
              role: "assistant",
              text: `${fallback}\n\n— The assistant took too long; this is an offline summary.`,
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
      mergedContext,
      groupId,
      input,
      loading,
      page,
      tripId,
    ],
  );

  useEffect(() => {
    if (!isOpen) return;

    const ctx = liveContext as Record<string, unknown>;
    const place = extractLiveSelectedPlace(ctx);
    const pinKey = lastTapBriefPinRef.current;
    if (!pinKey) {
      if (pendingTapBriefRef.current) {
        pushTapBrief(pendingTapBriefRef.current, "unknown");
      }
      return;
    }

    if (place) {
      const activePinKey = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
      if (activePinKey === pinKey) {
        const brief = buildLiveMapTapBrief(ctx);
        pendingTapBriefRef.current = brief;
        const enriched =
          !isGenericPlaceName(place.name) ||
          Boolean(place.city?.trim() || place.country?.trim());

        if (tapBriefShownPinRef.current === pinKey) {
          if (enriched) replaceTapBrief(brief);
          return;
        }

        if (enriched) {
          pushTapBrief(brief, pinKey);
          return;
        }
      }
    }

    if (pendingTapBriefRef.current && tapBriefShownPinRef.current !== pinKey) {
      pushTapBrief(pendingTapBriefRef.current, pinKey);
    }
  }, [isOpen, liveContext, pushTapBrief, replaceTapBrief]);

  useEffect(() => {
    if (!isOpen || !lastTapBriefPinRef.current) return;
    const pinKey = lastTapBriefPinRef.current;
    const timer = window.setTimeout(() => {
      if (tapBriefShownPinRef.current === pinKey || !pendingTapBriefRef.current) return;
      pushTapBrief(pendingTapBriefRef.current, pinKey);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isOpen, liveContext, pushTapBrief]);

  useEffect(() => {
    if (!isOpen || !pendingAutoSendRef.current) return;
    const msg = pendingAutoSendRef.current;
    pendingAutoSendRef.current = null;
    void sendMessage(msg);
  }, [isOpen, sendMessage]);

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

  const isLiveRoute = pathname === "/live" || pathname.startsWith("/live/");

  const activeLivePin = useMemo(
    () =>
      isLiveRoute
        ? extractLiveSelectedPlace(liveContext as Record<string, unknown>)
        : null,
    [isLiveRoute, liveContext],
  );

  const quickPrompts = useMemo(() => {
    if (isLiveRoute || page === "live") {
      return liveQuickPromptsForPlace(activeLivePin?.name);
    }
    return QUICK_PROMPTS_BY_PAGE[page] ?? QUICK_PROMPTS_DEFAULT;
  }, [page, isLiveRoute, activeLivePin?.name]);

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

  return (
    <>
      {/* Wayra launcher hidden on Live — opened via LiveWayraLaunchButton */}
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
      <div
        id={panelId}
        ref={panelRef}
        style={{
          left: panelBounds.x,
          top: panelBounds.y,
          width: panelBounds.width,
          height: panelBounds.height,
        }}
        className={`pointer-events-auto fixed z-[2999] flex flex-col overflow-hidden rounded-2xl border border-[#E9ECEF] bg-[#F8F9FA] shadow-2xl ${
          isPanelInteracting ? "" : "transition-all duration-300 ease-in-out"
        } ${className} ${
          isOpen
            ? "opacity-100 scale-100"
            : "pointer-events-none scale-[0.98] opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-title`}
      >
        {RESIZE_HANDLES.map((handle) => (
              <div
                key={handle.id}
                role="separator"
                aria-orientation={
                  handle.id === "n" || handle.id === "s" ? "horizontal" : "vertical"
                }
                aria-label={handle.title}
                title={handle.title}
                className={`absolute z-20 touch-none ${handle.className}`}
                onPointerDown={(e) => onResizePointerDown(handle.id, e)}
                onPointerMove={onResizePointerMove}
                onPointerUp={finishPanelInteraction}
                onPointerCancel={finishPanelInteraction}
              />
            ))}

        <div
          className="flex cursor-grab items-start justify-between gap-2 border-b border-[#E9ECEF] bg-white px-3.5 py-2 active:cursor-grabbing"
          onPointerDown={onPanelHeaderPointerDown}
          onPointerMove={onPanelHeaderPointerMove}
          onPointerUp={finishPanelInteraction}
          onPointerCancel={finishPanelInteraction}
        >
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
                className="text-xs font-bold text-[#0F3460] sm:text-sm"
              >
                Wayra
              </h2>
              <p
                className={
                  birdState === "flying"
                    ? "text-[9px] text-[#E94560]"
                    : "text-[9px] text-[#0F3460]"
                }
              >
                {headerStatus}
                {activeLivePin ? (
                  <span className="block truncate text-[8px] font-normal text-[#6C757D]">
                    Pin: {activeLivePin.name?.trim() || "Dropped pin"}
                  </span>
                ) : null}
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
              onClick={toggleWidePanel}
              className="hidden sm:inline-flex rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none"
              title={isWidePanel ? "Restore normal width" : "Expand width"}
              aria-label={isWidePanel ? "Restore normal width" : "Expand width"}
            >
              {isWidePanel ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
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

        <div className="shrink-0 space-y-1.5 border-b border-[#E9ECEF] bg-white px-3 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6C757D]">
            Quick prompts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                disabled={loading}
                className="max-w-full rounded-full border border-[#E9ECEF] bg-[#F8F9FA] px-2 py-0.5 text-left text-[10px] text-[#2C3E50] hover:border-[#E94560]/40 focus:outline-none focus:ring-2 focus:ring-[#E94560]/30 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#F8F9FA] px-3 py-2"
          role="log"
        >
          {messages.length === 0 ? (
            <p className="rounded-xl border border-[#E9ECEF] bg-white p-2.5 text-[11px] leading-normal text-[#2C3E50]">
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
                  className="py-0.5 text-center text-[9px] text-[#6C757D]"
                >
                  {m.text}
                </p>
              );
            }
            return (
              <div key={m.id} className="flex w-full">
                {m.role === "user" ? (
                  <div className="ml-auto max-w-[90%]">
                    <div className="rounded-2xl rounded-br-md bg-[#E94560]/12 px-2.5 py-1.5 text-[11.5px] leading-normal text-[#2C3E50]">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div className="mr-auto max-w-[90%]">
                    <div className="rounded-2xl rounded-bl-md border border-[#E9ECEF] bg-white px-2.5 py-1.5 text-[11.5px] leading-normal whitespace-pre-wrap text-[#2C3E50]">
                      {m.text}
                    </div>
                    {m.suggestedActions && m.suggestedActions.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.suggestedActions.map((a, i) => (
                          <button
                            key={`${a.type}-${a.label}-${i}`}
                            type="button"
                            onClick={() =>
                              onActionPill(a.type, a.label, a.target)
                            }
                            className="rounded-full border border-[#0F3460]/20 bg-white px-2 py-0.5 text-[10px] text-[#0F3460] hover:bg-[#0F3460] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
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
              className="flex items-center gap-2 text-[11px] text-[#6C757D]"
              aria-live="polite"
            >
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
                aria-hidden
              />
              Wayra is thinking…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {actionHint ? (
          <div className="shrink-0 border-t border-[#E9ECEF] bg-[#F0F4F8] px-3 py-1 text-center text-[10px] text-[#2C3E50]">
            {actionHint}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-[#E9ECEF] bg-white p-2.5">
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
              rows={1}
              placeholder="Ask Wayra…"
              className="min-h-[34px] flex-1 resize-y rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] px-2.5 py-1.5 text-xs text-[#2C3E50] placeholder:text-[#6C757D] focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className="h-fit shrink-0 self-end rounded-xl bg-[#E94560] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#E94560]/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );


}
