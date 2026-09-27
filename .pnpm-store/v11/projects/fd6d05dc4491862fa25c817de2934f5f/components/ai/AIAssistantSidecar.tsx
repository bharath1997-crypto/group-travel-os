"use client";

/**
 * Global Wayra — one launcher, one panel template, every tab.
 * Host pages keep their own layout; Wayra never gets a per-tab skin or embedded feed.
 * Context (page, GPS, pin) is passed to the API silently — not a separate Wayra UI per route.
 */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import { WayraLauncherButton } from "@/components/ui/WayraIcon";
import { apiFetchWithStatus } from "@/lib/safe-fetch";
import { OPEN_WAYRA_EVENT, TOGGLE_WAYRA_EVENT, WAYRA_CLEAR_CONTEXT_EVENT, WAYRA_CONTEXT_EVENT, type OpenWayraDetail } from "@/lib/open-wayra";
import { ArrowRight, ArrowUpRight, Bookmark, Link2, Mic, Minimize2, Sparkles, Users, Utensils, Volume2, VolumeX, X } from "lucide-react";
import { WayraAgentDock } from "@/components/ai/WayraAgentDock";
import { WayraAssistantMessage } from "@/components/ai/WayraAssistantMessage";
import { WayraLiveWire } from "@/components/ai/WayraLiveWire";
import { cancelWayraSpeech, speakWayraText } from "@/lib/wayra/wayra-speech";
import { useWayraVoice } from "@/lib/wayra/use-wayra-voice";
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
  markWayraSessionGreeted,
  readWayraSessionGreeted,
  type WayraChatLocation,
  type WayraMessengerProfile,
  type WayraTripHint,
} from "@/lib/wayra/messenger";
import { isGenericPlaceName } from "@/lib/wayra/place-region";
import {
  extractLivePinKey,
  isLivePreviewPinContext,
  withoutLivePinMessages,
} from "@/lib/wayra/live-pin-session";
import {
  LIVE_WAYRA_PANEL_WIDTH,
  LIVE_WAYRA_SHEET_RIGHT,
} from "@/app/(dashboard)/live/live-design-tokens";
import {
  WAYRA_COMPOSER_BOX,
  WAYRA_COMPOSER_ROW,
  WAYRA_FOOTER,
  WAYRA_HEADER,
  WAYRA_HEADER_BODY,
  WAYRA_HEADER_BTN,
  WAYRA_HEADLINE,
  WAYRA_HINT,
  WAYRA_ICON_BTN,
  WAYRA_ICON_BTN_ACTIVE,
  WAYRA_INPUT,
  WAYRA_MESSAGES,
  WAYRA_PANEL_BASE,
  WAYRA_PANEL_DOCKED,
  WAYRA_PIN_BADGE,
  WAYRA_SEND_BTN,
  WAYRA_STATUS,
  WAYRA_SUBHEAD,
  WAYRA_SYSTEM_MSG,
  WAYRA_TITLE,
  WAYRA_TRY_CHIP,
  WAYRA_TRY_CHIP_MUTED,
  WAYRA_TRY_LABEL,
  WAYRA_USER_BUBBLE,
} from "@/lib/wayra/wayra-chat-tokens";
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
  | { id: string; role: "user"; text: string; createdAt: number; livePinKey?: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      createdAt: number;
      livePinKey?: string;
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
  | { id: string; role: "system"; text: string; createdAt: number; livePinKey?: string };

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

const WAYRA_TRY_ONE: { label: string; muted?: boolean; icon: "utensils" | "users" | "bookmark" | "link" }[] = [
  { label: "Dinner for six on Saturday, under $70 each", icon: "utensils" },
  { label: "Where is everyone right now?", icon: "users" },
  { label: "Something from my saves, walkable from here", icon: "bookmark" },
  { label: "Paste a reel or article link and I'll pull the place out of it.", icon: "link", muted: true },
];

const OFFLINE_HELP_REPLY =
  "I'm in offline help mode right now. Ask how to plan a trip, create a group, run polls, or split expenses—I can walk you through Rovvy without the full assistant.";

const PANEL_LAYOUT_KEY = "rovvy_wayra_chrome_layout";
const WAYRA_INPUT_MODE_KEY = "rovvy_wayra_input_mode";
const WAYRA_SPEAKER_KEY = "rovvy_wayra_speaker_on";
const WAYRA_FAB_POS_KEY = "rovvy_ai_btn_pos";
const WAYRA_FAB_SIZE_PX = 56;

type WayraInputMode = "text" | "voice";
const LIVE_FLOAT_LAYOUT_KEY = "rovvy_wayra_live_float_layout";
const LIVE_HEADER_OFFSET_PX = 56;
const PANEL_MIN_WIDTH = 280;
const PANEL_MIN_HEIGHT = 320;
const PANEL_EDGE_MARGIN = 16;

type PanelBounds = { x: number; y: number; width: number; height: number };
type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function fabAnchorStyle(position: { x: number; y: number }): CSSProperties {
  if (position.x === -1 || position.y === -1) {
    return {
      position: "fixed",
      bottom: "var(--wayra-fab-bottom, 24px)",
      right: "20px",
      zIndex: 3000,
    };
  }
  return {
    position: "fixed",
    left: `clamp(16px, ${position.x}px, calc(100vw - ${WAYRA_FAB_SIZE_PX + 16}px))`,
    top: `clamp(16px, ${position.y}px, calc(100dvh - var(--wayra-fab-bottom, 24px) - ${WAYRA_FAB_SIZE_PX}px))`,
    zIndex: 3000,
  };
}

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
    return { x: 0, y: 0, width: 400, height: 640 };
  }
  const { maxW, maxH } = viewportPanelLimits();
  const width = Math.min(400, maxW);
  const height = Math.min(640, Math.round(window.innerHeight * 0.86), maxH);
  return {
    x: Math.max(PANEL_EDGE_MARGIN, window.innerWidth - width - 20),
    y: Math.max(PANEL_EDGE_MARGIN, window.innerHeight - height - 24),
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastSpokenReply, setLastSpokenReply] = useState<string | null>(null);
  const [birdState, setBirdState] = useState<"flying" | "perched">("perched");
  const prevModeRef = useRef<"flying" | "perched">("perched");
  const [input, setInput] = useState("");
  const [wayraInputMode, setWayraInputMode] = useState<WayraInputMode>("text");
  const [speakerOn, setSpeakerOn] = useState(true);
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
  const startTalkRef = useRef<() => void>(() => undefined);

  // DRAGGABLE POSITION FOR THE FLOATING LOGO (remembered in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WAYRA_FAB_POS_KEY);
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
  const positionRef = useRef(position);
  positionRef.current = position;

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
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(WAYRA_INPUT_MODE_KEY);
    if (saved === "voice" || saved === "text") {
      setWayraInputMode(saved);
    }
    const speaker = sessionStorage.getItem(WAYRA_SPEAKER_KEY);
    if (speaker === "off") setSpeakerOn(false);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      const next = !on;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(WAYRA_SPEAKER_KEY, next ? "on" : "off");
      }
      if (!next) cancelWayraSpeech();
      return next;
    });
  }, []);

  const setWayraInputModePersisted = useCallback((mode: WayraInputMode) => {
    setWayraInputMode(mode);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(WAYRA_INPUT_MODE_KEY, mode);
    }
    if (mode === "text") {
      cancelWayraSpeech();
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      const btnSize = WAYRA_FAB_SIZE_PX;
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
        startTalkRef.current();
      }
      const next = positionRef.current;
      if (next.x !== -1) {
        localStorage.setItem(WAYRA_FAB_POS_KEY, JSON.stringify(next));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      let newX = touch.clientX - dragStart.x;
      let newY = touch.clientY - dragStart.y;

      const btnSize = WAYRA_FAB_SIZE_PX;
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
          startTalkRef.current();
        }
      }
      const next = positionRef.current;
      if (next.x !== -1) {
        localStorage.setItem(WAYRA_FAB_POS_KEY, JSON.stringify(next));
      }
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dragStart]);

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
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setIsMinimized(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    const onLive = pathname === "/live" || pathname.startsWith("/live/");
    if (!onLive) {
      prevLivePlacePinRef.current = null;
      return;
    }

    const pinKey = extractLivePinKey(liveContext as Record<string, unknown>);

    const resetTapBriefRefs = () => {
      lastTapBriefPinRef.current = null;
      tapBriefShownPinRef.current = null;
      pendingTapBriefRef.current = null;
    };

    if (!pinKey) {
      if (prevLivePlacePinRef.current) {
        setMessages((current) => withoutLivePinMessages(current));
        resetTapBriefRefs();
        prevLivePlacePinRef.current = null;
      }
      return;
    }

    if (prevLivePlacePinRef.current && prevLivePlacePinRef.current !== pinKey) {
      setMessages((current) => withoutLivePinMessages(current));
      resetTapBriefRefs();
    }

    prevLivePlacePinRef.current = pinKey;
  }, [pathname, liveContext]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenWayraDetail | undefined>;
      setIsMinimized(false);
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
      setIsMinimized(false);
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
      prevLivePlacePinRef.current = null;
      setMessages((current) => withoutLivePinMessages(current));
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
      if (ce.detail?.autoOpen) {
        setIsMinimized(false);
        setIsOpen(true);
      }
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
      // Do not inject a pin card once the user is already chatting about this place.
      if (m.some((row) => row.role === "user")) return m;
      const place = extractLiveSelectedPlace(liveContext as Record<string, unknown>);
      const placeName =
        place?.name && !isGenericPlaceName(place.name) ? place.name.trim() : null;
      const livePinKey =
        pinKey !== "unknown" ? pinKey : extractLivePinKey(liveContext as Record<string, unknown>);
      return [
        ...m,
        {
          id: newId(),
          role: "assistant",
          text: brief,
          createdAt: Date.now(),
          ...(livePinKey ? { livePinKey } : {}),
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
      const tapIdx = m.findIndex(
        (row) =>
          row.role === "assistant" &&
          row.text.startsWith("You picked") &&
          row.text.includes("on the Live map at"),
      );
      if (tapIdx >= 0 && m.slice(tapIdx + 1).some((row) => row.role === "user")) {
        return m;
      }
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
      const livePinKey = extractLivePinKey(ctx);
      return {
        id: newId(),
        role: "assistant",
        text,
        createdAt: Date.now(),
        ...(livePinKey ? { livePinKey } : {}),
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

  type SendMessageOptions = { voiceMode?: boolean };

  const sendMessage = useCallback(
    async (override?: string, opts?: SendMessageOptions): Promise<string | null> => {
      const userMessage = (override ?? input).trim();
      if (!userMessage || loading) return null;

      const useVoiceApi =
        opts?.voiceMode === true || wayraInputMode === "voice";
      const finishReply = (reply: string | null): string | null => {
        if (reply?.trim()) {
          setLastSpokenReply(reply.trim());
        }
        if (reply && wayraInputMode === "voice" && opts?.voiceMode !== true && speakerOn) {
          speakWayraText(reply);
        }
        return reply;
      };

      const bird = detectBirdState(userMessage);
      const modeChanged = bird !== prevModeRef.current;
      if (modeChanged) {
        prevModeRef.current = bird;
      }
      setBirdState(bird);

      const ctx = mergedContext as Record<string, unknown>;
      const livePinKey = extractLivePinKey(ctx);
      const withLivePin = <T extends ChatMessage>(row: T): T =>
        livePinKey ? { ...row, livePinKey } : row;

      const userRow: ChatMessage = withLivePin({
        id: newId(),
        role: "user",
        text: userMessage,
        createdAt: Date.now(),
      });
      const systemRow: ChatMessage | null = modeChanged
        ? withLivePin({
            id: newId(),
            role: "system",
            text:
              bird === "flying"
                ? "✦ Wayra · travel guide"
                : "✦ Wayra · app guide",
            createdAt: Date.now(),
          })
        : null;

      setInput("");
      setMessages((m) => [...m, userRow, ...(systemRow ? [systemRow] : [])]);

      const wayraMode = classifyMode(userMessage);

      const liveMapReply = resolveLiveMapContextReply(userMessage, page, ctx);
      if (liveMapReply) {
        setMessages((m) => [...m, buildAssistantRow(liveMapReply, { userMessage })]);
        return finishReply(liveMapReply);
      }

      // Fast path: App Guide how-tos only (on Live, trip-prep questions go to the LLM).
      const onLivePage = isLivePage(page, ctx);
      const allowAppGuideFastPath =
        wayraMode === "app_guide" && (!onLivePage || isAppHowToQuestion(userMessage));

      if (allowAppGuideFastPath) {
        const instant = resolveAppGuideReply(userMessage);
        if (instant) {
          setMessages((m) => [...m, buildAssistantRow(instant, { userMessage })]);
          return finishReply(instant);
        }
      }

      setLoading(true);
      const pendingId = newId();
      pendingAssistantIdRef.current = pendingId;
      setMessages((m) => [
        ...m,
        withLivePin({
          id: pendingId,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          pending: true,
        }),
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
              voice_mode: useVoiceApi,
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
          const reply = `${fallback}\n\n— Sign in for personalized AI responses from Wayra.`;
          commitAssistantRow(buildAssistantRow(reply, { userMessage }));
          return finishReply(reply);
        }

        if (status === 408) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          const reply = `${fallback}\n\n— The assistant took too long; this is an offline summary.`;
          commitAssistantRow(buildAssistantRow(reply, { userMessage }));
          return finishReply(reply);
        }

        if (status < 200 || status >= 300 || !data) {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
          return finishReply(fallback);
        }

        if (!data.message || typeof data.message !== "string") {
          const fallback = appendAssistantFallback(
            userMessage,
            page,
            activeTab,
            ctx,
          );
          commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
          return finishReply(fallback);
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
        return finishReply(data.message);
      } catch {
        const fallback = appendAssistantFallback(
          userMessage,
          page,
          activeTab,
          ctx,
        );
        commitAssistantRow(buildAssistantRow(fallback, { userMessage }));
        return finishReply(fallback);
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
      wayraInputMode,
      speakerOn,
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

  const isLiveRoute = pathname === "/live" || pathname.startsWith("/live/");

  const askWayraVoice = useCallback(
    (transcript: string) => sendMessage(transcript, { voiceMode: true }),
    [sendMessage],
  );

  const wayraVoice = useWayraVoice({
    ask: askWayraVoice,
    enabled: true,
    speakerOn,
  });

  const restoreChat = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
    if (
      lastSpokenReply &&
      speakerOn &&
      wayraVoice.phase === "idle" &&
      wayraInputMode === "voice"
    ) {
      speakWayraText(lastSpokenReply);
    }
  }, [lastSpokenReply, speakerOn, wayraInputMode, wayraVoice.phase]);

  const minimizeChat = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(true);
  }, []);

  const closeWayra = useCallback(() => {
    wayraVoice.cancel();
    setIsOpen(false);
    setIsMinimized(false);
  }, [wayraVoice]);

  const startTalk = useCallback(() => {
    setWayraInputModePersisted("voice");
    setIsMinimized(false);
    setIsOpen(true);
    if (wayraVoice.phase === "listening") {
      wayraVoice.stopAndAnswer();
      return;
    }
    if (wayraVoice.isActive) return;
    void wayraVoice.runVoiceTurn();
  }, [setWayraInputModePersisted, wayraVoice]);
  startTalkRef.current = startTalk;

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

  const wayraPanelShellClass = `${isLiveDocked ? WAYRA_PANEL_DOCKED : WAYRA_PANEL_BASE}${
    isOpen ? " live-panel-enter" : ""
  }`;

  const wayraHeaderClass = `${WAYRA_HEADER} ${
    isLiveRoute && !isLiveFloating && !isLiveDocked
      ? "cursor-default"
      : "cursor-grab active:cursor-grabbing"
  }`;

  const activeLivePin = useMemo(
    () =>
      isLiveRoute
        ? extractLiveSelectedPlace(liveContext as Record<string, unknown>)
        : null,
    [isLiveRoute, liveContext],
  );

  const isTemporaryLivePinChat = useMemo(
    () =>
      isLiveRoute &&
      isLivePreviewPinContext(liveContext as Record<string, unknown>),
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
    const ctx = mergedContext as Record<string, unknown>;
    const place = extractLiveSelectedPlace(ctx);
    const livePinKey = extractLivePinKey(ctx);
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
          ...(livePinKey ? { livePinKey } : {}),
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

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const foundPlaces =
    lastAssistant && "sources" in lastAssistant ? lastAssistant.sources?.length ?? 0 : 0;

  const headerStatus =
    wayraVoice.phase === "listening"
      ? "Listening"
      : wayraVoice.phase === "thinking" || loading
        ? "Thinking"
        : wayraVoice.phase === "speaking"
          ? "Speaking"
          : foundPlaces > 0
            ? `${foundPlaces} place${foundPlaces === 1 ? "" : "s"} found`
            : "Ready";

  return (
    <>
      {/* Wayra agent — one orb globally; compact dock keeps the spoken answer when minimized */}
      {isMinimized && !isOpen ? (
        <div style={fabAnchorStyle(position)} className="pointer-events-auto">
          <WayraAgentDock
            phase={wayraVoice.phase}
            interimTranscript={wayraVoice.interimTranscript}
            lastReply={lastSpokenReply}
            onExpand={restoreChat}
            onTalk={startTalk}
            onClose={closeWayra}
          />
        </div>
      ) : !isOpen ? (
        <div
          style={fabAnchorStyle(position)}
          className={`pointer-events-auto select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <WayraLauncherButton
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            isOpen={false}
            voicePhase={wayraVoice.phase}
            ariaControls={panelId}
          />
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
                  top: 0,
                  bottom: `${LIVE_STRIP_HEIGHT_PX}px`,
                  width: LIVE_WAYRA_PANEL_WIDTH,
                  minWidth: "18rem",
                  maxWidth: "min(32rem, 38vw)",
                  height: "auto",
                  maxHeight: "none",
                }
            : isLiveRoute
              ? isDesktopLive
                ? {
                    right: LIVE_WAYRA_SHEET_RIGHT,
                    bottom: livePanelBottom,
                    left: "auto",
                    top: "auto",
                    width: `min(${LIVE_WAYRA_PANEL_WIDTH}, calc(100vw - 6rem))`,
                    minWidth: "18rem",
                    maxWidth: "min(32rem, 38vw)",
                    height: "auto",
                    maxHeight: `calc(100dvh - ${livePanelBottom} - 1rem)`,
                  }
                : {
                    left: 0,
                    right: 0,
                    bottom: livePanelBottom,
                    top: "auto",
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    height: "auto",
                    maxHeight: `min(55dvh, calc(100dvh - ${livePanelBottom} - 0.5rem))`,
                  }
              : {
                  left: panelBounds.x,
                  top: panelBounds.y,
                  width: panelBounds.width,
                  height: panelBounds.height,
                }
        }
        className={`${wayraPanelShellClass} ${
          isPanelInteracting ? "" : "transition-all duration-300 ease-in-out"
        } ${className} ${
          isOpen
            ? "visible opacity-100 scale-100"
            : "invisible pointer-events-none scale-[0.98] opacity-0"
        } ${isLiveRoute && !isLiveFloating && !isLiveDocked && isDesktopLive ? "rounded-b-none border-b-0" : ""} ${
          isLiveRoute && !isDesktopLive && isOpen ? "rounded-t-2xl rounded-b-none border-b-0" : ""
        }`}
        aria-hidden={!isOpen}
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
          className={wayraHeaderClass}
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
          <div className={WAYRA_HEADER_BODY}>
            <button
              type="button"
              onClick={startTalk}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F3D32] text-white focus:outline-none"
              aria-label="Talk to Wayra"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 id={`${panelId}-title`} className={WAYRA_TITLE}>
                  Wayra
                </h2>
                {activeLivePin ? (
                  <span
                    className={WAYRA_PIN_BADGE}
                    title={activeLivePin.name?.trim() || "Dropped pin"}
                  >
                    {activeLivePin.name?.trim() || "Dropped pin"}
                  </span>
                ) : null}
              </div>
              <p className={WAYRA_STATUS}>
                {headerStatus}
                {isTemporaryLivePinChat ? " · pin" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={toggleSpeaker}
                className={WAYRA_HEADER_BTN}
                title={speakerOn ? "Speaker on — tap to mute Wayra" : "Speaker off — tap to hear Wayra"}
                aria-label={speakerOn ? "Turn speaker off" : "Turn speaker on"}
                aria-pressed={speakerOn}
              >
                {speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLiveRoute) toggleLivePanelExpand();
                  else toggleWidePanel();
                  if (
                    lastSpokenReply &&
                    speakerOn &&
                    wayraInputMode === "voice" &&
                    wayraVoice.phase === "idle"
                  ) {
                    speakWayraText(lastSpokenReply);
                  }
                }}
                className={WAYRA_HEADER_BTN}
                title="Expand chat"
                aria-label="Expand Wayra chat"
              >
                {isLiveRoute && isLiveFloating ? (
                  <Minimize2 className="h-4 w-4" />
                ) : isWidePanel ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={closeWayra}
                className={WAYRA_HEADER_BTN}
                aria-label="Close Wayra"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {wayraVoice.phase === "listening" ||
        wayraVoice.phase === "thinking" ||
        wayraVoice.phase === "speaking" ? (
          <WayraLiveWire
            phase={wayraVoice.phase}
            transcript={
              wayraVoice.phase === "speaking"
                ? lastSpokenReply ?? ""
                : wayraVoice.interimTranscript
            }
            onStop={() => wayraVoice.stopAndAnswer()}
          />
        ) : null}

        <div ref={messagesScrollRef} className={WAYRA_MESSAGES} role="log">
          {messages.length === 0 && wayraVoice.phase === "idle" ? (
            <div className="flex h-full flex-col justify-center pb-4">
              <h3 className={WAYRA_HEADLINE}>What should I work out?</h3>
              <p className={WAYRA_SUBHEAD}>
                Say it the way you&apos;d say it to a friend. Constraints help — people,
                budget, night.
              </p>
              <p className={`${WAYRA_TRY_LABEL} mt-8`}>Try one</p>
              <div className="space-y-2">
                {WAYRA_TRY_ONE.map((chip) => {
                  const Icon =
                    chip.icon === "utensils"
                      ? Utensils
                      : chip.icon === "users"
                        ? Users
                        : chip.icon === "bookmark"
                          ? Bookmark
                          : Link2;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        if (chip.muted) {
                          inputRef.current?.focus();
                          return;
                        }
                        void sendMessage(chip.label);
                      }}
                      className={chip.muted ? WAYRA_TRY_CHIP_MUTED : WAYRA_TRY_CHIP}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#0F3D32]" strokeWidth={1.75} />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => {
                if (m.role === "system") {
                  return (
                    <p key={m.id} className={WAYRA_SYSTEM_MSG}>
                      {m.text}
                    </p>
                  );
                }
                return (
                  <div key={m.id} className="flex w-full">
                    {m.role === "user" ? (
                      <div className="w-full">
                        <div className={WAYRA_USER_BUBBLE}>{m.text}</div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <WayraAssistantMessage
                          text={m.text}
                          createdAt={m.createdAt}
                          pending={"pending" in m ? m.pending : false}
                          suggestedActions={m.suggestedActions}
                          sources={m.sources}
                          followUpPrompts={m.followUpPrompts}
                          loading={loading}
                          onActionPill={onActionPill}
                          onSourceClick={handleWayraSourceClick}
                          onFollowUp={(q) => void sendMessage(q)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {foundPlaces > 0 ? (
                <p className={`${WAYRA_HINT} px-1`}>
                  Nothing is booked. I&apos;ll ask before anything costs money or reaches the
                  group.
                </p>
              ) : null}
              <div ref={endRef} />
            </>
          )}
        </div>

        {actionHint ? (
          <div className="shrink-0 px-4 pb-1 text-center text-[11px] text-[#6B7280]">
            {actionHint}
          </div>
        ) : null}

        <div className={WAYRA_FOOTER}>
          {wayraVoice.errorMessage ? (
            <p className="mb-2 px-1 text-[12px] leading-snug text-amber-800">
              {wayraVoice.errorMessage}
            </p>
          ) : null}
          <div className={WAYRA_COMPOSER_ROW}>
            <div className={WAYRA_COMPOSER_BOX}>
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
                placeholder="Ask, or paste a link"
                className={WAYRA_INPUT}
                disabled={loading}
              />
              <button
                type="button"
                onClick={startTalk}
                disabled={loading && !wayraVoice.isActive}
                className={
                  wayraVoice.phase === "listening" || wayraVoice.isActive
                    ? WAYRA_ICON_BTN_ACTIVE
                    : WAYRA_ICON_BTN
                }
                title="Talk to Wayra"
                aria-label="Talk to Wayra"
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className={WAYRA_SEND_BTN}
              aria-label="Send message"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );


}
