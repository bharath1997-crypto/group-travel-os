"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import WayraIcon from "@/components/ui/WayraIcon";
import { apiFetchWithStatus } from "@/lib/api";
import { OPEN_WAYRA_EVENT, TOGGLE_WAYRA_EVENT, WAYRA_CLEAR_CONTEXT_EVENT, WAYRA_CONTEXT_EVENT, type OpenWayraDetail } from "@/lib/open-wayra";
import { Maximize2, MapPin, Minimize2, Minus, Plus, X } from "lucide-react";
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
  emitWayraMapFocus,
  WAYRA_PLACE_PICKED_EVENT,
  prepareLiveWayraContext,
  type WayraPlacePickedDetail,
} from "@/lib/wayra/live-map-context";
import {
  resolveWayraSourceMapFocus,
  shouldOpenWayraSourceOnLiveMap,
  type WayraSourceLink,
} from "@/lib/wayra/wayra-source-links";
import { buildFollowUpPrompts } from "@/lib/wayra/follow-up-prompts";
import {
  geolocationErrorMessage,
  geolocationUnavailableMessage,
} from "@/lib/geo";
import {
  buildWayraSessionGreeting,
  chatLocationFromPlace,
  formatWayraMessageTime,
  markWayraSessionGreeted,
  readWayraSessionGreeted,
  type WayraChatLocation,
  type WayraMessengerProfile,
  type WayraTripHint,
} from "@/lib/wayra/messenger";
import { isGenericPlaceName } from "@/lib/wayra/place-region";
import { isPreviewScopedWayraMessage } from "@/lib/wayra/preview-scope";
import {
  readLiveImmersiveChrome,
} from "@/app/(dashboard)/live/live-immersive-chrome";
import {
  LIVE_SHEET_BOTTOM_DEFAULT,
  LIVE_SHEET_BOTTOM_DESKTOP,
  LIVE_SHEET_BOTTOM_IMMERSIVE,
  LIVE_STRIP_HEIGHT_PX,
  LIVE_WAYRA_PANEL_WIDTH_CLAMP,
} from "@/app/(dashboard)/live/live-layout";

type ChatMessage =
  | { id: string; role: "user"; text: string; createdAt: number }
  | {
      id: string;
      role: "assistant";
      text: string;
      createdAt: number;
      suggestedActions?: {
        type: string;
        label: string;
        target?: string | null;
        payload?: Record<string, unknown> | null;
      }[];
      sources?: {
        label: string;
        url: string;
        source_type: string;
        snippet?: string | null;
        lat?: number | null;
        lng?: number | null;
      }[];
      followUpPrompts?: string[];
      pending?: boolean;
    }
  | { id: string; role: "system"; text: string; createdAt: number };

type AIAssistantResponseBody = {
  message: string;
  suggested_actions?: {
    type: string;
    label: string;
    target?: string | null;
    payload?: Record<string, unknown> | null;
  }[];
  sources?: {
    label: string;
    url: string;
    source_type: string;
    snippet?: string | null;
    lat?: number | null;
    lng?: number | null;
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

const OFFLINE_HELP_REPLY =
  "I'm in offline help mode right now. Ask how to plan a trip, create a group, run polls, or split expenses—I can walk you through Rovvy without the full assistant.";

const PANEL_LAYOUT_KEY = "rovvy_wayra_panel_layout";
const LIVE_FLOAT_LAYOUT_KEY = "rovvy_wayra_live_float_layout";
const LIVE_HEADER_OFFSET_PX = 56;
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

function defaultLiveExpandedBounds(): PanelBounds {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 400, height: 640 };
  }
  const { maxW } = viewportPanelLimits();
  const margin = 8;
  const top = LIVE_HEADER_OFFSET_PX + margin;
  const width = Math.min(420, maxW);
  const height = Math.max(
    PANEL_MIN_HEIGHT,
    window.innerHeight - top - LIVE_STRIP_HEIGHT_PX - margin,
  );
  const x = Math.max(PANEL_EDGE_MARGIN, window.innerWidth - width - margin);
  return clampPanelBounds({ x, y: top, width, height });
}

function loadLiveFloatBounds(): PanelBounds {
  if (typeof window === "undefined") return defaultLiveExpandedBounds();
  try {
    const raw = localStorage.getItem(LIVE_FLOAT_LAYOUT_KEY);
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
  return defaultLiveExpandedBounds();
}

function saveLiveFloatBounds(bounds: PanelBounds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIVE_FLOAT_LAYOUT_KEY, JSON.stringify(bounds));
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
  const savedScrollTopRef = useRef(0);
  const prevLivePlacePinRef = useRef<string | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingAutoSendRef = useRef<string | null>(null);
  const pendingTapBriefRef = useRef<string | null>(null);
  const lastTapBriefPinRef = useRef<string | null>(null);
  const tapBriefShownPinRef = useRef<string | null>(null);
  const panelInteractionRef = useRef<
    | {
        kind: "move";
        startX: number;
        startY: number;
        origin: PanelBounds;
        boundsMode: "default" | "live";
      }
    | {
        kind: "resize";
        handle: ResizeHandle;
        startX: number;
        startY: number;
        origin: PanelBounds;
        boundsMode: "default" | "live";
      }
    | null
  >(null);
  const [liveContext, setLiveContext] = useState<Record<string, unknown>>({});
  const [liveChromeActive, setLiveChromeActive] = useState(false);
  const [isDesktopLive, setIsDesktopLive] = useState(false);

  const mergedContext = useMemo(
    () => ({ ...(context ?? {}), ...liveContext }),
    [context, liveContext],
  );

  const [panelBounds, setPanelBounds] = useState<PanelBounds>(() => loadPanelBounds());
  const [livePanelExpanded, setLivePanelExpanded] = useState(false);
  const [liveFloatBounds, setLiveFloatBounds] = useState<PanelBounds>(() =>
    loadLiveFloatBounds(),
  );
  const [isPanelInteracting, setIsPanelInteracting] = useState(false);
  const isWidePanel = panelBounds.width >= 560;
  const [attachedLocation, setAttachedLocation] = useState<WayraChatLocation | null>(
    null,
  );
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [messengerProfile, setMessengerProfile] = useState<WayraMessengerProfile | null>(
    null,
  );
  const greetingQueuedRef = useRef(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

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
    const interaction = panelInteractionRef.current;
    panelInteractionRef.current = null;
    setIsPanelInteracting(false);
    if (!interaction) return;
    if (interaction.boundsMode === "live") {
      setLiveFloatBounds((current) => {
        const clamped = clampPanelBounds(current);
        saveLiveFloatBounds(clamped);
        return clamped;
      });
      return;
    }
    setPanelBounds((current) => {
      const clamped = clampPanelBounds(current);
      savePanelBounds(clamped);
      return clamped;
    });
  }, []);

  const onPanelHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, boundsMode: "default" | "live") => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      const origin = boundsMode === "live" ? liveFloatBounds : panelBounds;
      panelInteractionRef.current = {
        kind: "move",
        startX: e.clientX,
        startY: e.clientY,
        origin,
        boundsMode,
      };
      setIsPanelInteracting(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [liveFloatBounds, panelBounds],
  );

  const onPanelHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const interaction = panelInteractionRef.current;
      if (!interaction || interaction.kind !== "move") return;
      const dx = e.clientX - interaction.startX;
      const dy = e.clientY - interaction.startY;
      const next = clampPanelBounds({
        ...interaction.origin,
        x: interaction.origin.x + dx,
        y: interaction.origin.y + dy,
      });
      if (interaction.boundsMode === "live") {
        setLiveFloatBounds(next);
      } else {
        setPanelBounds(next);
      }
    },
    [],
  );

  const onResizePointerDown = useCallback(
    (
      handle: ResizeHandle,
      e: React.PointerEvent<HTMLDivElement>,
      boundsMode: "default" | "live",
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const origin = boundsMode === "live" ? liveFloatBounds : panelBounds;
      panelInteractionRef.current = {
        kind: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origin,
        boundsMode,
      };
      setIsPanelInteracting(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [liveFloatBounds, panelBounds],
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const interaction = panelInteractionRef.current;
    if (!interaction || interaction.kind !== "resize") return;
    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;
    const next = applyResize(interaction.origin, interaction.handle, dx, dy);
    if (interaction.boundsMode === "live") {
      setLiveFloatBounds(next);
    } else {
      setPanelBounds(next);
    }
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

  const toggleLivePanelExpand = useCallback(() => {
    setLivePanelExpanded((expanded) => {
      if (expanded) return false;
      setLiveFloatBounds((current) => {
        const next = clampPanelBounds(
          current.height >= 400 ? current : defaultLiveExpandedBounds(),
        );
        saveLiveFloatBounds(next);
        return next;
      });
      return true;
    });
  }, []);

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
    if (!isOpen) {
      if (messagesScrollRef.current) {
        savedScrollTopRef.current = messagesScrollRef.current.scrollTop;
      }
      prevMessageCountRef.current = messages.length;
      return;
    }
    requestAnimationFrame(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTop = savedScrollTopRef.current;
      }
    });
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (messages.length > prevMessageCountRef.current) {
      scrollToEnd();
    }
    prevMessageCountRef.current = messages.length;
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
    const onLive = pathname === "/live" || pathname.startsWith("/live/");
    if (!onLive) return;
    const place = extractLiveSelectedPlace(liveContext as Record<string, unknown>);
    if (!place) {
      prevLivePlacePinRef.current = null;
      return;
    }
    const pinKey = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
    if (prevLivePlacePinRef.current && prevLivePlacePinRef.current !== pinKey) {
      const label =
        place.name && !isGenericPlaceName(place.name)
          ? place.name.trim()
          : "this location";
      lastTapBriefPinRef.current = null;
      tapBriefShownPinRef.current = null;
      pendingTapBriefRef.current = null;
      setMessages((current) => [
        ...current.map((row) =>
          row.role === "assistant"
            ? {
                ...row,
                followUpPrompts: undefined,
                sources: undefined,
                suggestedActions: undefined,
              }
            : row,
        ),
        {
          id: newId(),
          role: "system",
          text: `Switched to ${label}`,
          createdAt: Date.now(),
        },
      ]);
    }
    prevLivePlacePinRef.current = pinKey;
  }, [pathname, liveContext]);

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
    const onClearContext = () => {
      setLiveContext({});
      setAttachedLocation(null);
      lastTapBriefPinRef.current = null;
      tapBriefShownPinRef.current = null;
      pendingTapBriefRef.current = null;
      setMessages((current) =>
        current.filter(
          (row) =>
            row.role !== "assistant" || !isPreviewScopedWayraMessage(row.text),
        ),
      );
    };
    window.addEventListener(OPEN_WAYRA_EVENT, onOpen as EventListener);
    window.addEventListener(TOGGLE_WAYRA_EVENT, onToggle);
    window.addEventListener(WAYRA_CONTEXT_EVENT, onContext as EventListener);
    window.addEventListener(WAYRA_CLEAR_CONTEXT_EVENT, onClearContext);
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
      window.removeEventListener(WAYRA_CLEAR_CONTEXT_EVENT, onClearContext);
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

  const handleWayraSourceClick = useCallback(
    (source: WayraSourceLink, event: React.MouseEvent<HTMLAnchorElement>) => {
      const ctx = { ...(mergedContext as Record<string, unknown>), pathname };
      const onLive = isLivePage(page, ctx);
      if (!shouldOpenWayraSourceOnLiveMap(source, onLive)) return;

      const focus = resolveWayraSourceMapFocus(source);
      if (!focus) return;

      event.preventDefault();
      emitWayraMapFocus({
        lat: focus.lat,
        lng: focus.lng,
        name: focus.name,
        zoom: 16,
        showPreview: true,
      });
      showActionHint("Showing on Live map");
    },
    [mergedContext, page, pathname, showActionHint],
  );

  const pushTapBrief = useCallback((brief: string, pinKey: string) => {
    pendingTapBriefRef.current = null;
    tapBriefShownPinRef.current = pinKey;
    setMessages((m) => {
      if (m.some((row) => row.role === "assistant" && row.text === brief)) return m;
      const place = extractLiveSelectedPlace(liveContext as Record<string, unknown>);
      const placeName =
        place?.name && !isGenericPlaceName(place.name) ? place.name.trim() : null;
      return [
        ...m,
        {
          id: newId(),
          role: "assistant",
          text: brief,
          createdAt: Date.now(),
          followUpPrompts: buildFollowUpPrompts({
            placeName,
            onLive: true,
          }),
        },
      ];
    });
  }, [liveContext]);

  const replaceTapBrief = useCallback((brief: string) => {
    setMessages((m) => {
      let replaced = false;
      const place = extractLiveSelectedPlace(liveContext as Record<string, unknown>);
      const placeName =
        place?.name && !isGenericPlaceName(place.name) ? place.name.trim() : null;
      const followUpPrompts = buildFollowUpPrompts({ placeName, onLive: true });
      const next = m.map((row) => {
        if (
          !replaced &&
          row.role === "assistant" &&
          row.text.startsWith("You picked") &&
          row.text.includes("on the Live map at")
        ) {
          replaced = true;
          if (row.text === brief) return { ...row, followUpPrompts };
          return { ...row, text: brief, followUpPrompts };
        }
        return row;
      });
      return replaced ? next : m;
    });
  }, [liveContext]);

  const buildAssistantRow = useCallback(
    (
      text: string,
      opts?: {
        userMessage?: string | null;
        suggestedActions?: Extract<ChatMessage, { role: "assistant" }>["suggestedActions"];
        sources?: Extract<ChatMessage, { role: "assistant" }>["sources"];
      },
    ): Extract<ChatMessage, { role: "assistant" }> => {
      const ctx = mergedContext as Record<string, unknown>;
      const place = extractLiveSelectedPlace(ctx);
      const placeName =
        place?.name && !isGenericPlaceName(place.name) ? place.name.trim() : null;
      return {
        id: newId(),
        role: "assistant",
        text,
        createdAt: Date.now(),
        suggestedActions: opts?.suggestedActions,
        sources: opts?.sources,
        followUpPrompts: buildFollowUpPrompts({
          lastUserMessage: opts?.userMessage ?? null,
          placeName,
          onLive: isLivePage(page, ctx),
          exclude: opts?.userMessage ? [opts.userMessage] : [],
        }),
      };
    },
    [mergedContext, page],
  );

  const commitAssistantRow = useCallback(
    (row: Extract<ChatMessage, { role: "assistant" }>) => {
      const pendingId = pendingAssistantIdRef.current;
      pendingAssistantIdRef.current = null;
      setMessages((m) => {
        if (pendingId && m.some((r) => r.id === pendingId)) {
          return m.map((r) => (r.id === pendingId ? row : r));
        }
        return [...m, row];
      });
    },
    [],
  );

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

      const userRow: ChatMessage = {
        id: newId(),
        role: "user",
        text: userMessage,
        createdAt: Date.now(),
      };
      const systemRow: ChatMessage | null = modeChanged
        ? {
            id: newId(),
            role: "system",
            text:
              bird === "flying"
                ? "✦ Wayra · travel guide"
                : "✦ Wayra · app guide",
            createdAt: Date.now(),
          }
        : null;

      setInput("");
      setMessages((m) => [...m, userRow, ...(systemRow ? [systemRow] : [])]);

      const ctx = mergedContext as Record<string, unknown>;
      const wayraMode = classifyMode(userMessage);

      const liveMapReply = resolveLiveMapContextReply(userMessage, page, ctx);
      if (liveMapReply) {
        setMessages((m) => [...m, buildAssistantRow(liveMapReply, { userMessage })]);
        return;
      }

      // Fast path: App Guide how-tos only (on Live, trip-prep questions go to the LLM).
      const onLivePage = isLivePage(page, ctx);
      const allowAppGuideFastPath =
        wayraMode === "app_guide" && (!onLivePage || isAppHowToQuestion(userMessage));

      if (allowAppGuideFastPath) {
        const instant = resolveAppGuideReply(userMessage);
        if (instant) {
          setMessages((m) => [...m, buildAssistantRow(instant, { userMessage })]);
          return;
        }
      }

      setLoading(true);
      const pendingId = newId();
      pendingAssistantIdRef.current = pendingId;
      setMessages((m) => [
        ...m,
        {
          id: pendingId,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          pending: true,
        },
      ]);

      const messengerCtx: Record<string, unknown> = { ...ctx };
      if (attachedLocation) {
        messengerCtx.chatAttachedLocation = attachedLocation;
      }
      if (messengerProfile?.full_name) {
        messengerCtx.messengerProfile = messengerProfile;
      }

      const apiContext = await prepareLiveWayraContext(page, messengerCtx);

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
          commitAssistantRow(
            buildAssistantRow(
              `${fallback}\n\n— Sign in for personalized AI responses from Wayra.`,
              { userMessage },
            ),
          );
          return;
        }

        if (status === 408) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          commitAssistantRow(
            buildAssistantRow(
              `${fallback}\n\n— The assistant took too long; this is an offline summary.`,
              { userMessage },
            ),
          );
          return;
        }

        if (status < 200 || status >= 300 || !data) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
          return;
        }

        if (!data.message || typeof data.message !== "string") {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
          return;
        }

        commitAssistantRow(
          buildAssistantRow(data.message, {
            userMessage,
            suggestedActions: data.suggested_actions?.map((a) => ({
              type: a.type,
              label: a.label,
              target: a.target,
              payload: a.payload,
            })),
            sources: data.sources?.map((s) => ({
              label: s.label,
              url: s.url,
              source_type: s.source_type,
              snippet: s.snippet,
              lat: s.lat,
              lng: s.lng,
            })),
          }),
        );
      } catch {
        const fallback = appendAssistantFallback(
          userMessage,
          page,
          activeTab,
          ctx,
        );
        commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
      } finally {
        pendingAssistantIdRef.current = null;
        setLoading(false);
      }
    },
    [
      activeTab,
      attachedLocation,
      buildAssistantRow,
      commitAssistantRow,
      mergedContext,
      messengerProfile,
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
  const isLiveFloating = isLiveRoute && livePanelExpanded;
  const isLiveDocked =
    isLiveRoute && isOpen && !isLiveFloating && isDesktopLive;
  const liveBoundsMode: "default" | "live" = isLiveFloating ? "live" : "default";

  useEffect(() => {
    if (!isLiveRoute) {
      setLivePanelExpanded(false);
      return;
    }
    const sync = () => setLiveChromeActive(readLiveImmersiveChrome().active);
    sync();
    window.addEventListener("rovvy-live-chrome", sync);
    return () => window.removeEventListener("rovvy-live-chrome", sync);
  }, [isLiveRoute]);

  useEffect(() => {
    if (!isLiveRoute || typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktopLive(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [isLiveRoute]);

  const livePanelBottom = isDesktopLive
    ? LIVE_SHEET_BOTTOM_DESKTOP
    : liveChromeActive
      ? LIVE_SHEET_BOTTOM_IMMERSIVE
      : LIVE_SHEET_BOTTOM_DEFAULT;

  const activeLivePin = useMemo(
    () =>
      isLiveRoute
        ? extractLiveSelectedPlace(liveContext as Record<string, unknown>)
        : null,
    [isLiveRoute, liveContext],
  );

  const loadMessengerProfile = useCallback(async (): Promise<WayraMessengerProfile> => {
    if (messengerProfile) return messengerProfile;

    const profile: WayraMessengerProfile = {};
    try {
      const [meRes, ctxRes] = await Promise.all([
        apiFetchWithStatus<{ full_name?: string | null }>("/auth/me", {}, 8000),
        apiFetchWithStatus<{
          full_name?: string | null;
          trips?: Array<{
            title: string;
            description?: string | null;
            destination?: string | null;
            start_date?: string | null;
            end_date?: string | null;
            status?: string | null;
          }>;
        }>("/wayra/context", {}, 8000),
      ]);

      if (meRes.status >= 200 && meRes.status < 300 && meRes.data?.full_name) {
        profile.full_name = meRes.data.full_name;
      }
      if (ctxRes.status >= 200 && ctxRes.status < 300 && ctxRes.data) {
        profile.full_name = ctxRes.data.full_name ?? profile.full_name;
        profile.trips = (ctxRes.data.trips ?? []).map(
          (trip): WayraTripHint => ({
            title: trip.title,
            destination: trip.destination ?? trip.description ?? null,
            start_date: trip.start_date,
            end_date: trip.end_date,
            status: trip.status,
          }),
        );
      }
    } catch {
      /* guest or offline — generic greeting still works */
    }

    setMessengerProfile(profile);
    return profile;
  }, [messengerProfile]);

  const insertSessionGreeting = useCallback(async () => {
    if (readWayraSessionGreeted() || greetingQueuedRef.current) return;
    greetingQueuedRef.current = true;

    const profile = await loadMessengerProfile();
    const place = extractLiveSelectedPlace(mergedContext as Record<string, unknown>);
    const placeLabel =
      place?.name && !isGenericPlaceName(place.name)
        ? place.name.trim()
        : attachedLocation?.label ?? null;

    const greeting = buildWayraSessionGreeting({
      fullName: profile.full_name,
      trips: profile.trips,
      placeLabel,
      onLive: isLiveRoute,
    });

    markWayraSessionGreeted();
    setMessages((current) => {
      if (current.length > 0) return current;
      return [
        {
          id: newId(),
          role: "assistant",
          text: greeting,
          createdAt: Date.now(),
          followUpPrompts: buildFollowUpPrompts({
            placeName: placeLabel,
            onLive: isLiveRoute,
          }),
        },
      ];
    });
  }, [attachedLocation, isLiveRoute, loadMessengerProfile, mergedContext]);

  useEffect(() => {
    if (!isOpen) return;
    void insertSessionGreeting();
  }, [isOpen, insertSessionGreeting]);

  useEffect(() => {
    if (!isLiveRoute) return;
    const place = extractLiveSelectedPlace(liveContext as Record<string, unknown>);
    if (!place) {
      setAttachedLocation(null);
      return;
    }
    setAttachedLocation(chatLocationFromPlace(place));
  }, [isLiveRoute, liveContext]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!attachMenuRef.current?.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [attachMenuOpen]);

  const attachMapPinLocation = useCallback(() => {
    const place = extractLiveSelectedPlace(mergedContext as Record<string, unknown>);
    if (!place) {
      showActionHint("Pick a place on the map first, or use My GPS.");
      setAttachMenuOpen(false);
      return;
    }
    setAttachedLocation(chatLocationFromPlace(place));
    setAttachMenuOpen(false);
    showActionHint("Location attached from map pin.");
  }, [mergedContext, showActionHint]);

  const attachGpsLocation = useCallback(() => {
    const blocked = geolocationUnavailableMessage();
    if (blocked) {
      showActionHint(blocked);
      setAttachMenuOpen(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAttachedLocation({
          label: "My location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
        });
        setAttachMenuOpen(false);
        showActionHint("Your GPS location is attached.");
      },
      (err) => {
        showActionHint(geolocationErrorMessage(err));
        setAttachMenuOpen(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  }, [showActionHint]);

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
        style={
          isLiveFloating
            ? {
                left: liveFloatBounds.x,
                top: liveFloatBounds.y,
                width: liveFloatBounds.width,
                height: liveFloatBounds.height,
              }
            : isLiveDocked
              ? {
                  right: 0,
                  left: "auto",
                  top: "var(--rovvy-header-h, 56px)",
                  bottom: `${LIVE_STRIP_HEIGHT_PX}px`,
                  width: LIVE_WAYRA_PANEL_WIDTH_CLAMP,
                  minWidth: "18rem",
                  maxWidth: "min(32rem, 38vw)",
                  height: "auto",
                  maxHeight: "none",
                }
            : isLiveRoute
              ? {
                  right: 8,
                  bottom: livePanelBottom,
                  left: "auto",
                  top: "auto",
                  width: `min(${LIVE_WAYRA_PANEL_WIDTH_CLAMP}, calc(100vw - 16px))`,
                  minWidth: "18rem",
                  maxWidth: "min(32rem, 38vw)",
                  height: "auto",
                  maxHeight: `calc(100dvh - ${livePanelBottom} - 3rem)`,
                }
              : {
                  left: panelBounds.x,
                  top: panelBounds.y,
                  width: panelBounds.width,
                  height: panelBounds.height,
                }
        }
        className={`pointer-events-auto fixed z-[2999] flex flex-col overflow-hidden border border-[#E9ECEF] bg-[#F8F9FA] shadow-2xl ${
          isLiveDocked ? "rounded-none rounded-l-2xl border-r-0" : "rounded-2xl"
        } ${
          isPanelInteracting ? "" : "transition-all duration-300 ease-in-out"
        } ${className} ${
          isOpen
            ? "opacity-100 scale-100"
            : "pointer-events-none scale-[0.98] opacity-0"
        } ${isLiveRoute && !isLiveFloating && !isLiveDocked ? "rounded-b-none border-b-0" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-title`}
      >
        {RESIZE_HANDLES.filter(
          (handle) =>
            !isLiveRoute ||
            isLiveFloating ||
            (isLiveDocked && (handle.id === "n" || handle.id === "w" || handle.id === "nw")) ||
            (!isLiveDocked && (handle.id === "n" || handle.id === "ne" || handle.id === "nw")),
        ).map((handle) => (
              <div
                key={handle.id}
                role="separator"
                aria-orientation={
                  handle.id === "n" || handle.id === "s" ? "horizontal" : "vertical"
                }
                aria-label={handle.title}
                title={handle.title}
                className={`absolute z-20 touch-none ${handle.className}`}
                onPointerDown={(e) => onResizePointerDown(handle.id, e, liveBoundsMode)}
                onPointerMove={onResizePointerMove}
                onPointerUp={finishPanelInteraction}
                onPointerCancel={finishPanelInteraction}
              />
            ))}

        <div
          className={`flex items-start justify-between gap-2 border-b border-[#E9ECEF] bg-white px-3.5 py-2 ${
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing"
          }`}
          onPointerDown={
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? undefined
              : (e) => onPanelHeaderPointerDown(e, liveBoundsMode)
          }
          onPointerMove={
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? undefined
              : onPanelHeaderPointerMove
          }
          onPointerUp={
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? undefined
              : finishPanelInteraction
          }
          onPointerCancel={
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? undefined
              : finishPanelInteraction
          }
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
              onClick={isLiveRoute ? toggleLivePanelExpand : toggleWidePanel}
              className="hidden sm:inline-flex rounded-lg p-1.5 text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#2C3E50] focus:outline-none"
              title={
                isLiveRoute
                  ? isLiveFloating
                    ? "Dock to bottom"
                    : "Expand full height"
                  : isWidePanel
                    ? "Restore normal width"
                    : "Expand width"
              }
              aria-label={
                isLiveRoute
                  ? isLiveFloating
                    ? "Dock to bottom"
                    : "Expand full height"
                  : isWidePanel
                    ? "Restore normal width"
                    : "Expand width"
              }
            >
              {isLiveRoute ? (
                isLiveFloating ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )
              ) : isWidePanel ? (
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

        <div
          ref={messagesScrollRef}
          className={`space-y-2.5 overflow-y-auto bg-[#F8F9FA] px-3 py-2 ${
            isLiveRoute && !isLiveFloating && !isLiveDocked
              ? "max-h-[min(50vh,420px)] shrink-0"
              : "min-h-0 flex-1"
          }`}
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
                    <p className="mt-0.5 text-right text-[9px] text-[#6C757D]">
                      {formatWayraMessageTime(m.createdAt)}
                    </p>
                  </div>
                ) : (
                  <div className="mr-auto max-w-[90%]">
                    {"pending" in m && m.pending ? (
                      <div
                        className="rounded-2xl rounded-bl-md border border-[#E9ECEF] bg-white px-2.5 py-2 text-[11.5px] text-[#6C757D]"
                        aria-live="polite"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
                            aria-hidden
                          />
                          Wayra is thinking…
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl rounded-bl-md border border-[#E9ECEF] bg-white px-2.5 py-1.5 text-[11.5px] leading-normal whitespace-pre-wrap text-[#2C3E50]">
                          {m.text}
                        </div>
                        <p className="mt-0.5 text-[9px] text-[#6C757D]">
                          {formatWayraMessageTime(m.createdAt)}
                        </p>
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
                        {m.sources && m.sources.length > 0 ? (
                          <div className="mt-2">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#6C757D]">
                              Sources
                            </p>
                            <div className="flex flex-col gap-1">
                              {m.sources.map((s) => (
                                <a
                                  key={`${s.url}-${s.label}`}
                                  href={s.url}
                                  target={s.url.startsWith("/") ? undefined : "_blank"}
                                  rel={
                                    s.url.startsWith("/")
                                      ? undefined
                                      : "noopener noreferrer"
                                  }
                                  onClick={(event) => handleWayraSourceClick(s, event)}
                                  className="text-[10px] text-[#0F3460] underline decoration-[#0F3460]/30 hover:decoration-[#0F3460]"
                                >
                                  {s.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {m.followUpPrompts && m.followUpPrompts.length > 0 ? (
                          <div className="mt-2">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#6C757D]">
                              Ask next
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.followUpPrompts.map((q) => (
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
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {actionHint ? (
          <div className="shrink-0 border-t border-[#E9ECEF] bg-[#F0F4F8] px-3 py-1 text-center text-[10px] text-[#2C3E50]">
            {actionHint}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-[#E9ECEF] bg-white p-2.5">
          {attachedLocation ? (
            <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-[#0F766E]/20 bg-[#0F766E]/5 px-2 py-1">
              <MapPin className="h-3 w-3 shrink-0 text-[#0F766E]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#2C3E50]">
                {attachedLocation.label}
              </span>
              <button
                type="button"
                onClick={() => setAttachedLocation(null)}
                className="rounded p-0.5 text-[#6C757D] hover:bg-white hover:text-[#2C3E50]"
                aria-label="Remove attached location"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="relative shrink-0 self-end" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setAttachMenuOpen((open) => !open)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] text-[#6C757D] hover:border-[#0F766E]/30 hover:text-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#E94560]/30"
                title="Attach location"
                aria-label="Attach location"
                aria-expanded={attachMenuOpen}
              >
                <Plus className="h-4 w-4" />
              </button>
              {attachMenuOpen ? (
                <div className="absolute bottom-full left-0 z-30 mb-1 min-w-[168px] overflow-hidden rounded-xl border border-[#E9ECEF] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={attachMapPinLocation}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#2C3E50] hover:bg-[#F8F9FA]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#0F766E]" />
                    Map pin
                  </button>
                  <button
                    type="button"
                    onClick={attachGpsLocation}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#2C3E50] hover:bg-[#F8F9FA]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#E94560]" />
                    My GPS
                  </button>
                </div>
              ) : null}
            </div>
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
