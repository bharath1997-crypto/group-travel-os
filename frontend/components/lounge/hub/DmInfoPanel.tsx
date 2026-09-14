"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BellOff, Calendar, Star, X } from "lucide-react";
import { readJsonLs } from "@/lib/lounge/storage";
import { GT_SCHEDULED_CALLS } from "@/lib/lounge/chat-prefs";
import {
  GI_ACTION_BG,
  GI_BG,
  GI_CARD,
  GI_CORAL,
  GI_GREEN,
  GI_MUTED,
  GI_SECTION_BORDER,
  GI_TEXT,
} from "@/lib/lounge/group-info-theme";
import { initialsFromName, listAvatarColor } from "@/lib/lounge/hub-utils";
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  ThIconChevronRight,
  ThIconMoreDots,
  ThIconPhoneHandset,
  ThIconSearch,
  ThIconVideoCam,
} from "@/components/lounge/hub/HubIcons";

type DmInfoPanelProps = {
  chatId: string;
  peerName: string;
  peerUsername: string | null;
  peerAvatarUrl: string | null;
  peerOnline: boolean | null;
  isFavorite: boolean;
  isMuted: boolean;
  onClose: () => void;
  onSearchInChat: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall: () => void;
  onClearChat: () => void;
  onBlockPeer: () => void;
  onReport: () => void;
  onToggleFavorite: () => void;
  onToggleMute: () => void;
  onViewFullProfile: () => void;
  scheduleVersion: number;
  onScheduleChanged: () => void;
};

function DmInfoPanel({
  chatId,
  peerName,
  peerUsername,
  peerAvatarUrl,
  peerOnline,
  isFavorite,
  isMuted,
  onClose,
  onSearchInChat,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onClearChat,
  onBlockPeer,
  onReport,
  onToggleFavorite,
  onToggleMute,
  onViewFullProfile,
  scheduleVersion,
  onScheduleChanged,
}: DmInfoPanelProps) {
  const [actionMoreOpen, setActionMoreOpen] = useState(false);
  const actionMoreRef = useRef<HTMLDivElement | null>(null);
  const [scheduledCalls, setScheduledCalls] = useState<
    {
      id: string;
      chatId: string;
      chatName: string;
      title: string;
      at: number;
    }[]
  >([]);

  useEffect(() => {
    if (!actionMoreOpen) return;
    const close = (e: MouseEvent) => {
      const el = actionMoreRef.current;
      if (el && !el.contains(e.target as Node)) setActionMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionMoreOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const filtered = list
        .filter((x) => x.chatId === chatId)
        .sort((a, b) => a.at - b.at);
      setScheduledCalls(filtered);
    } catch {
      setScheduledCalls([]);
    }
  }, [chatId, scheduleVersion]);

  const removeScheduledCall = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const next = list.filter((x) => x.id !== id);
      window.localStorage.setItem(
        "gt_scheduled_calls_v1",
        JSON.stringify(next),
      );
      onScheduleChanged();
    } catch {
      /* ignore */
    }
  };

  const ini = initialsFromName(peerName);
  const avBg = listAvatarColor(peerName);
  const presenceText =
    peerOnline === true
      ? "Active now"
      : peerOnline === false
        ? "Last seen recently"
        : "Last seen recently";

  const cardBase = "mb-3 rounded-[12px] p-4";
  const cardStyle: CSSProperties = {
    background: GI_CARD,
    border: `1px solid ${GI_SECTION_BORDER}`,
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{ background: GI_BG }}
    >
      <div
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto"
        style={{ background: GI_BG }}
      >
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-20 rounded p-1.5 hover:bg-black/5"
            style={{ color: GI_MUTED }}
            onClick={onClose}
            aria-label="Close contact info"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div
            className="h-[100px] w-full"
            style={{
              background: GI_ACTION_BG,
              borderBottom: `1px solid ${GI_SECTION_BORDER}`,
            }}
          />
          <div className="flex flex-col items-center px-4 pb-4 pt-0">
            <div
              className="relative -mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white text-lg font-bold text-white"
              style={{ background: avBg }}
            >
              {peerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={peerAvatarUrl}
                  alt={peerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                ini
              )}
            </div>
            <p
              className="mt-2 text-center text-base font-bold"
              style={{ color: GI_TEXT }}
            >
              {peerName}
            </p>
            {peerUsername ? (
              <p className="text-center text-xs" style={{ color: GI_MUTED }}>
                @{peerUsername}
              </p>
            ) : null}
            <p
              className="mt-0.5 inline-flex items-center gap-1 text-center text-xs"
              style={{ color: GI_MUTED }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: peerOnline === true ? GI_GREEN : "#9ca3af",
                }}
                aria-hidden
              />
              {presenceText}
            </p>
            <div className="mt-4 flex w-full max-w-sm justify-center gap-2">
              {(
                [
                  { key: "search", label: "Search" as const },
                  { key: "voice", label: "Voice" as const },
                  { key: "video", label: "Video" as const },
                  { key: "schedule", label: "Schedule" as const },
                  { key: "more", label: "More" as const },
                ] as const
              ).map((row) => {
                const iconNode =
                  row.key === "search" ? (
                    <ThIconSearch size={18} className="text-[#1E293B]" />
                  ) : row.key === "voice" ? (
                    <ThIconPhoneHandset size={18} className="text-[#1E293B]" />
                  ) : row.key === "video" ? (
                    <ThIconVideoCam size={18} className="text-[#1E293B]" />
                  ) : row.key === "schedule" ? (
                    <Calendar
                      className="h-[18px] w-[18px] text-[#1E293B]"
                      strokeWidth={2}
                    />
                  ) : (
                    <ThIconMoreDots size={18} className="text-[#1E293B]" />
                  );
                return (
                  <div
                    key={row.key}
                    className="relative flex-1"
                    ref={row.key === "more" ? actionMoreRef : undefined}
                  >
                    <button
                      type="button"
                      className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl"
                      style={{
                        background: GI_ACTION_BG,
                        minHeight: 44,
                        color: GI_TEXT,
                      }}
                      onClick={() => {
                        if (row.key === "search") onSearchInChat();
                        else if (row.key === "voice") onVoiceCall();
                        else if (row.key === "video") onVideoCall();
                        else if (row.key === "schedule") onScheduleCall();
                        else setActionMoreOpen((o) => !o);
                      }}
                    >
                      {iconNode}
                      <span
                        className="text-[10px]"
                        style={{ color: GI_MUTED }}
                      >
                        {row.label}
                      </span>
                    </button>
                    {row.key === "more" && actionMoreOpen ? (
                      <div
                        className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border py-1 shadow-xl"
                        style={{
                          background: GI_CARD,
                          borderColor: GI_SECTION_BORDER,
                        }}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onToggleFavorite();
                          }}
                        >
                          {isFavorite
                            ? "Remove from Favorites"
                            : "Add to Favorites"}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onToggleMute();
                          }}
                        >
                          {isMuted ? "Unmute" : "Mute Notifications"}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onClearChat();
                          }}
                        >
                          Clear Chat
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-3 pb-6">
          {scheduledCalls.length > 0 ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: GI_MUTED }}
                >
                  Scheduled calls
                </p>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-black/5"
                  style={{ color: GI_CORAL }}
                  onClick={onScheduleCall}
                >
                  + New
                </button>
              </div>
              <ul className="space-y-2">
                {scheduledCalls.map((s) => {
                  const upcoming = s.at >= Date.now();
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: GI_SECTION_BORDER,
                        background: GI_ACTION_BG,
                        opacity: upcoming ? 1 : 0.6,
                      }}
                    >
                      <Calendar
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                        style={{ color: GI_TEXT }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-semibold"
                          style={{ color: GI_TEXT }}
                        >
                          {s.title}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: GI_MUTED }}
                        >
                          {new Date(s.at).toLocaleString()}
                          {!upcoming ? " · past" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 hover:bg-black/5"
                        style={{ color: GI_MUTED }}
                        aria-label="Remove reminder"
                        onClick={() => removeScheduledCall(s.id)}
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            className={`${cardBase} flex w-full items-center justify-between text-left`}
            style={cardStyle}
            onClick={onViewFullProfile}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: GI_TEXT }}
            >
              View full profile
            </span>
            <ThIconChevronRight size={18} className="text-[#8896a0]" />
          </button>

          <div className={cardBase} style={cardStyle}>
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_TEXT }}
              onClick={onClearChat}
            >
              Clear chat
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
            <div
              className="my-1 h-px w-full"
              style={{ background: GI_SECTION_BORDER }}
            />
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_CORAL }}
              onClick={onBlockPeer}
            >
              Block {peerName.split(" ")[0] || "user"}
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
            <div
              className="my-1 h-px w-full"
              style={{ background: GI_SECTION_BORDER }}
            />
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_CORAL }}
              onClick={onReport}
            >
              Report {peerName.split(" ")[0] || "user"}
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export { DmInfoPanel };
export type { DmInfoPanelProps };
