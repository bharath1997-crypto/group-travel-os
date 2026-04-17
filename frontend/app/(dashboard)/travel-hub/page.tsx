"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BG = "#F8F9FA";

type UserMe = { id: string; email: string; full_name: string };

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_seen_at?: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type TabId = "chats" | "groups" | "contacts" | "calls";

const TABS: { id: TabId; label: string }[] = [
  { id: "chats", label: "Chats" },
  { id: "groups", label: "Groups" },
  { id: "contacts", label: "Contacts" },
  { id: "calls", label: "Calls" },
];

const DISCOVER = [
  { emoji: "🌏", name: "Budget Backpackers India", members: 234 },
  { emoji: "🏔️", name: "Himalayan Trekkers", members: 89 },
  { emoji: "🏖️", name: "Goa Beach Lovers", members: 156 },
] as const;

const PLACEHOLDER_INVITES = [
  { name: "Alex Kumar", phone: "+91 •••• ••21" },
  { name: "Priya Sharma", phone: "+91 •••• ••88" },
  { name: "Rahul Verma", phone: "+91 •••• ••05" },
];

const STATIC_CALLS = [
  {
    name: "Nidumolu Bharath",
    type: "missed" as const,
    when: "Yesterday, 6:42 PM",
    duration: "—",
  },
  {
    name: "Travello Support",
    type: "incoming" as const,
    when: "Mon, 10:15 AM",
    duration: "2m 14s",
  },
  {
    name: "Trip crew — Goa",
    type: "outgoing" as const,
    when: "Sun, 4:30 PM",
    duration: "8m 02s",
  },
];

function dicebearUser(userId: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(userId)}`;
}

function groupEmojiFromName(name: string): string {
  const n = name.toLowerCase();
  if (/(goa|beach|sea|coast)/.test(n)) return "🏖️";
  if (/(manali|trek|himal|mountain|peak)/.test(n)) return "🏔️";
  return "👥";
}

function onlineWithinMinutes(iso: string | null | undefined, mins: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Date.now() - t < mins * 60 * 1000;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function memberLevelLabel(joinedAt: string): string {
  const days = (Date.now() - new Date(joinedAt).getTime()) / 86_400_000;
  if (days < 30) return "Beginner";
  if (days < 120) return "Explorer";
  if (days < 365) return "Voyager";
  return "Globetrotter";
}

function tripBadgeLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "ongoing") return "Active";
  return "Planning";
}

export default function TravelHubPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabId>("chats");
  const loadedRef = useRef<Record<TabId, boolean>>({
    chats: false,
    groups: false,
    contacts: false,
    calls: false,
  });

  const [me, setMe] = useState<UserMe | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [groupTrips, setGroupTrips] = useState<Record<string, TripOut[]>>({});
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const [u, g] = await Promise.all([
        apiFetch<UserMe>("/auth/me"),
        apiFetch<GroupOut[]>("/groups"),
      ]);
      setMe(u);
      setGroups(g);
    } catch {
      setMe(null);
      setGroups([]);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const loadGroupsTab = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const g = await apiFetch<GroupOut[]>("/groups");
      setGroups(g);
      const tripsMap: Record<string, TripOut[]> = {};
      await Promise.all(
        g.map(async (gr) => {
          try {
            const trips = await apiFetch<TripOut[]>(`/groups/${gr.id}/trips`);
            tripsMap[gr.id] = trips;
          } catch {
            tripsMap[gr.id] = [];
          }
        }),
      );
      setGroupTrips(tripsMap);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const [g, u] = await Promise.all([
        apiFetch<GroupOut[]>("/groups"),
        apiFetch<UserMe>("/auth/me"),
      ]);
      setGroups(g);
      setMe(u);
    } catch {
      setGroups([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const g = await apiFetch<GroupOut[]>("/groups");
      setGroups(g);
    } catch {
      setGroups([]);
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    const t = tab;
    if (loadedRef.current[t]) return;
    loadedRef.current[t] = true;
    if (t === "chats") void loadChats();
    else if (t === "groups") void loadGroupsTab();
    else if (t === "contacts") void loadContacts();
    else if (t === "calls") void loadCalls();
  }, [tab, loadChats, loadGroupsTab, loadContacts, loadCalls]);

  const contactsUnique = useMemo(() => {
    if (!me) return [];
    const map = new Map<string, GroupMemberOut>();
    for (const g of groups) {
      for (const m of g.members) {
        if (m.user_id === me.id) continue;
        if (!map.has(m.user_id)) map.set(m.user_id, m);
      }
    }
    return Array.from(map.values());
  }, [groups, me]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const quickDialMembers = useMemo(() => {
    const list: GroupMemberOut[] = [];
    const seen = new Set<string>();
    for (const g of groups) {
      for (const m of g.members) {
        if (seen.has(m.user_id)) continue;
        seen.add(m.user_id);
        list.push(m);
        if (list.length >= 12) return list;
      }
    }
    return list;
  }, [groups]);

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const created = await apiFetch<GroupOut>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: createDesc.trim() || null,
        }),
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      router.push(`/groups/${created.id}`);
    } catch {
      showToast("Could not create group");
    } finally {
      setCreateBusy(false);
    }
  }

  async function shareInvite() {
    const text = "Hey! Join me on Travello — group travel made easy.";
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const payload = `${text} ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Travello", text: payload });
      } else {
        await navigator.clipboard.writeText(payload);
        showToast("Invite link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(payload);
        showToast("Invite link copied");
      } catch {
        showToast("Could not share");
      }
    }
  }

  function copyStaticInvite() {
    const t =
      "Hey! Join me on Travello — the best app for group travel coordination! Download here: travello.app";
    void navigator.clipboard.writeText(t).then(
      () => showToast("Invite text copied"),
      () => showToast("Could not copy"),
    );
  }

  return (
    <div className="min-h-0 flex-1 pb-24" style={{ backgroundColor: BG }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 shadow-sm md:rounded-b-xl"
        style={{ backgroundColor: NAVY }}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3 md:px-5">
          <h1 className="text-lg font-bold text-white md:text-xl">Travel Hub</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90 hover:bg-white/10"
              aria-label="Search"
              onClick={() => showToast("Search coming soon")}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90 hover:bg-white/10"
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="text-xl">☰</span>
            </button>
          </div>
        </div>
        <div className="flex border-b border-white/10 px-2 md:px-4">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="relative flex-1 py-3 text-center text-sm font-semibold transition"
                style={{
                  color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
                }}
              >
                {t.label}
                {active ? (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: CORAL }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        {menuOpen ? (
          <div
            className="border-t border-white/10 px-4 py-2 text-xs text-white/80 md:hidden"
            role="menu"
          >
            <button
              type="button"
              className="block w-full py-2 text-left"
              onClick={() => {
                setMenuOpen(false);
                showToast("Hub settings coming soon");
              }}
            >
              Hub settings
            </button>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-5xl px-3 pt-4 md:px-6">
        {tab === "chats" ? (
          <div className="space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-[#E9ECEF] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E94560]/30"
            />
            {loadingChats ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => showToast("Direct messages — coming soon")}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E9ECEF] bg-white p-3 text-left shadow-sm"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E9ECEF] text-xl">
                      💬
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#0F3460]">Direct messages</p>
                      <p className="truncate text-xs text-[#6C757D]">Coming soon</p>
                    </div>
                    <span className="text-xs text-[#6C757D]">—</span>
                  </button>
                </li>
                {filteredGroups.map((g) => {
                  const preview =
                    g.description?.trim() || "No messages yet — say hello to your crew!";
                  const lastTime = formatRelative(g.created_at);
                  const anyOnline = g.members.some((m) =>
                    onlineWithinMinutes(m.last_seen_at ?? null, 5),
                  );
                  return (
                    <li key={g.id}>
                      <Link
                        href={`/groups/${g.id}`}
                        className="flex items-center gap-3 rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm transition hover:bg-slate-50"
                      >
                        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F9FA] text-2xl">
                          {groupEmojiFromName(g.name)}
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3460] text-[10px] text-white">
                            👥
                          </span>
                          <span
                            className={`absolute left-0 top-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                              anyOnline ? "bg-emerald-500" : "bg-[#ADB5BD]"
                            }`}
                            title={anyOnline ? "Someone online" : "Offline"}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#0F3460]">{g.name}</p>
                          <p className="truncate text-xs text-[#6C757D]">{preview}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-[#6C757D]">{lastTime}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => showToast("New chat — coming soon")}
              className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg md:bottom-8"
              style={{ backgroundColor: CORAL }}
              aria-label="New chat"
            >
              ✏️
            </button>
          </div>
        ) : null}

        {tab === "groups" ? (
          <div className="space-y-6">
            {loadingGroups ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              <>
                <section>
                  <h2 className="mb-3 text-sm font-bold text-[#0F3460]">Your groups</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CED4DA] bg-white p-4 text-center text-sm font-semibold text-[#6C757D] transition hover:border-[#E94560]/50 hover:text-[#0F3460]"
                    >
                      <span className="mb-1 text-2xl">+</span>
                      Create new group
                    </button>
                    {groups.map((g) => {
                      const trips = groupTrips[g.id] ?? [];
                      const primary = trips[0];
                      const dates =
                        primary?.start_date && primary?.end_date
                          ? `${primary.start_date} → ${primary.end_date}`
                          : primary?.start_date || "Dates TBD";
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => router.push(`/groups/${g.id}`)}
                          className="rounded-xl border border-[#E9ECEF] bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-2xl">{groupEmojiFromName(g.name)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[#0F3460]">{g.name}</p>
                              <p className="mt-1 text-xs text-[#6C757D]">
                                {g.members.length} members
                                {primary ? ` · ${dates}` : ""}
                              </p>
                              {primary ? (
                                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#2C3E50]">
                                  {tripBadgeLabel(primary.status)}
                                </span>
                              ) : (
                                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#2C3E50]">
                                  Planning
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <h2 className="mb-3 text-sm font-bold text-[#0F3460]">Discover groups</h2>
                  <div className="space-y-2">
                    {DISCOVER.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#E9ECEF] bg-white px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl">{d.emoji}</span>
                          <div>
                            <p className="font-semibold text-[#0F3460]">{d.name}</p>
                            <p className="text-xs text-[#6C757D]">{d.members} members</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => showToast("Join flow coming soon")}
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
                          style={{ backgroundColor: CORAL }}
                        >
                          Join →
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        ) : null}

        {tab === "contacts" ? (
          <div className="space-y-4">
            <div
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: CORAL }}
            >
              <button type="button" className="w-full text-left" onClick={() => void shareInvite()}>
                Invite friends to Travello →
              </button>
            </div>
            <div
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: NAVY }}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => showToast("Sync phone contacts — coming soon")}
              >
                Sync phone contacts
              </button>
            </div>
            {loadingContacts ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              <>
                <section>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6C757D]">
                    On Travello
                  </h2>
                  <ul className="space-y-2">
                    {contactsUnique.map((m) => (
                      <li
                        key={m.user_id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E9ECEF] bg-white p-3"
                      >
                        <span className="relative shrink-0">
                          <img
                            src={m.avatar_url || dicebearUser(m.user_id)}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-full border border-[#E9ECEF] object-cover"
                          />
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                              onlineWithinMinutes(m.last_seen_at ?? null, 5)
                                ? "bg-emerald-500"
                                : "bg-[#ADB5BD]"
                            }`}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#0F3460]">{m.full_name}</p>
                          <p className="text-[10px] text-[#6C757D]">{memberLevelLabel(m.joined_at)}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-lg border border-[#E9ECEF] px-2 py-1 text-sm"
                            onClick={() => {
                              setTab("chats");
                              showToast(`Opening chat with ${m.full_name} — coming soon`);
                            }}
                            aria-label="Chat"
                          >
                            💬
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-[#E9ECEF] px-2 py-1 text-sm"
                            onClick={() => showToast("Calling coming soon")}
                            aria-label="Call"
                          >
                            📞
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6C757D]">
                    Invite to Travello
                  </h2>
                  <ul className="space-y-2">
                    {PLACEHOLDER_INVITES.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#CED4DA] bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#2C3E50]">{p.name}</p>
                          <p className="text-xs text-[#6C757D]">Not on Travello · {p.phone}</p>
                        </div>
                        <button
                          type="button"
                          onClick={copyStaticInvite}
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
                          style={{ backgroundColor: CORAL }}
                        >
                          Invite
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        ) : null}

        {tab === "calls" ? (
          <div className="space-y-6 pb-20">
            <section>
              <h2 className="mb-3 text-sm font-bold text-[#0F3460]">Recent calls</h2>
              <ul className="space-y-2">
                {STATIC_CALLS.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E9ECEF] bg-white p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9ECEF] text-lg">
                      👤
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#0F3460]">{c.name}</p>
                      <p className="text-xs text-[#6C757D]">
                        {c.type === "missed" ? (
                          <span className="text-red-600">↙ Missed</span>
                        ) : c.type === "incoming" ? (
                          <span className="text-emerald-600">↙ Incoming</span>
                        ) : (
                          <span className="text-[#6C757D]">↗ Outgoing</span>
                        )}{" "}
                        · {c.when} · {c.duration}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E9ECEF] px-2 py-1 text-sm"
                      onClick={() => showToast("Calling feature coming soon")}
                    >
                      📞
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="mb-3 text-sm font-bold text-[#0F3460]">Quick dial</h2>
              {loadingCalls ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-gray-200" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {quickDialMembers.map((m) => {
                    const on = onlineWithinMinutes(m.last_seen_at ?? null, 5);
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => showToast("Calling feature coming soon")}
                        className="flex shrink-0 flex-col items-center gap-1"
                      >
                        <span
                          className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 bg-white ${
                            on ? "border-emerald-500" : "border-[#CED4DA]"
                          }`}
                        >
                          <img
                            src={m.avatar_url || dicebearUser(m.user_id)}
                            alt=""
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="max-w-[72px] truncate text-[10px] text-[#6C757D]">
                          {m.full_name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            <button
              type="button"
              onClick={() =>
                showToast("Calling feature coming soon. We are building it!")
              }
              className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg md:bottom-8"
              style={{ backgroundColor: NAVY }}
              aria-label="Quick call"
            >
              📞
            </button>
          </div>
        ) : null}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="text-lg font-bold text-[#0F3460]">New group</h3>
            <form onSubmit={handleCreateGroup} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-[#6C757D]">Name</span>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-[#6C757D]">Description (optional)</span>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
                  rows={2}
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 rounded-xl border border-[#E9ECEF] py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: CORAL }}
                >
                  {createBusy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] w-[min(100%,22rem)] -translate-x-1/2 px-3">
          <div
            className="pointer-events-auto rounded-xl border border-[#E9ECEF] bg-white px-4 py-2 text-center text-sm font-medium text-[#0F3460] shadow-lg"
            role="status"
          >
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
