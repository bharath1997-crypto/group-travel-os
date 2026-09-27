"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { MoreVertical, Search, UserPlus } from "lucide-react";
import { apiFetchWithStatus } from "@/lib/api";
import { HUB_LIST_THEME } from "@/lib/lounge/hub-theme";
import {
  chatRowDisplayName,
  formatUserSearchMeta,
  isInlineSvgDataUrlToSkipForPhoto,
  isLegacyDicebearUrl,
  normalizeConnectUserSearchQuery,
} from "@/lib/lounge/hub-utils";
import type {
  ChatInfo,
  ContactPerson,
  GroupOut,
  UserMe,
  UserSearchResultRow,
} from "@/lib/lounge/hub-types";
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import { ThIconChevronLeft } from "@/components/lounge/hub/HubIcons";

const { LIST_ROW_HOVER } = HUB_LIST_THEME;

function buildPeerSearchRowFromChat(
  chat: ChatInfo,
  peerId: string,
  connectionsList: UserSearchResultRow[],
): UserSearchResultRow {
  const conn = connectionsList.find((c) => c.id === peerId);
  if (conn) return conn;
  return {
    id: peerId,
    full_name: chatRowDisplayName(chat),
    username: null,
    profile_picture: chat.metadata?.profile_picture ?? null,
    avatar_url: chat.metadata?.avatar_url ?? null,
    friend_status: "accepted",
  };
}

type NewChatContactRow = {
  id: string;
  full_name: string;
  sub: string;
  avatar_url: string | null;
};

function NewChatSlidePanel({
  onClose,
  onNewGroup,
  onPickContact,
  user,
  groups,
  mainChatList,
  handleUnauthorized,
  masterAbortRef,
}: {
  onClose: () => void;
  onNewGroup: () => void;
  onPickContact: (p: ContactPerson) => void;
  user: UserMe;
  groups: GroupOut[];
  mainChatList: ChatInfo[];
  handleUnauthorized: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
}) {
  const newChatMuted = "#8896a0";
  const newChatName = "#e9edef";
  const newChatSearchBg = "#263545";
  const newGroupAmber = "#f0a500";

  const [searchQuery, setSearchQuery] = useState("");
  const [baseRows, setBaseRows] = useState<NewChatContactRow[]>([]);
  const [searchHits, setSearchHits] = useState<UserSearchResultRow[] | null>(
    null,
  );
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);
  const searchSeq = useRef(0);
  const baseLoadSeq = useRef(0);

  useLayoutEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const seq = ++baseLoadSeq.current;
    setLoadingBase(true);
    const ac = new AbortController();
    void (async () => {
      try {
        const merged = new Map<string, NewChatContactRow>();
        try {
          const connR = await apiFetchWithStatus<UserSearchResultRow[]>(
            "/social/connections",
            { signal: ac.signal },
          );
          if (baseLoadSeq.current !== seq) return;
          if (connR.status === 401) {
            handleUnauthorized();
            return;
          }
          if (connR.status === 200 && Array.isArray(connR.data)) {
            for (const r of connR.data) {
              if (r.id === user.id) continue;
              merged.set(r.id, {
                id: r.id,
                full_name: r.full_name,
                sub: formatUserSearchMeta(r),
                avatar_url: r.profile_picture ?? r.avatar_url,
              });
            }
          }
        } catch {
          if (baseLoadSeq.current === seq) {
            /* keep partial */
          }
        }
        try {
          const frR = await apiFetchWithStatus<UserSearchResultRow[]>(
            "/social/friends",
            { signal: ac.signal },
          );
          if (baseLoadSeq.current !== seq) return;
          if (frR.status === 200 && Array.isArray(frR.data)) {
            for (const r of frR.data) {
              if (r.id === user.id) continue;
              if (!merged.has(r.id)) {
                merged.set(r.id, {
                  id: r.id,
                  full_name: r.full_name,
                  sub: formatUserSearchMeta(r),
                  avatar_url: r.profile_picture ?? r.avatar_url,
                });
              }
            }
          }
        } catch {
          /* route may not exist */
        }
        for (const g of groups) {
          for (const m of g.members ?? []) {
            const uid = m.user_id ?? m.id;
            if (!uid || uid === user.id) continue;
            if (!merged.has(uid)) {
              merged.set(uid, {
                id: uid,
                full_name: m.full_name?.trim() || "Member",
                sub: "Group member",
                avatar_url: m.avatar_url ?? null,
              });
            }
          }
        }
        for (const ch of mainChatList) {
          if (ch.type !== "individual" || ch.isBot || ch.isDemo) continue;
          const peer = ch.members.find((x) => x !== user.id);
          if (!peer || merged.has(peer)) continue;
          const pRow = buildPeerSearchRowFromChat(ch, peer, []);
          merged.set(peer, {
            id: peer,
            full_name: chatRowDisplayName(ch),
            sub: formatUserSearchMeta(pRow),
            avatar_url:
              ch.metadata?.profile_picture?.trim() ||
              ch.metadata?.avatar_url?.trim() ||
              null,
          });
        }
        if (baseLoadSeq.current !== seq) return;
        setBaseRows(
          Array.from(merged.values()).sort((a, b) =>
            a.full_name.localeCompare(b.full_name, undefined, {
              sensitivity: "base",
            }),
          ),
        );
      } catch {
        if (baseLoadSeq.current === seq) setBaseRows([]);
      } finally {
        if (baseLoadSeq.current === seq) setLoadingBase(false);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [user, groups, mainChatList, handleUnauthorized]);

  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchHits(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      void (async () => {
        setLoadingSearch(true);
        try {
          const r = await apiFetchWithStatus<UserSearchResultRow[]>(
            `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { signal: masterAbortRef.current?.signal },
          );
          if (searchSeq.current !== seq) return;
          if (r.status === 401) {
            handleUnauthorized();
            return;
          }
          if (r.status === 200 && Array.isArray(r.data)) {
            setSearchHits(r.data.filter((row) => row.id !== user.id));
          } else {
            setSearchHits([]);
          }
        } catch {
          if (searchSeq.current === seq) setSearchHits([]);
        } finally {
          if (searchSeq.current === seq) setLoadingSearch(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, user, handleUnauthorized, masterAbortRef]);

  const displayRows: NewChatContactRow[] = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length >= 1) {
      if (searchHits !== null) {
        return searchHits.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          sub: formatUserSearchMeta(r),
          avatar_url: r.profile_picture ?? r.avatar_url,
        }));
      }
      const ql = q.toLowerCase();
      return baseRows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(ql) ||
          r.sub.toLowerCase().includes(ql),
      );
    }
    return baseRows;
  }, [searchQuery, searchHits, baseRows]);

  const requestBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setEntered(false);
    setTimeout(() => {
      setExiting(false);
      setSearchQuery("");
      setSearchHits(null);
      onClose();
    }, 200);
  }, [exiting, onClose]);

  const animStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "#1E293B",
    opacity: exiting ? 0 : entered ? 1 : 0,
    transform: exiting
      ? "translateX(-10px)"
      : entered
        ? "translateX(0)"
        : "translateX(-10px)",
    transition: "opacity 200ms ease, transform 200ms ease",
  };

  return (
    <div
      className="absolute inset-0 z-[30] min-h-0"
      style={animStyle}
    >
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-3 pl-2"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <button
            type="button"
            onClick={requestBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/90"
            aria-label="Back"
          >
            <ThIconChevronLeft size={22} className="text-white" />
          </button>
          <span
            className="min-w-0 text-[16px] font-bold"
            style={{ color: "#e8eaf0" }}
          >
            New chat
          </span>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ color: newChatMuted }}
          aria-label="More"
        >
          <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-1">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5"
          style={{ background: newChatSearchBg }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: newChatMuted }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or email..."
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
            style={{ color: newChatName }}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          type="button"
          onClick={() => {
            if (exiting) return;
            setExiting(true);
            setEntered(false);
            setTimeout(() => {
              onNewGroup();
              setExiting(false);
              setSearchQuery("");
              setSearchHits(null);
              onClose();
            }, 200);
          }}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              LIST_ROW_HOVER;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: newGroupAmber }}
          >
            <UserPlus className="h-5 w-5 text-white" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[14px] font-bold"
              style={{ color: newChatName }}
            >
              New group
            </p>
            <p className="text-[12px]" style={{ color: newChatMuted }}>
              Create a group chat
            </p>
          </div>
        </button>
      </div>

      <p
        className="shrink-0 px-3 py-2 text-[11px] font-semibold uppercase"
        style={{ color: newChatMuted }}
      >
        Contacts
      </p>

      <div
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {loadingBase && displayRows.length === 0 && searchQuery.trim().length < 1 ? (
          <p className="px-3 py-4 text-sm" style={{ color: newChatMuted }}>
            Loading…
          </p>
        ) : null}
        {searchQuery.trim().length >= 1 && loadingSearch && searchHits === null ? (
          <p className="px-3 py-2 text-sm" style={{ color: newChatMuted }}>
            Searching…
          </p>
        ) : null}
        {displayRows.length === 0 && !loadingBase && searchQuery.trim().length >= 1 && !loadingSearch ? (
          <p className="px-3 py-4 text-sm" style={{ color: newChatMuted }}>
            No results
          </p>
        ) : null}
        {displayRows.map((row) => {
          const photo = row.avatar_url?.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(row.avatar_url) &&
            !isLegacyDicebearUrl(row.avatar_url)
            ? row.avatar_url
            : null;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                onPickContact({
                  id: row.id,
                  full_name: row.full_name,
                  username: null,
                  avatar_url: row.avatar_url,
                });
                onClose();
              }}
              className="flex w-full items-center gap-3 border-b px-3 text-left transition-colors"
              style={{
                minHeight: 64,
                borderColor: "rgba(255,255,255,0.05)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  LIST_ROW_HOVER;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                  width={46}
                  height={46}
                />
              ) : (
                <InitialsAvatar name={row.full_name} size={46} />
              )}
              <div className="min-w-0 flex-1 py-1">
                <p
                  className="truncate text-[14px] font-bold"
                  style={{ color: newChatName }}
                >
                  {row.full_name}
                </p>
                <p
                  className="truncate text-[12px]"
                  style={{ color: newChatMuted }}
                >
                  {row.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export { NewChatSlidePanel };
