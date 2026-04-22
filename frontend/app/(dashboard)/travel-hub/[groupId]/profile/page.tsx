"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";

const PANEL_BG = "#0F172A";
const MUTED = "#94A3B8";
const CORAL = "#E94560";
const GREEN = "#22C55E";
const RED = "#EF4444";

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  text?: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role: string;
  is_online?: boolean;
};

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  invite_code?: string;
  is_accepting_members?: boolean;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type SharedTab = "media" | "links" | "docs" | "trips" | "activities";

function getDiceBearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function firstLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

function getGroupColor(seed: string): string {
  const colors = ["#E94560", "#0F3460", "#2ECC71", "#F39C12", "#9B59B6"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % colors.length;
  return colors[h]!;
}

function urlRegex(): RegExp {
  return /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
}

function extractShared(messages: ChatMessage[]) {
  const media: { url: string; ts: number }[] = [];
  const links: { url: string; ts: number }[] = [];
  const docs: { name: string; size: string; ts: number }[] = [];

  for (const m of messages) {
    const ts = m.timestamp;
    const meta = m.metadata ?? {};
    if (m.type === "image" && meta.url) {
      media.push({ url: String(meta.url), ts });
    }
    if (m.type === "text" && m.text) {
      const matches = m.text.match(urlRegex());
      if (matches) {
        for (const u of matches) links.push({ url: u, ts });
      }
    }
    if (m.type === "trip" && meta.trip_id) {
      links.push({
        url: `/trips/${String(meta.trip_id)}`,
        ts,
      });
    }
    const fileName = meta.file_name ?? meta.filename;
    if (
      typeof fileName === "string" &&
      (m.type === "file" || m.type === "document" || meta.mime)
    ) {
      docs.push({
        name: fileName,
        size: meta.size != null ? String(meta.size) : "—",
        ts,
      });
    }
  }

  links.sort((a, b) => b.ts - a.ts);
  media.sort((a, b) => b.ts - a.ts);
  docs.sort((a, b) => b.ts - a.ts);
  return { media, links, docs };
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isAdminMember(m: GroupMemberOut): boolean {
  return String(m.role).toLowerCase() === "admin";
}

export type GroupProfilePanelProps = {
  groupId: string;
  group: GroupOut | null;
  messages: ChatMessage[];
  currentUserId: string;
  onClose?: () => void;
  onMessageMember: (userId: string, displayName: string) => void;
  onRefreshGroup?: () => Promise<void>;
  showCloseButton?: boolean;
};

export function GroupProfilePanel({
  groupId,
  group,
  messages,
  currentUserId,
  onClose,
  onMessageMember,
  onRefreshGroup,
  showCloseButton,
}: GroupProfilePanelProps) {
  const [tab, setTab] = useState<SharedTab>("media");
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [localName, setLocalName] = useState(group?.name ?? "");
  const [accepting, setAccepting] = useState(group?.is_accepting_members ?? true);
  const [disappear, setDisappear] = useState<"off" | "24h" | "7d" | "90d">("off");
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setLocalName(group?.name ?? "");
    setAccepting(group?.is_accepting_members ?? true);
  }, [group?.name, group?.is_accepting_members]);

  useEffect(() => {
    if (typeof window === "undefined" || !groupId) return;
    const d = localStorage.getItem(`gt_group_${groupId}_disappear`);
    if (d === "24h" || d === "7d" || d === "90d" || d === "off") setDisappear(d);
    setIconDataUrl(localStorage.getItem(`gt_group_${groupId}_icon`));
  }, [groupId]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    globalThis.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await apiFetch<TripOut[]>(`/groups/${groupId}/trips`);
        if (!cancelled) setTrips(list);
      } catch {
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const { media, links, docs } = useMemo(
    () => extractShared(messages),
    [messages],
  );

  const expenseMsgCount = useMemo(
    () => messages.filter((m) => m.type === "expense").length,
    [messages],
  );
  const pollCount = useMemo(
    () => messages.filter((m) => m.type === "poll" || m.metadata?.poll).length,
    [messages],
  );
  const meetCount = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.type === "location" ||
          (m.metadata as { meet?: boolean } | undefined)?.meet === true,
      ).length,
    [messages],
  );

  const members = group?.members ?? [];
  const myMember = members.find((m) => m.user_id === currentUserId);
  const iAmAdmin = myMember ? isAdminMember(myMember) : false;

  const totalSpentPlaceholder = useMemo(() => {
    let n = 0;
    for (const m of messages) {
      if (m.type !== "expense") continue;
      const amt = Number((m.metadata as { amount?: unknown })?.amount);
      if (!Number.isNaN(amt)) n += amt;
    }
    return Math.round(n);
  }, [messages]);

  const persistDisappear = (v: typeof disappear) => {
    setDisappear(v);
    if (typeof window !== "undefined")
      localStorage.setItem(`gt_group_${groupId}_disappear`, v);
    showToast("Disappearing messages preference saved locally");
  };

  const onSaveGroupName = async () => {
    if (!localName.trim()) return;
    try {
      await apiFetch(`/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: localName.trim() }),
      });
      showToast("Group name updated");
      await onRefreshGroup?.();
    } catch {
      showToast("Could not update name on server — saved for this session only");
    }
  };

  const onIconFile = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const data = String(r.result);
      setIconDataUrl(data);
      if (typeof window !== "undefined")
        localStorage.setItem(`gt_group_${groupId}_icon`, data);
      showToast("Group icon updated locally");
    };
    r.readAsDataURL(f);
  };

  const reportGroup = () => showToast("Report submitted (demo)");

  const exitGroup = async () => {
    setExitOpen(false);
    try {
      await apiFetch(`/groups/${groupId}/members/${currentUserId}`, {
        method: "DELETE",
      });
      showToast("You left the group");
      onClose?.();
    } catch (e) {
      showToast(
        e instanceof Error
          ? e.message
          : "Could not leave group — you may need an admin to remove you",
      );
    }
  };

  const gName = group?.name ?? "Group";
  const gInitial = firstLetter(gName);
  const avatarSrc = iconDataUrl;
  const memberCount = members.length;

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: PANEL_BG, color: "#F8FAFC" }}
    >
      {showCloseButton ? (
        <div className="flex shrink-0 justify-end border-b border-slate-700/80 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6">
        <div className="flex flex-col items-center text-center">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 rounded-full border-2 border-slate-600 object-cover"
            />
          ) : (
            <span
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ background: getGroupColor(groupId) }}
            >
              {gInitial}
            </span>
          )}
          <h1 className="mt-3 text-[18px] font-bold text-white">{gName}</h1>
          <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
            {memberCount} members
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-[12px]" style={{ color: MUTED }}>
            {(
              [
                ["🎧", "Audio"],
                ["📹", "Video"],
                ["🔍", "Search"],
                ["🔕", "Mute"],
                ["➕", "Add member"],
              ] as const
            ).map(([ic, label]) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1 hover:text-white"
                onClick={() => showToast(`${label} (coming soon)`)}
              >
                <span className="text-xl">{ic}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex border-b border-slate-700/80 text-[12px] font-semibold">
            {(
              [
                ["media", "Media"],
                ["links", "Links"],
                ["docs", "Docs"],
                ["trips", "Trips"],
                ["activities", "Activities"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 py-2 ${
                  tab === id ? "border-b-2 text-white" : "text-slate-500"
                }`}
                style={tab === id ? { borderColor: CORAL } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[120px]">
            {tab === "media" ? (
              media.length === 0 ? (
                <p className="text-center text-[13px]" style={{ color: MUTED }}>
                  No media shared yet
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((im, i) => (
                    <button
                      key={`${im.url}-${i}`}
                      type="button"
                      className="aspect-square overflow-hidden rounded-lg bg-slate-800"
                      onClick={() => setLightbox(im.url)}
                    >
                      <img
                        src={im.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )
            ) : null}

            {tab === "links" ? (
              links.length === 0 ? (
                <p className="text-center text-[13px]" style={{ color: MUTED }}>
                  No links shared yet
                </p>
              ) : (
                <ul className="space-y-3">
                  {links.map((l, i) => (
                    <li
                      key={`${l.url}-${i}`}
                      className="flex gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainFromUrl(l.url))}&sz=32`}
                        alt=""
                        width={20}
                        height={20}
                        className="mt-0.5 h-5 w-5"
                      />
                      <div className="min-w-0 flex-1">
                        <a
                          href={l.url.startsWith("http") ? l.url : `https://${l.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-[13px] text-sky-400 hover:underline"
                        >
                          {l.url}
                        </a>
                        <p className="text-[11px]" style={{ color: MUTED }}>
                          {formatShortDate(l.ts)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "docs" ? (
              docs.length === 0 ? (
                <p className="text-center text-[13px]" style={{ color: MUTED }}>
                  No documents shared yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d, i) => (
                    <li
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
                    >
                      <span className="text-2xl">📄</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{d.name}</p>
                        <p className="text-[11px]" style={{ color: MUTED }}>
                          {d.size} · {formatShortDate(d.ts)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "trips" ? (
              trips.length === 0 ? (
                <p className="text-center text-[13px]" style={{ color: MUTED }}>
                  No trips yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {trips.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg bg-slate-800/60 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/trips/${t.id}`}
                            className="text-[14px] font-semibold text-sky-400 hover:underline"
                          >
                            {t.title}
                          </Link>
                          <p className="text-[12px]" style={{ color: MUTED }}>
                            {(t.start_date ?? "—") + " → " + (t.end_date ?? "—")}
                          </p>
                          <p className="text-[11px]" style={{ color: MUTED }}>
                            {t.description || "—"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-200">
                          {t.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "activities" ? (
              <div className="space-y-3 text-[13px]">
                <p>
                  <span style={{ color: MUTED }}>Total expenses (from chat): </span>
                  <span style={{ color: totalSpentPlaceholder ? GREEN : MUTED }}>
                    ₹{totalSpentPlaceholder.toLocaleString("en-IN")}
                  </span>
                </p>
                <p>
                  <span style={{ color: MUTED }}>Polls created: </span>
                  {pollCount}
                </p>
                <p>
                  <span style={{ color: MUTED }}>Meet points dropped: </span>
                  {meetCount}
                </p>
                <div
                  className="mt-2 rounded-xl border border-slate-700 p-3"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(239,68,68,0.08))",
                  }}
                >
                  <p className="text-[12px] font-semibold text-white">
                    Total spent together: ₹{totalSpentPlaceholder.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: MUTED }}>
                    Breakdown is estimated from expense messages in this chat.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">
              Members ({memberCount})
            </h2>
            <button
              type="button"
              className="text-[12px] font-semibold text-sky-400 hover:underline"
              onClick={() => showToast("Add member (coming soon)")}
            >
              Add member
            </button>
          </div>
          <ul className="space-y-2">
            {members.map((m) => {
              const online = Boolean(m.is_online);
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-2 py-2"
                >
                  <div className="relative shrink-0">
                    <img
                      src={
                        m.avatar_url ||
                        getDiceBearUrl(m.full_name || m.user_id)
                      }
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border border-slate-600"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-slate-900 ${
                        online ? "bg-green-500" : "bg-slate-600"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {m.full_name}
                    </p>
                    <p className="text-[11px]" style={{ color: MUTED }}>
                      {isAdminMember(m) ? "Admin" : "Member"}
                    </p>
                  </div>
                  {m.user_id !== currentUserId ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-white"
                      style={{ background: CORAL }}
                      onClick={() =>
                        onMessageMember(m.user_id, m.full_name)
                      }
                    >
                      Message
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {iAmAdmin ? (
          <div className="mt-8 border-t border-slate-700 pt-6">
            <h2 className="mb-3 text-[14px] font-bold text-amber-200">
              Group settings
            </h2>
            <label className="block text-[12px]" style={{ color: MUTED }}>
              Edit group name
              <div className="mt-1 flex gap-2">
                <input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[13px] text-white"
                />
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-[12px] font-bold text-white"
                  style={{ background: "#0F3460" }}
                  onClick={() => void onSaveGroupName()}
                >
                  Save
                </button>
              </div>
            </label>

            <label className="mt-4 block text-[12px]" style={{ color: MUTED }}>
              Change group icon
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-[12px] text-slate-300"
                onChange={(e) => onIconFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={accepting}
                onChange={(e) => {
                  setAccepting(e.target.checked);
                  showToast(
                    e.target.checked
                      ? "Accepting members: on (local)"
                      : "Accepting members: off (local)",
                  );
                }}
              />
              Accepting members
            </label>

            <div className="mt-4">
              <p className="text-[12px]" style={{ color: MUTED }}>
                Disappearing messages
              </p>
              <select
                value={disappear}
                onChange={(e) =>
                  persistDisappear(e.target.value as typeof disappear)
                }
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[13px] text-white"
              >
                <option value="off">Off</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="90d">90 days</option>
              </select>
            </div>

            <button
              type="button"
              className="mt-6 block text-[13px] font-semibold"
              style={{ color: RED }}
              onClick={reportGroup}
            >
              Report group
            </button>
            <button
              type="button"
              className="mt-3 block text-[13px] font-semibold"
              style={{ color: RED }}
              onClick={() => setExitOpen(true)}
            >
              Exit group
            </button>
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </button>
      ) : null}

      {exitOpen ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4">
          <div
            className="max-w-sm rounded-xl border border-slate-600 p-5"
            style={{ background: PANEL_BG }}
          >
            <p className="text-[15px] font-bold text-white">Exit group?</p>
            <p className="mt-2 text-[13px]" style={{ color: MUTED }}>
              You will need a new invite to rejoin unless an admin adds you back.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[13px] text-slate-300"
                onClick={() => setExitOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-white"
                style={{ background: RED }}
                onClick={() => void exitGroup()}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[450] -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-[12px] text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

type UserMe = { id: string; full_name: string | null };

export default function GroupProfileFullPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = String(params.groupId ?? "");
  const [user, setUser] = useState<UserMe | null>(null);
  const [group, setGroup] = useState<GroupOut | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const g = await apiFetch<GroupOut>(`/groups/${groupId}`);
    setGroup(g);
  }, [groupId]);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<UserMe>("/auth/me");
        setUser(me);
      } catch {
        router.push("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const onMessageMember = useCallback(
    (userId: string) => {
      router.push(`/travel-hub/dm/${userId}`);
    },
    [router],
  );

  return (
    <div className="min-h-[calc(100vh-60px)]" style={{ background: "#020617" }}>
      <div className="mx-auto flex h-[calc(100vh-60px)] max-w-lg flex-col border-x border-slate-800">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-lg text-slate-300"
          >
            ←
          </button>
          <span className="text-[14px] font-semibold text-white">
            Group profile
          </span>
        </header>
        <div className="min-h-0 flex-1">
          {user ? (
            <GroupProfilePanel
              groupId={groupId}
              group={group}
              messages={messages}
              currentUserId={user.id}
              onClose={() => router.back()}
              onMessageMember={(uid, name) => {
                void name;
                onMessageMember(uid);
              }}
              onRefreshGroup={loadGroup}
              showCloseButton={false}
            />
          ) : (
            <div className="p-6 text-slate-400">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
