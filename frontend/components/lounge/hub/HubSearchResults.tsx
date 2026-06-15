"use client";

import {
  Ban,
  BellOff,
  MessageCircle,
  Star,
} from "lucide-react";

import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import { ThIconCheckCircle } from "@/components/lounge/hub/HubIcons";
import { readBuddyFavourites, addBuddyFavourite } from "@/lib/lounge/buddy-favourites";
import {
  initialsFromName,
  listAvatarColor,
  profileOrAvatarPublicUrl,
} from "@/lib/lounge/hub-utils";
import type {
  ChatInfo,
  ContactPerson,
  GroupOut,
  UserSearchResultRow,
} from "@/lib/lounge/hub-types";

const SURFACE = "#2d4060";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "#8892a4";
const ACCENT = "#4a9eff";

export type HubSearchResultsProps = {
  tone?: "overlay" | "dock";
  searchQuery: string;
  loading: boolean;
  overlayChats: ChatInfo[];
  overlayContacts: UserSearchResultRow[];
  overlayPeople: UserSearchResultRow[];
  discoverGroupsList: GroupOut[];
  groups: GroupOut[];
  onOpenGroupChat: (c: ChatInfo) => void;
  onOpenDirectChat: (p: ContactPerson) => void | Promise<void>;
  onViewProfile: (u: UserSearchResultRow) => void;
  userSearchActionId: string | null;
  onConnect: (u: UserSearchResultRow) => void | Promise<void>;
  onAccept: (u: UserSearchResultRow) => void | Promise<void>;
  onMessageBuddy: (u: UserSearchResultRow) => void;
  onBlock: (u: UserSearchResultRow) => void | Promise<void>;
  buddiesMenuOpenId: string | null;
  onBuddiesMenuOpenIdChange: (id: string | null) => void;
  onJoinDiscoverGroup: () => void | Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
  onDismiss?: () => void;
};

function useSearchTone(tone: "overlay" | "dock") {
  const isDock = tone === "dock";
  return {
    section: isDock ? "text-[#0F766E]" : undefined,
    sectionStyle: isDock ? undefined : { color: "#E94560" },
    row: isDock
      ? "mb-1 flex min-h-[56px] items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 px-2 py-2"
      : "mb-1 flex min-h-[56px] items-center gap-3 rounded-lg px-2 py-2",
    rowStyle: isDock ? undefined : { background: SURFACE },
    rowBtn: isDock
      ? "mb-1 flex w-full min-h-[56px] items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 px-2 py-2 text-left hover:bg-stone-100"
      : "mb-1 flex w-full min-h-[56px] items-center gap-3 rounded-lg px-2 py-2 text-left",
    rowBtnStyle: isDock ? undefined : { background: SURFACE },
    title: isDock ? "truncate text-sm font-bold text-slate-900" : "truncate text-sm font-bold text-white",
    sub: isDock ? "truncate text-xs text-stone-500" : "truncate text-xs",
    subStyle: isDock ? undefined : { color: TEXT_MUTED },
    empty: isDock ? "px-2 py-12 text-center text-sm text-stone-500" : "px-2 py-12 text-center text-sm",
    emptyStyle: isDock ? undefined : { color: TEXT_MUTED },
    menu: isDock
      ? "absolute right-0 top-full z-[50] mt-1 min-w-[11rem] rounded-lg border border-stone-200 bg-white py-1 shadow-xl"
      : "absolute right-0 top-full z-[410] mt-1 min-w-[11rem] rounded-lg border py-1 shadow-xl",
    menuStyle: isDock ? undefined : { background: SURFACE, borderColor: BORDER_SUB },
    menuItem: isDock
      ? "block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-stone-50"
      : "block w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10",
    planBadge: isDock
      ? "mt-0.5 inline-block rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700"
      : "mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/90",
    planBadgeStyle: isDock ? undefined : { background: "#334155" },
    spinnerBorder: isDock ? "border-stone-300 border-t-[#0F766E]" : "border-slate-600 border-t-white",
  };
}

export function HubSearchResults({
  tone = "overlay",
  searchQuery,
  loading,
  overlayChats,
  overlayContacts,
  overlayPeople,
  discoverGroupsList,
  groups,
  onOpenGroupChat,
  onOpenDirectChat,
  onViewProfile,
  userSearchActionId,
  onConnect,
  onAccept,
  onMessageBuddy,
  onBlock,
  buddiesMenuOpenId,
  onBuddiesMenuOpenIdChange,
  onJoinDiscoverGroup,
  showToast,
  onDismiss,
}: HubSearchResultsProps) {
  const t = useSearchTone(tone);
  const q = searchQuery.trim();

  if (q.length < 2) {
    return (
      <p className={t.empty} style={t.emptyStyle}>
        Type 2+ characters to search
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className={`h-8 w-8 animate-spin rounded-full border-2 ${t.spinnerBorder}`}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="px-1 py-1">
      {overlayChats.length > 0 ? (
        <div className="mb-3">
          <p className={`px-2 pb-2 text-xs font-bold ${t.section ?? ""}`} style={t.sectionStyle}>
            Chats
          </p>
          {overlayChats.map((c) => {
            const gMeta = c.group_id
              ? groups.find((g) => g.id === c.group_id)
              : undefined;
            const n = gMeta?.members?.length ?? 0;
            const bg = listAvatarColor(c.name);
            const ini = c.listInitials ?? initialsFromName(c.name);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenGroupChat(c)}
                className={t.rowBtn}
                style={t.rowBtnStyle}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: bg }}
                >
                  {ini}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={t.title}>{c.name}</p>
                  <p className={t.sub} style={t.subStyle}>
                    {n} {n === 1 ? "member" : "members"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
      {overlayContacts.length > 0 ? (
        <div className="mb-3">
          <p className={`px-2 pb-2 text-xs font-bold ${t.section ?? ""}`} style={t.sectionStyle}>
            Contacts
          </p>
          {overlayContacts.map((c) => {
            const contactPhoto = profileOrAvatarPublicUrl(c);
            return (
              <div key={c.id} className={t.row} style={t.rowStyle}>
                {contactPhoto ? (
                  <img
                    src={contactPhoto}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar name={c.full_name} size={40} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={t.title}>{c.full_name}</p>
                  {c.username ? (
                    <p className={t.sub} style={t.subStyle}>
                      @{c.username}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => {
                    onDismiss?.();
                    void onOpenDirectChat({
                      id: c.id,
                      full_name: c.full_name,
                      username: c.username,
                      avatar_url: c.profile_picture ?? c.avatar_url ?? null,
                    });
                  }}
                >
                  Message
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {overlayPeople.length > 0 ? (
        <div className="mb-3">
          <p className={`px-2 pb-2 text-xs font-bold ${t.section ?? ""}`} style={t.sectionStyle}>
            People
          </p>
          {overlayPeople.map((u) => {
            const uPhoto = profileOrAvatarPublicUrl(u);
            const st = u.friend_status;
            const pl = (u.plan ?? "free").replace(/_/g, " ");
            return (
              <div key={u.id} className={t.row} style={t.rowStyle}>
                <button
                  type="button"
                  className="shrink-0 border-0 bg-transparent p-0"
                  aria-label="View profile"
                  onClick={() => onViewProfile(u)}
                >
                  {uPhoto ? (
                    <img
                      src={uPhoto}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar name={u.full_name} size={40} />
                  )}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                  onClick={() => onViewProfile(u)}
                >
                  <p className={t.title}>{u.full_name}</p>
                  {u.username ? (
                    <p className={t.sub} style={t.subStyle}>
                      @{u.username}
                    </p>
                  ) : null}
                  <span className={t.planBadge} style={t.planBadgeStyle}>
                    {pl}
                  </span>
                </button>
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  {st === "none" ? (
                    <button
                      type="button"
                      className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={userSearchActionId === u.id}
                      onClick={() => void onConnect(u)}
                    >
                      Connect
                    </button>
                  ) : null}
                  {st === "pending_sent" ? (
                    <button
                      type="button"
                      className="cursor-not-allowed rounded-lg bg-slate-600/50 px-3 py-1.5 text-xs font-medium text-slate-400"
                      disabled
                    >
                      Requested
                    </button>
                  ) : null}
                  {st === "pending_received" ? (
                    <button
                      type="button"
                      className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={userSearchActionId === u.id}
                      onClick={() => void onAccept(u)}
                    >
                      Accept
                    </button>
                  ) : null}
                  {st === "accepted" ? (
                    <div className="relative" data-buddies-root>
                      <button
                        type="button"
                        className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-medium text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBuddiesMenuOpenIdChange(
                            buddiesMenuOpenId === u.id ? null : u.id,
                          );
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ThIconCheckCircle size={14} className="text-white" />
                          Buddies
                        </span>
                      </button>
                      {buddiesMenuOpenId === u.id ? (
                        <div
                          className={t.menu}
                          style={t.menuStyle}
                          data-buddies-root
                        >
                          <button
                            type="button"
                            className={t.menuItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMessageBuddy(u);
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Message
                            </span>
                          </button>
                          <button
                            type="button"
                            className={t.menuItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (readBuddyFavourites().includes(u.id)) {
                                showToast("Already a favourite", "success");
                              } else {
                                addBuddyFavourite(u.id);
                                showToast("Added to favourites", "success");
                              }
                              onBuddiesMenuOpenIdChange(null);
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Favourite
                            </span>
                          </button>
                          <button
                            type="button"
                            className={t.menuItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBuddiesMenuOpenIdChange(null);
                              showToast("Muted", "success");
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <BellOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Mute
                            </span>
                          </button>
                          <button
                            type="button"
                            className={t.menuItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBuddiesMenuOpenIdChange(null);
                              void onBlock(u);
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Block
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {st === "blocked" ? (
                    <span className="px-2 text-xs text-stone-500" style={t.subStyle}>
                      Blocked
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {discoverGroupsList.length > 0 ? (
        <div className="mb-3">
          <p className={`px-2 pb-2 text-xs font-bold ${t.section ?? ""}`} style={t.sectionStyle}>
            Groups
          </p>
          {discoverGroupsList.map((g) => {
            const n = g.members?.length ?? 0;
            const bg = listAvatarColor(g.name);
            const ch = (g.name.trim()[0] ?? "?").toUpperCase();
            return (
              <div key={g.id} className={t.row} style={t.rowStyle}>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: bg }}
                >
                  {ch}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={t.title}>{g.name}</p>
                  <p className={t.sub} style={t.subStyle}>
                    {n} {n === 1 ? "member" : "members"}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                  style={{ background: ACCENT }}
                  onClick={() => void onJoinDiscoverGroup()}
                >
                  Join
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {overlayChats.length === 0 &&
      overlayContacts.length === 0 &&
      overlayPeople.length === 0 &&
      discoverGroupsList.length === 0 ? (
        <p className={t.empty} style={t.emptyStyle}>
          No results found
        </p>
      ) : null}
    </div>
  );
}
