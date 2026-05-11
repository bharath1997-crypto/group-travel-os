"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, MapPin, ScanLine, Layers, Share2 } from "lucide-react";
import { onValue, ref, update as rtdbUpdate, type Database } from "firebase/database";

import { LiveChecklistPanel } from "@/components/live/LiveChecklist";
import { LiveMap } from "@/components/live/LiveMap";
import { LiveQrScanner } from "@/components/live/LiveQrScanner";
import { LiveTimer } from "@/components/live/LiveTimer";
import { MemberStatusCard } from "@/components/live/MemberStatusCard";
import { QuickStatusSheet } from "@/components/live/QuickStatus";
import { SessionQRCode } from "@/components/live/SessionQRCode";
import { apiFetch } from "@/lib/api";
import { initFirebase } from "@/lib/firebase-client";
import { haversineM } from "@/lib/geo";
import { getToken } from "@/lib/auth";

type UpcomingTrip = {
  trip_id: string;
  title: string;
  destination_hint: string | null;
  start_date: string | null;
  end_date: string | null;
  group_id: string;
  member_count: number;
  members_preview: { user_id: string; avatar_url: string | null }[];
  my_role: "admin" | "coordinator" | "member";
};

type LiveSession = {
  id: string;
  trip_id: string;
  session_code: string;
  status: string;
  meet_radius_meters: number;
};

function parseJwtUserId(token: string | null): string | null {
  if (!token?.trim()) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "=")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");

  const [fb, setFb] = useState<{ ok: boolean; db: Database | null }>({
    ok: false,
    db: null,
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingTrip[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [activeTripMeta, setActiveTripMeta] = useState<UpcomingTrip | null>(null);
  const [profiles, setProfiles] = useState<
    Record<string, { full_name: string | null; avatar_url: string | null }>
  >({});

  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pickingMeetPoint, setPickingMeetPoint] = useState(false);

  const [meetPoint, setMeetPoint] = useState<{
    lat: number | null;
    lng: number | null;
    name?: string | null;
  }>({ lat: null, lng: null, name: null });

  const [membersLocs, setMembersLocs] = useState<
    Record<string, { lat: number | null; lng: number | null; updated_at: number | null; quick_status?: string | null }>
  >({});

  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(false);
  const [groupTogether, setGroupTogether] = useState(false);

  const formationNotifiedRef = useRef(false);
  const timerDoneRef = useRef(false);

  useEffect(() => {
    const t = getToken();
    setCurrentUserId(parseJwtUserId(t));
    const ready = initFirebase();
    setFb({ ok: ready.ok, db: ready.db });
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadErr(null);
    try {
      const token = getToken();
      const trips = await apiFetch<UpcomingTrip[]>("/live/upcoming-trips", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUpcoming(trips);
      return trips;
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Could not load trips");
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  const hydrateSessionForTrip = useCallback(async (tripId: string, metaHint?: UpcomingTrip | null) => {
    try {
      const s = await apiFetch<LiveSession | null>(`/live/trips/${tripId}/session`);
      if (!s) {
        setSession(null);
        setActiveTripMeta(null);
        setFbStatus(null);
        setProfiles({});
        return;
      }
      setSession(s);
      formationNotifiedRef.current = false;
      timerDoneRef.current = false;
      setGroupTogether(false);
      if (metaHint) setActiveTripMeta(metaHint);
      else {
        const refreshed = await refreshLists();
        setActiveTripMeta(
          refreshed?.find((t) => t.trip_id === tripId) ?? upcoming?.find((t) => t.trip_id === tripId) ?? null,
        );
      }
    } catch {
      setSession(null);
      setProfiles({});
      setActiveTripMeta(null);
    }
  }, [refreshLists, upcoming]);

  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<
          { user_id: string; full_name: string | null; avatar_url: string | null }[]
        >(`/live/sessions/${session.id}/checklist`);
        if (!cancelled) {
          const m: typeof profiles = {};
          rows.forEach((r) => {
            m[r.user_id] = { full_name: r.full_name, avatar_url: r.avatar_url ?? null };
          });
          setProfiles(m);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  const joinBySessionCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
      if (code.length !== 8) {
        setLoadErr("QR code missing a valid 8-letter session token.");
        return;
      }
      try {
        setLoadErr(null);
        const joined = await apiFetch<LiveSession>(`/live/sessions/join-by-code`, {
          method: "POST",
          body: JSON.stringify({ session_code: code }),
        });
        setSession(joined);
        const refreshed = await refreshLists();
        setActiveTripMeta(
          refreshed?.find((t) => t.trip_id === joined.trip_id) ?? null,
        );
        router.replace("/live");
      } catch (e: unknown) {
        setLoadErr(e instanceof Error ? e.message : "Could not join session");
      }
    },
    [refreshLists, router],
  );

  const dupJoinRef = useRef(false);

  useEffect(() => {
    const c = codeParam?.trim();
    if (!c || dupJoinRef.current) return undefined;
    dupJoinRef.current = true;
    void joinBySessionCode(c);
    return undefined;
  }, [codeParam, joinBySessionCode]);

  useEffect(() => {
    if (!fb.db || !session?.trip_id) return undefined;
    const r = ref(fb.db, `trips/${session.trip_id}/live_session/status`);
    const off = onValue(r, (snap) => {
      const v = snap.val();
      setFbStatus(typeof v === "string" ? v : null);
    });
    return () => off();
  }, [fb.db, session?.trip_id]);

  useEffect(() => {
    if (!fb.db || !session?.trip_id) return undefined;
    const base = ref(fb.db, `trips/${session.trip_id}/locations`);
    const off = onValue(base, (snap) => {
      const raw = snap.val() as Record<
        string,
        {
          lat?: number | string | null;
          lng?: number | string | null;
          latitude?: number | null;
          longitude?: number | null;
          updated_at?: number | null;
          timestamp?: number | null;
          quick_status?: string | null;
        }
      > | null;
      if (!raw || typeof raw !== "object") {
        setMembersLocs({});
        return;
      }
      const next: typeof membersLocs = {};
      Object.keys(raw).forEach((uid) => {
        const row = raw[uid];
        if (!row) return;
        const latRaw = row.lat ?? row.latitude ?? null;
        const lngRaw = row.lng ?? row.longitude ?? null;
        let lat =
          typeof latRaw === "number"
            ? latRaw
            : typeof latRaw === "string"
              ? Number(latRaw)
              : null;
        let lng =
          typeof lngRaw === "number"
            ? lngRaw
            : typeof lngRaw === "string"
              ? Number(lngRaw)
              : null;
        const updated_at =
          typeof row.updated_at === "number"
            ? row.updated_at
            : typeof row.timestamp === "number"
              ? row.timestamp
              : null;
        next[uid] = {
          lat: lat !== null && !Number.isNaN(lat) ? lat : null,
          lng: lng !== null && !Number.isNaN(lng) ? lng : null,
          updated_at,
          quick_status:
            typeof row.quick_status === "string" ? row.quick_status : null,
        };
      });
      setMembersLocs(next);
    });
    return () => off();
  }, [fb.db, session?.trip_id]);

  useEffect(() => {
    if (!fb.db || !session?.trip_id) return undefined;
    const mp = ref(fb.db, `trips/${session.trip_id}/meet_point`);
    const off = onValue(mp, (snap) => {
      const v = snap.val() as { lat?: number; lng?: number; name?: string } | null;
      if (v?.lat !== undefined && v?.lng !== undefined) {
        const latNum = typeof v.lat === "number" ? v.lat : Number(v.lat);
        const lngNum = typeof v.lng === "number" ? v.lng : Number(v.lng);
        setMeetPoint({
          lat: Number.isNaN(latNum) ? null : latNum,
          lng: Number.isNaN(lngNum) ? null : lngNum,
          name: typeof v.name === "string" ? v.name : null,
        });
      } else setMeetPoint({ lat: null, lng: null, name: null });
    });
    return () => off();
  }, [fb.db, session?.trip_id]);

  const effectiveStatus = fbStatus || session?.status || "";

  useEffect(() => {
    let watchId: number | null = null;
    if (
      session &&
      (effectiveStatus === "pre_live" || effectiveStatus === "active") &&
      currentUserId &&
      fb.db &&
      navigator.geolocation
    ) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const updated_at = Math.floor(Date.now() / 1000);
          try {
            rtdbUpdate(
              ref(fb.db!, `trips/${session.trip_id}/locations/${currentUserId}`),
              {
                lat,
                lng,
                updated_at,
              },
            );
          } catch {
            /* ignore */
          }
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 12000 },
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUserId, fb.db, session, effectiveStatus]);

  const stripMembers = useMemo(() => {
    const ids = Object.keys(profiles).length ? Object.keys(profiles) : [];
    if (ids.length) {
      return ids.map((uid) => ({
        user_id: uid,
        full_name: profiles[uid]?.full_name ?? null,
        avatar_url: profiles[uid]?.avatar_url ?? null,
      }));
    }
    if (activeTripMeta) {
      return activeTripMeta.members_preview.map((m) => ({
        user_id: m.user_id,
        full_name: null as string | null,
        avatar_url: m.avatar_url,
      }));
    }
    return [];
  }, [activeTripMeta, profiles]);

  async function beginSession(trip: UpcomingTrip) {
    try {
      const s = await apiFetch<LiveSession>(`/live/sessions`, {
        method: "POST",
        body: JSON.stringify({ trip_id: trip.trip_id }),
      });
      setSession(s);
      setActiveTripMeta(trip);
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Unable to create session");
    }
  }

  async function submitMeetPoint(lat: number, lng: number) {
    const suggested = "Gather here";
    const name =
      typeof window !== "undefined"
        ? window.prompt?.("Meet point name", suggested) ?? suggested
        : suggested;
    try {
      await apiFetch(`/live/trips/${session!.trip_id}/meet-point`, {
        method: "POST",
        body: JSON.stringify({ lat, lng, name }),
      });
    } catch {
      /* ignore */
    }
  }

  async function startTimerMinutes(minutesRaw: string) {
    const minutes = Math.max(1, Math.floor(Number(minutesRaw)));
    try {
      await apiFetch(`/trips/${session!.trip_id}/timer`, {
        method: "POST",
        body: JSON.stringify({ duration_seconds: Math.max(minutes * 60, 30) }),
      });
    } catch {
      /* ignore */
    }
  }

  async function notifyGroupFormationIfNeeded() {
    if (!session || formationNotifiedRef.current) return;

    const memberIds = stripMembers.map((m) => m.user_id).filter(Boolean);
    if (memberIds.length < 2) return;

    const pts: [number, number][] = [];
    memberIds.forEach((uid) => {
      const g = membersLocs[uid];
      if (
        g?.lat === null ||
        g?.lat === undefined ||
        g?.lng === null ||
        g?.lng === undefined
      )
        return;
      const age =
        typeof g.updated_at === "number"
          ? Date.now() / 1000 - g.updated_at
          : Infinity;
      if (age > 120) return;
      pts.push([g.lat, g.lng]);
    });

    if (pts.length !== memberIds.length || pts.length < 2) return;

    const rMax = session.meet_radius_meters;
    let okPair = true;
    for (let i = 0; i < pts.length && okPair; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = haversineM(pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
        if (d > rMax) okPair = false;
      }
    }
    if (!okPair) {
      setGroupTogether(false);
      return;
    }

    setGroupTogether(true);
    formationNotifiedRef.current = true;
    try {
      await apiFetch(`/live/sessions/${session.id}/group-formed`, {
        method: "POST",
      });
    } catch {
      formationNotifiedRef.current = false;
      setGroupTogether(false);
    }
  }

  useEffect(() => {
    if (effectiveStatus === "active") void notifyGroupFormationIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStatus, membersLocs, session?.id]);

  async function finishSession() {
    if (!session) return;
    try {
      await apiFetch(`/live/sessions/${session.id}/end`, { method: "POST" });
      setSession(null);
      setFbStatus(null);
      setActiveTripMeta(null);
      setProfiles({});
      formationNotifiedRef.current = false;
      timerDoneRef.current = false;
      setGroupTogether(false);
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Unable to end session");
    }
  }

  async function shareCode() {
    if (!session?.session_code) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/live?code=${encodeURIComponent(session.session_code)}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Travello Live",
          text: `Live session ${session.session_code}`,
          url,
        });
    } catch {
      /* noop */
    }
  }

  async function postChecklistCelebrate() {
    setConfettiBurst(true);
    window.setTimeout(() => setConfettiBurst(false), 2200);
    if (session) await hydrateSessionForTrip(session.trip_id, activeTripMeta);
  }

  const canStartLive = (role: string) =>
    role === "admin" || role === "coordinator";

  const canManageSession = activeTripMeta
    ? canStartLive(activeTripMeta.my_role)
    : false;

  const viewingSession = Boolean(session && activeTripMeta);
  const viewingPreLive =
    viewingSession && effectiveStatus !== "active";
  const viewingActive = viewingSession && effectiveStatus === "active";

  const bg = !viewingSession ? "bg-[#0b1426]" : "bg-[#050913]";

  return (
    <div className={`min-h-[100dvh] text-[#eaf0fc] ${bg}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(33,93,219,0.28),transparent_62%)] opacity-95" />

      {confettiBurst ? (
        <div className="pointer-events-none fixed inset-0 z-[5000] flex items-start justify-around overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={`conf-${i}`}
              className="mt-[-12vh] animate-bounce text-xl"
              style={{
                animationDuration: `${1.2 + (i % 6) * 0.12}s`,
                color: "#E94560",
              }}
              aria-hidden
            >
              🎉
            </span>
          ))}
        </div>
      ) : null}

      <LiveQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCode={(code) => {
          void joinBySessionCode(code);
        }}
      />

      <QuickStatusSheet
        tripId={session?.trip_id ?? null}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
      />

      <header className="sticky top-0 z-40 border-b border-[#173364]/80 bg-[#0b1426]/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-[#E94560]/60">
            <Zap className="h-7 w-7 text-amber-200" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Live Coordination</h1>
              {viewingActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/65 px-2 py-[2px] text-[11px] font-semibold uppercase text-emerald-200">
                  <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-red-400" />
                  Live
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[#8fa6d3] md:text-[13px]">
              Start a live session for your trip — share your code, align the crew, then open the map.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:py-12">
        {loadErr ? (
          <div className="rounded-2xl border border-red-900/75 bg-red-950/65 px-4 py-3 text-sm text-red-100">
            {loadErr}
          </div>
        ) : null}

        {!viewingSession ? (
          <>
            {!upcoming ? (
              <div className="flex flex-col gap-6">
                {[1, 2, 3].map((key) => (
                  <div
                    key={`sk-${key}`}
                    className="h-[120px] animate-pulse rounded-2xl border border-[#1f3a61] bg-[#0f1f44]/80"
                  />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-[#25407b] bg-[#0f1f44]/90 px-6 py-14 text-center">
                <div className="mb-5 text-6xl" aria-hidden>
                  🧭
                </div>
                <h2 className="text-xl font-semibold text-white">
                  Plan a trip first to go live
                </h2>
                <p className="mt-2 max-w-sm text-xs text-[#8fa6d3] md:text-[13px]">
                  Spin up a crew, pick dates, then return here — we&apos;ll sync checklists, timers, and GPS.
                </p>
                <Link
                  href="/trips"
                  className="mt-8 inline-flex items-center rounded-full px-8 py-3 text-sm font-bold shadow-lg"
                  style={{ backgroundColor: "#E94560", color: "#0b1426" }}
                >
                  Go to trips
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#25407b] pb-4">
                  <div>
                    <p className="text-lg font-semibold text-white md:text-xl">
                      Upcoming trips
                    </p>
                    <p className="mt-2 text-[13px] text-[#8fa6d3]">
                      Admins & coordinators can start live · everyone can scan to join.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    <ScanLine size={17} aria-hidden /> Join Session
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map((trip) => (
                    <div
                      key={trip.trip_id}
                      className="flex flex-col gap-5 rounded-[22px] border border-[#24407f] bg-gradient-to-br from-[#101f52] via-[#0f1f44] to-[#0b1426] p-6 shadow-xl"
                    >
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-white">{trip.title}</h3>
                        <p className="text-xs text-[#8fa6d3]">
                          {trip.destination_hint || "Destination TBD"} • {fmtDate(trip.start_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2 overflow-hidden rounded-full px-1">
                          {trip.members_preview.map((m, idx) =>
                            idx < 5 ? (
                              <span
                                key={`${trip.trip_id}-${m.user_id}`}
                                className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-[2px] border-[#081021] bg-[radial-gradient(circle,#2c4f9c,#081021)] text-xs font-semibold uppercase text-[#cae0ff]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {m.avatar_url ? (
                                  <img
                                    src={m.avatar_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  "?"
                                )}
                              </span>
                            ) : null,
                          )}
                        </div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#627bb3]">
                          {trip.member_count} members
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!canStartLive(trip.my_role)}
                          onClick={() => void beginSession(trip)}
                          className="rounded-full px-5 py-[10px] text-sm font-bold text-[#0b1426] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: "#E94560" }}
                        >
                          Start Live Session
                        </button>
                        <button
                          type="button"
                          onClick={() => void hydrateSessionForTrip(trip.trip_id, trip)}
                          className="rounded-full bg-white/10 px-5 py-[10px] text-sm font-semibold text-[#cae0ff] hover:bg-white/20"
                        >
                          Open ongoing session
                        </button>
                      </div>
                      {!canStartLive(trip.my_role) ? (
                        <p className="text-[11px] text-[#738cc4]">
                          Need coordinator access? Ask a group admin to promote you or start live for you.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {viewingSession && viewingPreLive && session && activeTripMeta && (
          <div className="grid gap-6 lg:grid-cols-[340px,minmax(0,1fr)]">
            <div className="space-y-6">
              <SessionQRCode
                tripTitle={activeTripMeta.title}
                sessionCode={session.session_code}
              />
              {!fb.ok ? (
                <div className="rounded-2xl border border-[#ffc107]/40 bg-amber-900/35 px-4 py-3 text-xs text-[#fde7b2]">
                  Firebase client offline — overlays wait until{" "}
                  <span className="font-mono">NEXT_PUBLIC_FIREBASE_*</span> vars load.
                </div>
              ) : (
                <p className="text-xs text-emerald-300/95">
                  Share this code with your group · checklist syncs instantly.
                </p>
              )}
              <LiveChecklistPanel
                firebaseDb={fb.db}
                sessionId={session.id}
                tripId={session.trip_id}
                members={stripMembers.map((m) => ({
                  user_id: m.user_id,
                  full_name: m.full_name,
                  avatar_url: m.avatar_url,
                  is_accepted: false,
                }))}
                currentUserId={currentUserId}
                onAcceptedAll={() => void postChecklistCelebrate()}
              />
            </div>
            <aside className="space-y-4 rounded-[28px] border border-[#24407f] bg-[#0f1f44]/70 p-5 text-[13px] text-[#cae0ff]">
              <h3 className="text-[15px] font-semibold text-white">While you wait</h3>
              <ol className="list-decimal space-y-3 pl-4 text-[#93aaeb] marker:text-[#E94560]">
                <li>Confirm everyone installed Travello notifications.</li>
                <li>Drop the meet pin early so arrivals badges stay truthful.</li>
                <li>Keep Location Services on before going active.</li>
              </ol>
            </aside>
          </div>
        )}

        {viewingSession && viewingActive && session && activeTripMeta ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#27447f] bg-[#0f1f44]/90 px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[#7391d9]">Trip</p>
                <p className="text-xl font-semibold">{activeTripMeta.title}</p>
              </div>
              <LiveTimer
                tripId={session.trip_id}
                firebaseDb={fb.db}
                onComplete={() => {
                  if (timerDoneRef.current) return;
                  timerDoneRef.current = true;
                  void apiFetch(`/live/trips/${session.trip_id}/timer-ended`, {
                    method: "POST",
                  });
                }}
              />
              {canManageSession ? (
                <button
                  type="button"
                  onClick={() => void finishSession()}
                  className="rounded-full border border-[#ffb4c9] px-5 py-[9px] text-sm font-semibold text-[#ffb7c8]"
                >
                  End Session
                </button>
              ) : (
                <p className="text-xs text-[#8fa6d3]">
                  Coordinators/admins manage session lifecycle.
                </p>
              )}
            </div>

            {groupTogether ? (
              <div className="rounded-2xl border border-emerald-500/65 bg-emerald-950/50 px-4 py-4 text-center text-sm font-semibold text-emerald-100 shadow-inner shadow-emerald-900">
                🎉 Group formed! Everyone is together (within{" "}
                {session.meet_radius_meters}m).
              </div>
            ) : null}

            <div className="relative">
              {!fb.ok ? (
                <p className="mb-2 text-xs text-amber-300">
                  Map needs Firebase credentials to stream pins.
                </p>
              ) : null}
              {pickingMeetPoint ? (
                <p className="mb-3 rounded-2xl border border-cyan-500/55 bg-[#073240]/90 px-4 py-3 text-[13px] text-cyan-50">
                  Tap anywhere on the map to drop your meet coordinate.
                </p>
              ) : null}

              <div
                className={
                  groupTogether
                    ? "rounded-[28px] ring-4 ring-emerald-400/80 ring-offset-2 ring-offset-[#050913] animate-pulse"
                    : ""
                }
              >
                <LiveMap
                  tripId={session.trip_id}
                  firebaseDb={fb.db}
                  members={stripMembers}
                  meetPoint={meetPoint}
                  pickingMeetPoint={pickingMeetPoint}
                  currentUserId={currentUserId}
                  onMapPick={(lat, lng) => {
                    setPickingMeetPoint(false);
                    void submitMeetPoint(lat, lng);
                  }}
                />
              </div>

              <div className="pointer-events-auto mt-5 flex gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]">
                {stripMembers.map((m) => (
                  <MemberStatusCard
                    key={`card-${m.user_id}`}
                    userId={m.user_id}
                    name={m.full_name ?? null}
                    avatarUrl={m.avatar_url ?? null}
                    lat={membersLocs[m.user_id]?.lat ?? null}
                    lng={membersLocs[m.user_id]?.lng ?? null}
                    updatedAt={
                      typeof membersLocs[m.user_id]?.updated_at === "number"
                        ? membersLocs[m.user_id]?.updated_at
                        : null
                    }
                    quickStatus={membersLocs[m.user_id]?.quick_status ?? null}
                    meetLat={meetPoint.lat}
                    meetLng={meetPoint.lng}
                    currentUser={m.user_id === currentUserId}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Controls sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[3600] border-t border-[#24407f] bg-[#0f1f44]/96 backdrop-blur transition-transform duration-300 md:left-[220px] ${
          controlsOpen ? "translate-y-0" : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto grid max-w-4xl gap-3 px-4 py-5 pb-[calc(24px+env(safe-area-inset-bottom))] md:grid-cols-2">
          <button
            type="button"
            className="inline-flex items-start gap-3 rounded-2xl border border-[#2d4ea3] px-5 py-[14px] text-left text-[13px] font-semibold"
            onClick={() => setPickingMeetPoint(true)}
          >
            <MapPin className="mt-1 h-5 w-5 text-emerald-200" aria-hidden />
            📍 Set meet point · tap anywhere on the map next
          </button>
          <button
            type="button"
            className="inline-flex items-start gap-3 rounded-2xl border border-[#2d4ea3] px-5 py-[14px] text-left text-[13px] font-semibold"
            onClick={() => {
              const m = window.prompt("Timer minutes?", "30");
              if (m !== null && session) void startTimerMinutes(m || "30");
            }}
          >
            ⏱️ Start countdown (bundled with Trip Timer API ≥30s)
          </button>
          <button
            type="button"
            className="inline-flex items-start gap-3 rounded-2xl border border-[#2d4ea3] px-5 py-[14px] text-left text-[13px] font-semibold"
            onClick={() => setQuickOpen(true)}
          >
            📢 Quick status pings
          </button>
          <button
            type="button"
            className="inline-flex items-start gap-3 rounded-2xl border border-[#2d4ea3] px-5 py-[14px] text-left text-[13px] font-semibold"
            onClick={() => void shareCode()}
          >
            <Share2 className="mt-1 h-5 w-5" aria-hidden />
            Share session QR link
          </button>
          <button
            type="button"
            className="col-span-full text-center text-xs text-[#7d92c7] underline"
            onClick={() => setControlsOpen(false)}
          >
            Close controls
          </button>
        </div>
      </div>

      {viewingActive ? (
        <button
          type="button"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+112px)] right-6 z-[3500] flex h-14 w-14 items-center justify-center rounded-full border border-[#3b5cbf] bg-[#E94560] shadow-2xl md:bottom-[48px]"
          aria-label="Open live controls"
          onClick={() => setControlsOpen((v) => !v)}
          style={{ color: "#0b1426" }}
        >
          <Layers className="h-7 w-7" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
