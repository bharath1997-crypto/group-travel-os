"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Ban,
  Banknote,
  BarChart2,
  BellOff,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  Download,
  FileText,
  Folder,
  Headphones,
  Map as MapIcon,
  MapPin,
  Mic,
  MoreVertical,
  Music,
  Navigation,
  Phone,
  Play,
  Search,
  Trash2,
  User,
  UserCircle2,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  BUBBLE_SENDER_CORAL,
  BUBBLE_TEXT,
  BUBBLE_TS,
  WA_CORAL,
  WA_GREEN,
  WA_INCOMING_BUBBLE,
  WA_MUTED,
  WA_OUTGOING_BUBBLE,
  WA_TEXT,
  WA_HEADER_GROUP,
  TEXT_MUTED,
  TH_MUTED,
  BG,
  SURFACE,
  BORDER_SUB,
  ONLINE,
  MSG_BORDER,
} from "@/lib/lounge/chat-theme";
import type {
  ChatInfo,
  ChatMessage,
  ContactPerson,
  GroupOut,
  TripOut,
} from "@/lib/lounge/hub-types";
import {
  getDateLabel,
  getGroupWaDateLabel,
  groupReadReceipt,
  shouldShowDateSeparator,
} from "@/lib/lounge/chat-utils";
import { formatTripHeaderDates, groupTripStatusPill } from "@/lib/lounge/trip-utils";
import { HUB_LIST_THEME } from "@/lib/lounge/hub-theme";

const { ACCENT } = HUB_LIST_THEME;
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  ThIconChevronLeft,
  ThIconMicLine,
  ThIconMoreDots,
  ThIconPaperclip,
  ThIconPhoneHandset,
  ThIconPin,
  ThIconPlane,
  ThIconSearch,
  ThIconSendPlane,
  ThStatusDot,
  ThIconSmile,
  ThIconUsersGroup,
  ThIconVideoCam,
} from "@/components/lounge/hub/HubIcons";
import {
  chatRowDisplayName,
  chatRowDmAvatarUrl,
  initialsFromName,
  isInlineSvgDataUrlToSkipForPhoto,
  isLegacyDicebearUrl,
  getCurrencySymbol,
  listAvatarColor,
} from "@/lib/lounge/hub-utils";

function ChatHeader({
  chat,
  onBack,
  groups,
  dmPeerIsOnline,
  onDmHeaderClick,
  onOpenGroupInfo,
  onMuteChat,
  onSearchInChat,
  onClearChat,
  onBlockPeer,
  onLeaveGroup,
  onReport,
  onDmVoiceCall,
  onDmVideoCall,
  onDmSchedule,
  groupTrip,
  groupTripLoading,
  onGroupVoice,
  onGroupVideoCall,
  onGroupSchedule,
}: {
  chat: ChatInfo;
  onBack: () => void;
  groups: GroupOut[];
  /** DM only: peer `presence/{id}/online` (null = unknown) */
  dmPeerIsOnline: boolean | null;
  onDmHeaderClick: () => void;
  onOpenGroupInfo: () => void;
  onMuteChat: () => void;
  onSearchInChat: () => void;
  onClearChat: () => void;
  onBlockPeer: () => void;
  onLeaveGroup: () => void;
  onReport: () => void;
  onDmVoiceCall: () => void;
  onDmVideoCall: () => void;
  onDmSchedule: () => void;
  /** Travel group: first trip for header subtitle & pill (null = none / still loading) */
  groupTrip: TripOut | null;
  groupTripLoading: boolean;
  onGroupVoice: () => void;
  onGroupVideoCall: () => void;
  onGroupSchedule: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const el = menuWrapRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const g = chat.group_id
    ? groups.find((x) => x.id === chat.group_id)
    : undefined;
  const memberCount = g?.members?.length ?? chat.members?.length ?? 0;
  const headerTitle = chatRowDisplayName(chat);
  const dmHeaderAvatar =
    chat.type === "individual" ? chatRowDmAvatarUrl(chat) : null;
  const isTravelGroup = (g?.group_type ?? "regular") === "travel";
  const groupIni = initialsFromName(headerTitle);
  const groupBg = listAvatarColor(headerTitle);
  const tripPill = groupTrip && isTravelGroup ? groupTripStatusPill(groupTrip) : null;

  const headerMainClick = () => {
    if (chat.type === "group") onOpenGroupInfo();
    else onDmHeaderClick();
  };

  if (chat.type === "group") {
    return (
      <header
        className="shrink-0 border-b"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: WA_HEADER_GROUP,
        }}
      >
        <div className="flex items-center gap-2 px-2 py-2.5 md:px-3">
          <button
            type="button"
            className="shrink-0 text-xl text-white md:hidden"
            onClick={onBack}
            aria-label="Back"
          >
            <ThIconChevronLeft size={22} className="text-white" />
          </button>
          <div
            role="button"
            tabIndex={0}
            onClick={headerMainClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                headerMainClick();
              }
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-left"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: groupBg, minWidth: 40, minHeight: 40 }}
            >
              {groupIni}
            </span>
            <div className="min-w-0 flex-1">
              <p className="inline-flex min-w-0 max-w-full items-center gap-0.5 truncate text-[15px] font-semibold" style={{ color: WA_TEXT }}>
                <span className="truncate">{headerTitle}</span>
                {isTravelGroup ? (
                  <span className="inline-flex shrink-0" style={{ color: WA_CORAL }}>
                    <ThIconPlane size={14} className="text-current" />
                  </span>
                ) : null}
              </p>
              {isTravelGroup ? (
                <>
                  <p
                    className="mt-0.5 line-clamp-2 text-[12px] leading-tight"
                    style={{ color: WA_MUTED }}
                  >
                    {memberCount} {memberCount === 1 ? "member" : "members"} ·{" "}
                    {groupTripLoading
                      ? "…"
                      : groupTrip
                        ? formatTripHeaderDates(groupTrip)
                        : "No trip linked"}
                  </p>
                  {groupTrip && tripPill ? (
                    <p
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold leading-snug"
                      style={{ background: tripPill.bg, color: WA_TEXT }}
                    >
                      <ThStatusDot color={tripPill.dotColor} />
                      <span>{tripPill.text}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-0.5 w-full text-[12px]">
                  <span style={{ color: WA_MUTED }}>{memberCount} members · </span>
                  <span style={{ color: WA_TEXT }}>tap for info</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Search"
              onClick={onSearchInChat}
            >
              <ThIconSearch size={20} className="text-current" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Voice"
              onClick={onGroupVoice}
            >
              <ThIconPhoneHandset size={20} className="text-current" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Video"
              onClick={onGroupVideoCall}
            >
              <Video className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Schedule a call"
              onClick={onGroupSchedule}
            >
              <Calendar className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="relative" ref={menuWrapRef}>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded text-slate-300 hover:bg-white/10"
                style={{ color: TH_MUTED }}
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <ThIconMoreDots size={20} className="text-current" />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 top-full z-[120] mt-1 min-w-[12rem] overflow-hidden rounded-lg border py-1 shadow-xl"
                  style={{
                    background: SURFACE,
                    borderColor: BORDER_SUB,
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onSearchInChat();
                    }}
                  >
                    <Search className="h-4 w-4 shrink-0 opacity-80" />
                    Search
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onMuteChat();
                    }}
                  >
                    <BellOff className="h-4 w-4 shrink-0 opacity-80" />
                    Mute
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenGroupInfo();
                    }}
                  >
                    <Users className="h-4 w-4 shrink-0 opacity-80" />
                    Group Info
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport();
                    }}
                  >
                    Report
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b px-3 py-3 md:px-4"
      style={{ borderColor: BORDER_SUB, background: BG }}
    >
      <button
        type="button"
        className="text-xl text-white md:hidden"
        onClick={onBack}
        aria-label="Back"
      >
        <ThIconChevronLeft size={22} className="text-white" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={headerMainClick}
      >
        {dmHeaderAvatar ? (
          <img
            src={dmHeaderAvatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            width={40}
            height={40}
          />
        ) : (
          <InitialsAvatar name={headerTitle} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white">
            {headerTitle}
          </p>
          <p
            className="flex min-w-0 items-center gap-1.5 text-[12px]"
            style={{ color: TEXT_MUTED }}
          >
            {dmPeerIsOnline === true ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: ONLINE }}
                aria-hidden
              />
            ) : (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-slate-500"
                aria-hidden
              />
            )}
            {dmPeerIsOnline === true ? "Active now" : "Last seen recently"}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Voice call"
          onClick={onDmVoiceCall}
        >
          <Phone className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Video call"
          onClick={onDmVideoCall}
        >
          <Video className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Schedule a call"
          onClick={onDmSchedule}
        >
          <Calendar className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="relative flex shrink-0 items-center" ref={menuWrapRef}>
        <button
          type="button"
          className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Chat menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreVertical className="h-6 w-6" strokeWidth={1.5} />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-[120] mt-1 min-w-[14rem] overflow-hidden rounded-lg border py-1 shadow-xl"
            style={{
              background: SURFACE,
              borderColor: BORDER_SUB,
            }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onDmHeaderClick();
              }}
            >
              <User className="h-4 w-4 shrink-0 opacity-80" />
              View Profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onMuteChat();
              }}
            >
              <BellOff className="h-4 w-4 shrink-0 opacity-80" />
              Mute notifications
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onSearchInChat();
              }}
            >
              <Search className="h-4 w-4 shrink-0 opacity-80" />
              Search in chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onDmSchedule();
              }}
            >
              <Calendar className="h-4 w-4 shrink-0 opacity-80" />
              Schedule a call
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                void onClearChat();
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
              Clear chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                void onBlockPeer();
              }}
            >
              <Ban className="h-4 w-4 shrink-0 opacity-80" />
              Block user
            </button>
            <button
              type="button"
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onReport();
              }}
            >
              Report
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function GroupMessageBubble({
  msg,
  mine,
  isTravelGroup,
  showAvatar,
  showName,
  readState,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  msg: ChatMessage;
  mine: boolean;
  isTravelGroup: boolean;
  showAvatar: boolean;
  showName: boolean;
  readState: "sent" | "delivered" | "read";
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = (msg.metadata || {}) as Record<string, unknown>;
  const t = String(msg.type || "text").toLowerCase();
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const name = (msg.sender_name || "?").trim();
  const senderIni = initialsFromName(name);
  const senderBg = listAvatarColor(name);
  const mediaUrl = typeof meta.url === "string" ? meta.url : "";
  const mediaName =
    typeof meta.name === "string" && meta.name.trim()
      ? meta.name
      : t === "video"
        ? "travel-hub-video.webm"
        : "travel-hub-image.jpg";
  const [locationPreview, setLocationPreview] = useState<{
    lat: number;
    lon: number;
    live: boolean;
  } | null>(null);

  if (t === "poll" && meta?.question != null) {
    const options = (meta.options as { label: string; votes: number }[]) ?? [];
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(99,102,241,0.1)",
            borderColor: "rgba(99,102,241,0.35)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#a5b4fc" }}>
            <BarChart2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            POLL
          </p>
          <p className="text-sm" style={{ color: WA_TEXT }}>
            {String(meta.question ?? msg.text ?? "")}
          </p>
          {options.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs" style={{ color: WA_MUTED }}>
              {options.map((o, i) => (
                <li key={i}>
                  {o.label} · {o.votes} vote{o.votes === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: WA_MUTED }}>
            <button type="button" className="text-indigo-300">
              Vote Now
            </button>
            <span>Closes 8PM</span>
          </div>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  if (t === "location" || t === "live_location") {
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(59,130,246,0.1)",
            borderColor: "rgba(59,130,246,0.35)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-sm" style={{ color: WA_TEXT }}>
            <MapPin className="h-4 w-4 shrink-0 text-[#9ca3af]" strokeWidth={1.5} aria-hidden />
            <span>
              {name} shared {t === "live_location" ? "live" : "current"} location
            </span>
          </p>
          <button
            type="button"
            className="mt-1 text-xs font-semibold"
            style={{ color: "#60a5fa" }}
            onClick={() => {
              if (meta.lat != null && meta.lon != null) {
                setLocationPreview({
                  lat: Number(meta.lat),
                  lon: Number(meta.lon),
                  live: t === "live_location",
                });
              } else globalThis.alert("No map coordinates in this message");
            }}
          >
            View on Map
          </button>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
        {locationPreview ? (
          <LocationPreviewModal
            lat={locationPreview.lat}
            lon={locationPreview.lon}
            live={locationPreview.live}
            senderName={name}
            onClose={() => setLocationPreview(null)}
          />
        ) : null}
      </div>
    );
  }

  if (
    (t === "expense" || t === "split") &&
    isTravelGroup
  ) {
    const title =
      (meta.title as string) ||
      (meta.description as string) ||
      (msg.text as string) ||
      "Expense";
    const amount = meta.amount;
    const paidBy = (meta.paid_by_name as string) || (meta.paidBy as string) || "—";
    const yourShare = meta.your_share ?? meta.yourShare;
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(29,158,117,0.1)",
            border: "1px solid rgba(29,158,117,0.3)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: WA_GREEN }}>
            Expense added
          </p>
          <p className="text-sm font-medium" style={{ color: WA_TEXT }}>
            {title}
          </p>
          <p className="text-sm" style={{ color: WA_TEXT }}>
            {amount != null ? `₹${Number(amount).toLocaleString()}` : ""}
            {amount != null ? " · " : ""}Paid by {paidBy}
          </p>
          {yourShare != null ? (
            <p className="text-sm" style={{ color: WA_MUTED }}>
              Your share: ₹{Number(yourShare).toLocaleString()}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-[#1d9e75] py-1.5 text-xs font-bold"
            style={{ color: WA_GREEN, background: "transparent" }}
            onClick={() => globalThis.alert("Split details: coming soon in travel hub")}
          >
            View Split Details
          </button>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  const bubble = (
    <div
      className="max-w-[min(100%,20rem)] px-3 py-1.5"
      style={{
        background: mine ? WA_OUTGOING_BUBBLE : WA_INCOMING_BUBBLE,
        boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
        borderRadius: mine
          ? "7.5px 0px 7.5px 7.5px"
          : "0px 7.5px 7.5px 7.5px",
      }}
    >
      {showName && !mine ? (
        <p className="mb-0.5 text-[11px] font-bold" style={{ color: WA_CORAL }}>
          {name}
        </p>
      ) : null}
      {t === "gif" && msg.text ? (
        <img
          src={String(msg.text)}
          alt=""
          className="max-w-[240px] rounded-[8px]"
        />
      ) : t === "image" && meta?.url ? (
        <div>
          <img
            src={String(meta.url)}
            alt=""
            className="max-h-60 max-w-full rounded-lg"
          />
          <MediaDownloadButton url={mediaUrl} filename={mediaName} />
        </div>
      ) : t === "video" && meta?.url ? (
        <div>
          <video
            src={String(meta.url)}
            className="max-h-60 max-w-full rounded-lg"
            controls
          />
          <MediaDownloadButton url={mediaUrl} filename={mediaName} />
        </div>
      ) : t === "audio" ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: BUBBLE_TEXT }}>
          <Play className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span
            className="h-2 flex-1 rounded"
            style={{ background: "rgba(26,26,46,0.12)" }}
          />
        </div>
      ) : (
        <p
          className="whitespace-pre-wrap break-words text-sm leading-relaxed"
          style={{ color: BUBBLE_TEXT }}
        >
          {msg.text}
        </p>
      )}
      <div
        className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px]"
        style={{ color: BUBBLE_TS }}
      >
        <span className="tabular-nums">{timeStr}</span>
        {mine ? (
          <span
            className="inline-flex shrink-0 items-center"
            style={{
              color: readState === "read" ? WA_CORAL : BUBBLE_TS,
            }}
            aria-hidden
            title={readState === "read" ? "Read" : "Delivered"}
          >
            {readState === "read" || readState === "delivered" ? (
              <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`mb-0.5 flex w-full min-w-0 items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
    >
      {selectMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
            isSelected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-400 bg-transparent"
          }`}
        >
          {isSelected && <Check className="h-4 w-4 text-white" />}
        </button>
      ) : null}
      {!mine && showAvatar ? (
        <span
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: senderBg }}
        >
          {senderIni}
        </span>
      ) : !mine ? (
        <span className="w-7 shrink-0" aria-hidden />
      ) : null}
      {bubble}
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  isGroup,
  readReceipt,
  dmPeerAvatarUrl,
  dmPeerDisplayName,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
  readReceipt: "none" | "sent" | "read";
  /** Other user in 1:1 (for avatar when !mine) */
  dmPeerAvatarUrl: string | null;
  dmPeerDisplayName: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = msg.metadata as Record<string, unknown> | undefined;
  const mediaUrl = typeof meta?.url === "string" ? meta.url : "";
  const mediaName =
    typeof meta?.name === "string" && meta.name.trim()
      ? meta.name
      : msg.type === "video"
        ? "travel-hub-video.webm"
        : "travel-hub-image.jpg";
  const [locationPreview, setLocationPreview] = useState<{
    lat: number;
    lon: number;
    live: boolean;
  } | null>(null);

  const otherPhotoUrl = (() => {
    if (isGroup) {
      const sa = msg.sender_avatar?.trim();
      if (
        sa &&
        !isInlineSvgDataUrlToSkipForPhoto(sa) &&
        !isLegacyDicebearUrl(sa)
      ) {
        return sa;
      }
      return null;
    }
    const dm = dmPeerAvatarUrl?.trim();
    if (dm && !isInlineSvgDataUrlToSkipForPhoto(dm) && !isLegacyDicebearUrl(dm)) {
      return dm;
    }
    return null;
  })();
  const otherInitialsName = isGroup
    ? msg.sender_name || "?"
    : dmPeerDisplayName || "?";

  return (
    <div
      className={`mb-2 flex w-full items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {selectMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
            isSelected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-400 bg-transparent"
          }`}
        >
          {isSelected && <Check className="h-4 w-4 text-white" />}
        </button>
      ) : null}
      {!mine ? (
        otherPhotoUrl ? (
          <img
            src={otherPhotoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            width={32}
            height={32}
          />
        ) : (
          <InitialsAvatar name={otherInitialsName} size={32} />
        )
      ) : null}
      <div
        className={`flex min-w-0 max-w-[70%] flex-col ${mine ? "items-end" : "items-start"}`}
      >
        {isGroup && !mine ? (
          <p
            className="mb-0.5 text-[11px] font-semibold"
            style={{ color: BUBBLE_SENDER_CORAL }}
          >
            {msg.sender_name}
          </p>
        ) : null}
        <div
          className="px-3 py-2"
          style={{
            background: mine ? WA_OUTGOING_BUBBLE : WA_INCOMING_BUBBLE,
            boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
            borderRadius: mine
              ? "7.5px 0px 7.5px 7.5px"
              : "0px 7.5px 7.5px 7.5px",
            border: mine ? "none" : "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {msg.type === "split" ? (
            <div
              className="min-w-[200px] max-w-[min(100%,280px)] rounded-xl border-2 px-3 py-3"
              style={{
                borderColor: BUBBLE_SENDER_CORAL,
                background: "rgba(255,127,80,0.1)",
              }}
            >
              <div
                className="mb-1.5 flex items-center justify-between gap-2"
                style={{ color: BUBBLE_SENDER_CORAL }}
              >
                <span className="inline-flex text-[#9ca3af]" aria-hidden>
                  <Banknote className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 text-right">
                  <span className="text-base font-bold tabular-nums">
                    {(() => {
                      const code = String(
                        (meta as { currency?: string } | undefined)
                          ?.currency ?? "USD",
                      );
                      const sym = getCurrencySymbol(code);
                      const raw = (meta as { amount?: number } | undefined)
                        ?.amount;
                      const n =
                        typeof raw === "number" ? raw : parseFloat(String(raw));
                      if (!Number.isFinite(n)) return "—";
                      return `${sym}${n.toFixed(2)}`;
                    })()}
                  </span>{" "}
                  <span
                    className="text-[10px] font-medium opacity-80"
                    style={{ color: TEXT_MUTED }}
                  >
                    {String(
                      (meta as { currency?: string } | undefined)?.currency ??
                        "USD",
                    )}
                  </span>
                </div>
              </div>
              {msg.text ? (
                <p
                  className="text-sm leading-snug"
                  style={{ color: BUBBLE_TEXT }}
                >
                  {msg.text}
                </p>
              ) : null}
              {meta && (meta as { split_equally?: boolean }).split_equally ? (
                <p
                  className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: BUBBLE_SENDER_CORAL }}
                >
                  Split equally
                </p>
              ) : null}
            </div>
          ) : null}
          {msg.type === "gif" && msg.text ? (
            <img
              src={String(msg.text)}
              alt=""
              className="max-w-[240px] rounded-[8px]"
            />
          ) : null}
          {!msg.type || msg.type === "text" ? (
            <p className="text-sm" style={{ color: BUBBLE_TEXT }}>
              {msg.text}
            </p>
          ) : null}
          {msg.type === "image" && meta?.url ? (
            <div>
              <img
                src={String(meta.url)}
                alt=""
                className="max-h-60 max-w-[250px] rounded-xl"
              />
              <MediaDownloadButton url={mediaUrl} filename={mediaName} />
            </div>
          ) : null}
          {msg.type === "video" && meta?.url ? (
            <div>
              <video
                src={String(meta.url)}
                className="max-h-60 max-w-[250px] rounded-xl"
                controls
              />
              <MediaDownloadButton url={mediaUrl} filename={mediaName} />
            </div>
          ) : null}
          {msg.type === "document" ? (
            <div
              className="flex min-w-[220px] max-w-[280px] items-center gap-2 rounded-lg border px-2.5 py-2"
              style={{
                borderColor: "rgba(15,23,42,0.12)",
                background: "rgba(255,255,255,0.36)",
                color: BUBBLE_TEXT,
              }}
            >
              <FileText
                className="h-6 w-6 shrink-0"
                style={{ color: BUBBLE_TS }}
                strokeWidth={1.7}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {String(meta?.name ?? msg.text ?? "Document")}
                </p>
                <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                  {typeof meta?.size === "number"
                    ? `${Math.ceil(meta.size / 1024)} KB`
                    : "Cloud file"}
                </p>
              </div>
            </div>
          ) : null}
          {msg.type === "location" || msg.type === "live_location" ? (
            <div>
              <p
                className="flex items-start gap-1.5 text-sm"
                style={{ color: BUBBLE_TEXT }}
              >
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: BUBBLE_TS }}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>{msg.text}</span>
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {meta?.lat != null && meta?.lon != null
                  ? `${meta.lat}, ${meta.lon}`
                  : ""}
              </p>
              <button
                type="button"
                className="mt-1 inline-block text-xs font-bold"
                style={{ color: ACCENT }}
                onClick={() => {
                  if (meta?.lat != null && meta?.lon != null) {
                    setLocationPreview({
                      lat: Number(meta.lat),
                      lon: Number(meta.lon),
                      live: msg.type === "live_location",
                    });
                  }
                }}
              >
                Open in Map
              </button>
            </div>
          ) : null}
          {msg.type === "expense" ? (
            <div>
              <p className="text-sm" style={{ color: BUBBLE_TEXT }}>
                {String(meta?.description ?? msg.text)}
              </p>
              <p className="font-bold" style={{ color: ACCENT }}>
                {meta?.amount != null ? String(meta.amount) : ""}
              </p>
              <Link
                href="/split-activities"
                className="text-xs font-bold text-sky-400"
              >
                View Details
              </Link>
            </div>
          ) : null}
          {msg.type === "trip" ? (
            <div>
              <p
                className="flex items-center gap-1.5 text-sm"
                style={{ color: BUBBLE_TEXT }}
              >
                <ThIconPlane
                  size={16}
                  className="shrink-0 text-[#8896a0]"
                />
                <span>{String(meta?.trip_name ?? msg.text)}</span>
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.destination ?? "")}
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.dates ?? "")}
              </p>
              <Link
                href={`/trips/${String(meta?.trip_id ?? "")}`}
                className="text-xs font-bold"
                style={{ color: ACCENT }}
              >
                View Trip
              </Link>
            </div>
          ) : null}
          {msg.type === "audio" ? (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: BUBBLE_TEXT }}
            >
              <Play
                className="h-4 w-4 shrink-0"
                style={{ color: BUBBLE_TS }}
                strokeWidth={1.5}
                aria-hidden
              />
              <span
                className="h-8 flex-1 rounded"
                style={{ background: "rgba(26,26,46,0.1)" }}
              />
              <span className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.duration ?? "")}
              </span>
            </div>
          ) : null}
          <div
            className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "justify-end" : "justify-start"}`}
            style={{ color: BUBBLE_TS }}
          >
            <span>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {mine && readReceipt !== "none" ? (
              <span
                className="inline-flex shrink-0 items-center"
                title={readReceipt === "read" ? "Read" : "Sent"}
                aria-hidden
              >
                {readReceipt === "read" ? (
                  <CheckCheck
                    className="h-3.5 w-3.5"
                    style={{ color: BUBBLE_TS }}
                    strokeWidth={1.5}
                  />
                ) : (
                  <Check
                    className="h-3.5 w-3.5"
                    style={{ color: BUBBLE_TS }}
                    strokeWidth={1.5}
                  />
                )}
              </span>
            ) : null}
          </div>
        </div>
        {locationPreview ? (
          <LocationPreviewModal
            lat={locationPreview.lat}
            lon={locationPreview.lon}
            live={locationPreview.live}
            senderName={msg.sender_name || "Shared location"}
            onClose={() => setLocationPreview(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function downloadMedia(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function MediaDownloadButton({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  return (
    <button
      type="button"
      className="mt-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/60"
      onClick={() => downloadMedia(url, filename)}
    >
      Download
    </button>
  );
}

function LocationPreviewModal({
  lat,
  lon,
  senderName,
  live,
  onClose,
}: {
  lat: number;
  lon: number;
  senderName: string;
  live: boolean;
  onClose: () => void;
}) {
  const initial = initialsFromName(senderName);
  const avatarBg = listAvatarColor(senderName);

  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center bg-black/60 px-3 pb-3 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              {live ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-35" />
              ) : null}
              <Navigation className="relative h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {senderName}
              </p>
              <p className="text-xs text-slate-500">
                {live ? "Live location preview" : "Current location preview"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="relative h-[min(58vh,380px)] min-h-[280px] overflow-hidden bg-[#dfe8df]">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "linear-gradient(28deg, transparent 0 46%, rgba(255,255,255,0.86) 46% 52%, transparent 52% 100%), linear-gradient(116deg, transparent 0 47%, rgba(255,255,255,0.78) 47% 53%, transparent 53% 100%), linear-gradient(0deg, transparent 0 48%, rgba(148,163,184,0.5) 48% 51%, transparent 51% 100%), linear-gradient(90deg, transparent 0 48%, rgba(148,163,184,0.45) 48% 51%, transparent 51% 100%)",
              backgroundSize: "180px 180px, 220px 220px, 72px 72px, 72px 72px",
              backgroundPosition: "12px 8px, -30px 28px, 0 0, 0 0",
            }}
          />
          <div className="absolute left-6 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            Map
          </div>
          {live ? (
            <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 shadow">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
              </span>
              Live GPS
            </div>
          ) : null}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[76%] flex-col items-center">
            {live ? (
              <span className="absolute top-3 h-24 w-24 animate-ping rounded-full bg-blue-500/20" />
            ) : null}
            <div
              className="relative flex h-16 w-16 rotate-45 items-center justify-center border-4 border-white shadow-xl"
              style={{
                background: avatarBg,
                borderRadius: "50% 50% 50% 8px",
              }}
            >
              <span className="-rotate-45 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white">
                {initial}
              </span>
            </div>
            <div className="mt-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
              {senderName}
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 p-3 shadow-lg">
            <p className="text-sm font-semibold text-slate-900">
              {live ? "Live location" : "Current location"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Shared inside this chat. No external map tab opened.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <MapPin className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          <span>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LocationShareSheet({
  onClose,
  onShare,
}: {
  onClose: () => void;
  onShare: (kind: "current" | "live") => void;
}) {
  return (
    <div className="fixed inset-0 z-[420] flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Share location</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Choose how this location should appear in the chat.
          </p>
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
          onClick={() => onShare("current")}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
            <MapPin className="h-5 w-5" strokeWidth={1.7} aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              Share current location
            </span>
            <span className="text-xs text-slate-500">
              Send one map card with your position now.
            </span>
          </span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
          onClick={() => onShare("live")}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">
            <Navigation className="h-5 w-5" strokeWidth={1.7} aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              Present as live location
            </span>
            <span className="text-xs text-slate-500">
              Send a live-location style card to the receiver.
            </span>
          </span>
        </button>
        <button
          type="button"
          className="w-full border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CameraCaptureModal({
  onClose,
  onCapture,
  showToast,
}: {
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  showToast: (message: string, type?: "success" | "error") => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError("Camera permission denied or no camera available.");
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      showToast("Camera is still loading", "error");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      showToast("Could not capture photo", "error");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[430] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">Camera</p>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="aspect-[3/4] bg-black">
          {cameraError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-200">
              {cameraError}
            </div>
          ) : (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-4 px-4 py-4">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white text-slate-950 shadow-lg"
            onClick={capturePhoto}
            aria-label="Capture photo"
          >
            <Camera className="h-6 w-6" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

type WhatsAppAttachMiniMenuProps = {
  align?: "left" | "right";
  includeTravelActions?: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGalleryFile: (file: File) => void;
  onDocumentFile: (file: File) => void;
  onAudio: () => void;
  onLocation: () => void;
  onContact: () => void;
  onPoll: () => void;
  onEvent: () => void;
  onSplit?: () => void;
  onTrip?: () => void;
  onPin?: () => void;
};

function WhatsAppAttachMiniMenu({
  align = "left",
  includeTravelActions = false,
  onClose,
  onCamera,
  onGalleryFile,
  onDocumentFile,
  onAudio,
  onLocation,
  onContact,
  onPoll,
  onEvent,
  onSplit,
  onTrip,
  onPin,
}: WhatsAppAttachMiniMenuProps) {
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (
    file: File | undefined,
    handler: (file: File) => void,
  ) => {
    if (!file) return;
    handler(file);
    onClose();
  };

  const items: {
    label: string;
    icon: ReactNode;
    bg: string;
  }[] = [
    {
      label: "Document",
      icon: <FileText className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#6d5dfc",
    },
    {
      label: "Camera",
      icon: <Camera className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#ec407a",
    },
    {
      label: "Gallery",
      icon: <Folder className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#1e88e5",
    },
    {
      label: "Audio",
      icon: <Headphones className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#f4511e",
    },
    {
      label: "Location",
      icon: <MapPin className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#00a884",
    },
    {
      label: "Contact",
      icon: <UserCircle2 className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#0ea5e9",
    },
    {
      label: "Poll",
      icon: <BarChart2 className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#f59e0b",
    },
    {
      label: "Event",
      icon: <Calendar className="h-6 w-6" strokeWidth={1.7} />,
      bg: "#e91e63",
    },
  ];

  if (includeTravelActions) {
    items.push(
      {
        label: "Split",
        icon: <Banknote className="h-6 w-6" strokeWidth={1.7} />,
        bg: "#16a34a",
      },
      {
        label: "Trip",
        icon: <ThIconPlane size={24} className="text-white" />,
        bg: "#e94560",
      },
      {
        label: "Pin",
        icon: <ThIconPin size={24} className="text-white" />,
        bg: "#7c3aed",
      },
    );
  }

  const handleItemClick = (label: string) => {
    if (label === "Document") {
      docRef.current?.click();
      return;
    }
    if (label === "Camera") {
      onCamera();
      onClose();
      return;
    }
    if (label === "Gallery") {
      galleryRef.current?.click();
      return;
    }
    if (label === "Audio") onAudio();
    else if (label === "Location") onLocation();
    else if (label === "Contact") onContact();
    else if (label === "Poll") onPoll();
    else if (label === "Event") onEvent();
    else if (label === "Split") (onSplit ?? onEvent)();
    else if (label === "Trip") (onTrip ?? onEvent)();
    else if (label === "Pin") (onPin ?? onLocation)();
    onClose();
  };

  return (
    <div
      className={`absolute bottom-full z-[200] mb-2 w-[min(92vw,360px)] rounded-2xl border bg-white p-4 shadow-2xl ${
        align === "right" ? "right-0" : "left-0"
      }`}
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      <div className="grid grid-cols-4 gap-x-3 gap-y-4 text-center">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="flex min-w-0 flex-col items-center gap-1.5 text-[11px] font-medium text-slate-700"
            onClick={() => handleItemClick(item.label)}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: item.bg }}
              aria-hidden
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
      <input
        ref={docRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => handleFile(e.target.files?.[0], onDocumentFile)}
      />
      <input
        ref={galleryRef}
        type="file"
        className="hidden"
        accept="image/*,video/*"
        onChange={(e) => handleFile(e.target.files?.[0], onGalleryFile)}
      />
    </div>
  );
}

function AttachMenu({
  trips,
  onClose,
  onPickImage,
  onLocation,
  onExpense,
  onTrip,
  onLiveLocation,
  onAudio,
}: {
  trips: TripOut[];
  onClose: () => void;
  onPickImage: (b64: string) => void;
  onLocation: (lat: number, lon: number, name: string) => void;
  onExpense: () => void;
  onTrip: (t: TripOut) => void;
  onLiveLocation: () => void;
  onAudio: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTrips, setShowTrips] = useState(false);

  return (
    <div
      className="mx-3 mb-2 rounded-t-2xl border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      style={{ borderColor: MSG_BORDER, background: SURFACE }}
    >
      <p
        className="mb-3 text-[12px] font-bold uppercase"
        style={{ color: TEXT_MUTED }}
      >
        Share
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex cursor-pointer flex-col items-center gap-1">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Camera className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Photo</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => onPickImage(String(r.result));
              r.readAsDataURL(f);
              onClose();
            }}
          />
        </label>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onAudio();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Music className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Audio</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                onLocation(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  "My Location",
                );
                onClose();
              },
              () => {},
            );
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <MapPin className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Location</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onExpense();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Banknote className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Split Expense</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => setShowTrips((s) => !s)}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <ThIconPlane size={24} className="text-[#9ca3af]" />
          </span>
          <span className="text-[11px] text-slate-200">Trip</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onLiveLocation();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <MapIcon className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Live Location</span>
        </button>
      </div>
      {showTrips ? (
        <ul
          className="mt-3 max-h-32 custom-scrollbar overflow-y-auto rounded-lg border p-2 text-sm"
          style={{ borderColor: MSG_BORDER, background: BG }}
        >
          {trips.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full py-1 text-left text-slate-200 hover:underline"
                onClick={() => {
                  onTrip(t);
                  onClose();
                }}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full py-1 text-center text-xs"
        style={{ color: TEXT_MUTED }}
      >
        Close
      </button>
    </div>
  );
}

function NewChatOverlay({
  contacts,
  onClose,
  onPick,
}: {
  contacts: ContactPerson[];
  onClose: () => void;
  onPick: (p: ContactPerson) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: BG }}
    >
      <div
        className="flex items-center gap-3 border-b px-3 py-3"
        style={{ borderColor: BORDER_SUB }}
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center text-white"
        >
          <ThIconChevronLeft size={22} className="text-white" />
        </button>
        <span className="font-bold text-white">New Chat</span>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people..."
        className="mx-4 mt-3 rounded-full border px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        style={{ borderColor: MSG_BORDER, background: SURFACE }}
      />
      <div className="mt-4 px-4">
        <button
          type="button"
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          <Users className="h-5 w-5" strokeWidth={1.5} />
          New Group Chat
        </button>
      </div>
      <ul className="flex-1 custom-scrollbar overflow-y-auto px-4">
            {filtered.map((c) => {
          const cPhoto =
            c.avatar_url &&
            c.avatar_url.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(c.avatar_url) &&
            !isLegacyDicebearUrl(c.avatar_url)
              ? c.avatar_url
              : null;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                {cPhoto ? (
                  <img
                    src={cPhoto}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                    width={40}
                    height={40}
                  />
                ) : (
                  <InitialsAvatar name={c.full_name} size={40} />
                )}
                <span className="font-semibold text-white">{c.full_name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
export {
  ChatHeader,
  GroupMessageBubble,
  MessageBubble,
  MediaDownloadButton,
  LocationPreviewModal,
  LocationShareSheet,
  CameraCaptureModal,
  WhatsAppAttachMiniMenu,
  NewChatOverlay,
};
