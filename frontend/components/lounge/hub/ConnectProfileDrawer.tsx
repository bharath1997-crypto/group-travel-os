"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Phone,
  Search,
  Video,
} from "lucide-react";

import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import { ThIconCheckCircle } from "@/components/lounge/hub/HubIcons";
import { BUBBLE_SENDER_CORAL } from "@/lib/lounge/chat-theme";
import { profileOrAvatarPublicUrl } from "@/lib/lounge/hub-utils";
import type { ChatInfo, UserSearchResultRow } from "@/lib/lounge/hub-types";

const BG = "#0f3460";
const SURFACE = "#2d4060";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "#8892a4";
const ONLINE = "#22C55E";
const MONEY_LINE_GREEN = "#4ADE80";
const MONEY_LINE_RED = "#F87171";
const MONEY_TOTAL_POS = "#4ADE80";
const MONEY_TOTAL_NEG = "#F87171";
const MONEY_TOTAL_ZERO = "#94A3B8";

export type ConnectProfileSubTab =
  | "media"
  | "links"
  | "docs"
  | "trips"
  | "activities";

export type ConnectProfileDrawerProps = {
  profile: UserSearchResultRow | null;
  onClose: () => void;
  activeChat: ChatInfo | null;
  peerOnline: boolean | null;
  subTab: ConnectProfileSubTab;
  onSubTabChange: (tab: ConnectProfileSubTab) => void;
  reportDialogOpen: boolean;
  onReportDialogOpenChange: (open: boolean) => void;
  userSearchActionId: string | null;
  onConnect: (u: UserSearchResultRow) => void | Promise<void>;
  onAccept: (u: UserSearchResultRow) => void | Promise<void>;
  onBlock: (u: UserSearchResultRow) => void | Promise<void>;
  onOpenInChatSearch: () => void;
  onOpenSearchOverlay: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
};

export function ConnectProfileDrawer({
  profile,
  onClose,
  activeChat,
  peerOnline,
  subTab,
  onSubTabChange,
  reportDialogOpen,
  onReportDialogOpenChange,
  userSearchActionId,
  onConnect,
  onAccept,
  onBlock,
  onOpenInChatSearch,
  onOpenSearchOverlay,
  showToast,
}: ConnectProfileDrawerProps) {
  if (!profile) return null;

  const p = profile;
  const st = p.friend_status;
  const planLabel = (p.plan ?? "free").replace(/_/g, " ");
  const photo = profileOrAvatarPublicUrl(p);
  const inDmWithPeer =
    activeChat?.type === "individual" &&
    p.id != null &&
    (activeChat.members ?? []).includes(p.id);
  const isPending = st === "pending_sent" || st === "pending_received";
  const youOweThem = 0;
  const theyOweYou = 0;
  const totalNet = theyOweYou - youOweThem;
  const moneyAllZero = youOweThem + theyOweYou === 0 && totalNet === 0;
  const fmtTotal = (n: number) => {
    if (n > 0) return `+$${n.toFixed(2)}`;
    if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
    return "$0.00";
  };
  const tabList: ConnectProfileSubTab[] = [
    "media",
    "links",
    "docs",
    "trips",
    "activities",
  ];

  const handleClose = () => {
    onReportDialogOpenChange(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[400] flex justify-end">
        <button
          type="button"
          aria-label="Close profile"
          className="min-h-0 flex-1 bg-black/55"
          onClick={handleClose}
        />
        <div
          className="flex h-full max-h-screen w-[min(100%,400px)] shrink-0 flex-col custom-scrollbar overflow-y-auto border-l shadow-2xl"
          style={{ background: BG, borderColor: BORDER_SUB }}
        >
          <div
            className="flex shrink-0 items-center justify-between border-b px-3 py-2"
            style={{ borderColor: BORDER_SUB }}
          >
            <span className="text-sm font-medium text-white">Profile</span>
            <button
              type="button"
              className="text-2xl leading-none text-slate-400 hover:text-white"
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col items-center px-4 pb-2 pt-4">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
                width={80}
                height={80}
              />
            ) : (
              <InitialsAvatar name={p.full_name} size={80} />
            )}
            <h2 className="mt-4 text-center text-lg font-bold text-white">
              {p.full_name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
              {st === "accepted" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-300">
                  <ThIconCheckCircle size={12} className="text-green-300/90" />
                  Buddy
                </span>
              ) : isPending ? (
                <span className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
                  Request Pending
                </span>
              ) : inDmWithPeer && st === "blocked" ? (
                <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                  Blocked
                </span>
              ) : inDmWithPeer && st === "none" ? (
                <span className="rounded-full border border-slate-500/40 bg-slate-600/25 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                  Private Chat
                </span>
              ) : null}
            </div>
            {p.username ? (
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                @{p.username}
              </p>
            ) : null}
            <p
              className="mt-1 flex items-center justify-center gap-1.5 text-center text-sm"
              style={{ color: TEXT_MUTED }}
            >
              {peerOnline === true ? (
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
              {peerOnline === true ? "Active now" : "Last seen recently"}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{ background: SURFACE }}
              >
                {planLabel}
              </span>
              {p.is_verified ? (
                <span className="rounded-full bg-sky-600/80 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Verified
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="flex border-b px-1 pb-3 pt-1"
            style={{ borderColor: BORDER_SUB }}
          >
            {(
              [
                [Phone, "Phone", () => showToast("Calls coming soon", "success")],
                [Video, "Video", () => showToast("Video call coming soon", "success")],
                [
                  Search,
                  "Search",
                  () => {
                    onReportDialogOpenChange(false);
                    onClose();
                    if (inDmWithPeer) {
                      onOpenInChatSearch();
                    } else {
                      onOpenSearchOverlay();
                    }
                  },
                ],
                [
                  Ban,
                  "Block",
                  () => {
                    if (st === "blocked") {
                      showToast("Already blocked", "success");
                      return;
                    }
                    void onBlock(p);
                  },
                ],
              ] as const
            ).map(([Icon, label, onClick], i) => (
              <button
                key={i}
                type="button"
                onClick={onClick}
                disabled={st === "blocked" && label === "Block"}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5 p-1 text-white disabled:opacity-40"
              >
                <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                <span className="text-center text-[10px] text-white/90">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div
            className="mx-3 mt-2 rounded-xl border p-3"
            style={{ borderColor: BORDER_SUB, background: SURFACE }}
          >
            <p
              className="text-center text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              Total balance
            </p>
            <p
              className="mt-1 text-center text-2xl font-bold tabular-nums"
              style={{
                color:
                  totalNet > 0
                    ? MONEY_TOTAL_POS
                    : totalNet < 0
                      ? MONEY_TOTAL_NEG
                      : MONEY_TOTAL_ZERO,
              }}
            >
              {fmtTotal(totalNet)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-center text-xs">
              <div>
                <p
                  className="mb-1 flex items-center justify-center gap-1"
                  style={{ color: MONEY_LINE_GREEN }}
                >
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  You receive
                </p>
                <p
                  className="text-base font-bold tabular-nums"
                  style={{
                    color:
                      theyOweYou > 0 ? MONEY_LINE_GREEN : MONEY_TOTAL_ZERO,
                  }}
                >
                  ${theyOweYou.toFixed(2)}
                </p>
              </div>
              <div>
                <p
                  className="mb-1 flex items-center justify-center gap-1"
                  style={{ color: MONEY_LINE_RED }}
                >
                  <ArrowDownRight
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  You owe
                </p>
                <p
                  className="text-base font-bold tabular-nums"
                  style={{
                    color:
                      youOweThem > 0 ? MONEY_LINE_RED : MONEY_TOTAL_ZERO,
                  }}
                >
                  ${youOweThem.toFixed(2)}
                </p>
              </div>
            </div>
            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: TEXT_MUTED }}
            >
              {moneyAllZero
                ? "No shared group expenses yet"
                : "Split activity totals are summarized here when you share a group."}
            </p>
          </div>
          <div
            className="mt-1 flex shrink-0 flex-wrap border-b"
            style={{ borderColor: BORDER_SUB }}
          >
            {tabList.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onSubTabChange(tab)}
                className="min-w-0 flex-1 px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color: subTab === tab ? BUBBLE_SENDER_CORAL : TEXT_MUTED,
                  borderBottom:
                    subTab === tab
                      ? `2px solid ${BUBBLE_SENDER_CORAL}`
                      : "2px solid transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            className="min-h-[88px] px-4 py-3 text-sm"
            style={{ color: TEXT_MUTED }}
          >
            {subTab === "media" ? <p>Nothing in Media</p> : null}
            {subTab === "links" ? <p>Nothing in Links</p> : null}
            {subTab === "docs" ? <p>Nothing in Docs</p> : null}
            {subTab === "trips" ? <p>Nothing in Trips</p> : null}
            {subTab === "activities" ? <p>Nothing in Activities</p> : null}
          </div>
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: BORDER_SUB }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              {st === "none" ? (
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "#2563EB" }}
                  disabled={userSearchActionId === p.id}
                  onClick={() => void onConnect(p)}
                >
                  Connect
                </button>
              ) : null}
              {st === "pending_sent" ? (
                <button
                  type="button"
                  className="cursor-not-allowed rounded-lg bg-slate-600/50 px-4 py-2 text-sm font-medium text-slate-400"
                  disabled
                >
                  Requested
                </button>
              ) : null}
              {st === "pending_received" ? (
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "#16A34A" }}
                  disabled={userSearchActionId === p.id}
                  onClick={() => void onAccept(p)}
                >
                  Accept
                </button>
              ) : null}
              {st === "blocked" ? (
                <span className="text-sm" style={{ color: TEXT_MUTED }}>
                  Blocked
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="mt-auto border-t px-4 py-3"
            style={{ borderColor: BORDER_SUB }}
          >
            <div className="text-center">
              <button
                type="button"
                onClick={() => onReportDialogOpenChange(true)}
                className="text-center text-xs font-medium underline-offset-2 hover:underline"
                style={{
                  color: "#E8385A",
                  background: "none",
                  border: "none",
                }}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      </div>
      {reportDialogOpen ? (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-report-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-4 shadow-2xl"
            style={{ background: SURFACE, borderColor: BORDER_SUB }}
          >
            <p
              id="profile-report-title"
              className="text-center text-sm text-white"
            >
              Are you sure you want to report{" "}
              <span className="font-semibold">
                {profile.full_name ?? "this person"}
              </span>
              ?
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => onReportDialogOpenChange(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReportDialogOpenChange(false);
                  showToast("Report submitted. We'll review this.", "success");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: "#E8385A" }}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
