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
import {
  Zap,
  MapPin,
  ScanLine,
  Layers,
  Share2,
  AlertOctagon,
  Compass,
  CheckCircle2,
  Plus,
  Navigation,
  X,
  Search,
  ChevronUp,
  Map as MapIcon,
  Bell,
  Clock,
  LogOut,
  Users
} from "lucide-react";
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
  mode?: string;
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

  // Navigation & Control States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [pickingMeetPoint, setPickingMeetPoint] = useState(false);
  const [mapStyle, setMapStyle] = useState<"standard" | "satellite" | "night">("standard");
  const [centerOverride, setCenterOverride] = useState<[number, number] | undefined>(undefined);

  // Bottom Sheet State
  const [sheetState, setSheetState] = useState<"peek" | "half" | "full">("peek");

  // Activity Feed & Toasts
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  // Solo mode Route states
  const [destinationSearch, setDestinationSearch] = useState("");
  const [destSearchResults, setDestSearchResults] = useState<any[]>([]);
  const [destinationMeta, setDestinationMeta] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | undefined>(undefined);

  // Ad-hoc Trip Creation Modal
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocTripName, setAdHocTripName] = useState("");
  const [adHocDestination, setAdHocDestination] = useState("");
  const [adHocMode, setAdHocMode] = useState<"SOLO" | "GROUP">("GROUP");
  const [isCreatingAdHoc, setIsCreatingAdHoc] = useState(false);

  // SOS States
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [isSendingSos, setIsSendingSos] = useState(false);

  // Timeline State
  const [livePlan, setLivePlan] = useState<any[]>([]);
  const [newStopDesc, setNewStopDesc] = useState("");
  const [newStopTime, setNewStopTime] = useState("12:00");
  const [isAddingStop, setIsAddingStop] = useState(false);

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

  // Load Map Style Preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rovvy_map_style");
      if (saved === "standard" || saved === "satellite" || saved === "night") {
        setMapStyle(saved);
      }
    }
  }, []);

  // Show dynamic toast
  const showToast = (text: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

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

  // Fetch Timeline Stops from Plan Backend
  const fetchLivePlan = useCallback(async () => {
    if (!session?.trip_id) return;
    try {
      const res = await apiFetch<any[]>(`/trips/${session.trip_id}/live-plan`);
      setLivePlan(res || []);
    } catch (err) {
      console.error("Failed to fetch live plan:", err);
    }
  }, [session?.trip_id]);

  useEffect(() => {
    if (session?.trip_id) {
      void fetchLivePlan();
    }
  }, [session?.trip_id, fetchLivePlan]);

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

  // Listen to Activity Feed events in Firebase RTDB
  useEffect(() => {
    if (!fb.db || !session?.trip_id) return undefined;
    const feedRef = ref(fb.db, `trips/${session.trip_id}/activity_feed`);
    const startTimestamp = Date.now();

    const off = onValue(feedRef, (snap) => {
      const val = snap.val();
      if (!val) return;

      const items = Object.entries(val).map(([id, item]: [string, any]) => ({
        id,
        text: item.text,
        timestamp: item.timestamp,
      }));

      // Filter for events that happened after connection/load
      const newItems = items.filter((item) => item.timestamp >= startTimestamp - 5000);
      if (newItems.length > 0) {
        const latest = newItems.sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latest) {
          showToast(latest.text);
        }
      }
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

  // Sync Route Line dynamically when current user coordinates change
  useEffect(() => {
    const myLoc = currentUserId ? membersLocs[currentUserId] : null;
    if (myLoc?.lat && myLoc?.lng && destinationMeta) {
      setRouteLine([[myLoc.lat, myLoc.lng], [destinationMeta.lat, destinationMeta.lng]]);
    }
  }, [membersLocs, currentUserId, destinationMeta]);

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
      setRouteLine(undefined);
      setDestinationMeta(null);
      setDestinationSearch("");
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
          title: "Rovvy Live",
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

  // Ad-hoc creation workflow
  const handleGoLive = async () => {
    if (!adHocTripName.trim()) {
      alert("Please enter a trip name");
      return;
    }
    setIsCreatingAdHoc(true);
    try {
      const token = getToken();

      // 1. Create a default casual group
      const group = await apiFetch<any>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: `${adHocTripName} Crew`,
          group_type: "casual",
          default_currency: "USD"
        }),
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // 2. Create the trip inside group
      const trip = await apiFetch<any>(`/groups/${group.id}/trips`, {
        method: "POST",
        body: JSON.stringify({
          title: adHocTripName,
          description: adHocDestination || "Ad-hoc live coordination"
        }),
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // 3. Start Live Session with mode selection
      const s = await apiFetch<LiveSession>("/live/sessions", {
        method: "POST",
        body: JSON.stringify({
          trip_id: trip.id,
          mode: adHocMode
        }),
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setSession(s);
      formationNotifiedRef.current = false;
      timerDoneRef.current = false;
      setGroupTogether(false);

      const tripMeta: UpcomingTrip = {
        trip_id: trip.id,
        title: trip.title,
        destination_hint: trip.description,
        start_date: new Date().toISOString(),
        end_date: null,
        group_id: group.id,
        member_count: 1,
        members_preview: [{ user_id: currentUserId || "", avatar_url: null }],
        my_role: "admin"
      };

      setActiveTripMeta(tripMeta);
      setShowAdHocModal(false);
      setAdHocTripName("");

      // Set destination search input if provided
      if (adHocDestination.trim()) {
        setDestinationSearch(adHocDestination);
        // Geocode the destination hint
        try {
          const res = await apiFetch<any[]>(`/geocoding/search?q=${encodeURIComponent(adHocDestination)}`);
          if (res && res.length > 0) {
            handleSelectDestination(res[0]);
          }
        } catch (err) {
          console.error("Ad-hoc destination geocode failed:", err);
        }
      }

      showToast(`Live session started in ${adHocMode} mode!`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to start live session");
    } finally {
      setIsCreatingAdHoc(false);
    }
  };

  // Solo mode destination search
  const handleSearchDestination = async (q: string) => {
    setDestinationSearch(q);
    if (q.trim().length < 2) {
      setDestSearchResults([]);
      return;
    }
    try {
      const res = await apiFetch<any[]>(`/geocoding/search?q=${encodeURIComponent(q)}`);
      setDestSearchResults(res || []);
    } catch (err) {
      console.error("Destination search failed:", err);
    }
  };

  const handleSelectDestination = (item: any) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    const name = item.display_name.split(",")[0] || "Destination";
    setDestinationMeta({ lat, lng, name });
    setDestinationSearch(name);
    setDestSearchResults([]);

    const myLoc = currentUserId ? membersLocs[currentUserId] : null;
    if (myLoc?.lat && myLoc?.lng) {
      setRouteLine([[myLoc.lat, myLoc.lng], [lat, lng]]);
      const dist = haversineM(myLoc.lat, myLoc.lng, lat, lng);
      const mins = Math.round(dist / 666.67);
      showToast(`Route set to ${name}. ETA: ${mins} mins`);
      setCenterOverride([lat, lng]);
    } else {
      showToast(`Destination set to ${name}`);
    }
  };

  // Wayra Context Suggestions (Solo Mode)
  const handleWayraSuggestion = (suggestion: string) => {
    const myLoc = currentUserId ? membersLocs[currentUserId] : null;
    if (!myLoc?.lat || !myLoc?.lng) {
      showToast("Waiting for your GPS location...");
      return;
    }

    let destName = "";
    let destLat = 0;
    let destLng = 0;

    if (suggestion === "Find food near me") {
      destName = "Wayra Diner";
      destLat = myLoc.lat + 0.008;
      destLng = myLoc.lng + 0.007;
    } else if (suggestion === "Nearest gas") {
      destName = "Wayra Gas Station";
      destLat = myLoc.lat - 0.006;
      destLng = myLoc.lng + 0.009;
    } else {
      destName = "Wayra Stop";
      destLat = myLoc.lat + 0.005;
      destLng = myLoc.lng - 0.005;
    }

    setDestinationMeta({ lat: destLat, lng: destLng, name: destName });
    setRouteLine([[myLoc.lat, myLoc.lng], [destLat, destLng]]);
    const dist = haversineM(myLoc.lat, myLoc.lng, destLat, destLng);
    const mins = Math.round(dist / 666.67);
    showToast(`Wayra found a stop: ${destName} (${(dist / 1000).toFixed(1)} km, ETA ${mins} mins)`);
    setCenterOverride([destLat, destLng]);
  };

  // SOS Execution
  const triggerEmergencySos = async () => {
    if (!session?.trip_id) return;
    const myLoc = currentUserId ? membersLocs[currentUserId] : null;
    const latitude = myLoc?.lat ?? 0.0;
    const longitude = myLoc?.lng ?? 0.0;

    setIsSendingSos(true);
    try {
      await apiFetch(`/trips/${session.trip_id}/sos`, {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
      });
      const memberCount = stripMembers.length || 1;
      showToast(`Emergency alert broadcast to ${memberCount} group members!`);
      setShowSosConfirm(false);
    } catch (err: any) {
      console.error("SOS trigger failed:", err);
      alert("Failed to send SOS: " + (err.message || "Unknown error"));
    } finally {
      setIsSendingSos(false);
    }
  };

  // Timeline Stop Addition
  const handleAddStop = async () => {
    if (!session?.trip_id || !newStopDesc.trim()) return;
    setIsAddingStop(true);
    try {
      // Structure the full payload days list for get_live_plan compatibility
      let days = [...livePlan];
      if (days.length === 0) {
        days = [{ day_number: 1, date: null, destination: null, departure_time: null, activities: [] }];
      }
      const newActivity = { time: newStopTime, description: newStopDesc, status: "upcoming" };
      const firstDay = { ...days[0] };
      firstDay.activities = [...(firstDay.activities || []), newActivity];
      // Sort activities by time
      firstDay.activities.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
      days[0] = firstDay;

      await apiFetch(`/trips/${session.trip_id}/live-plan`, {
        method: "POST",
        body: JSON.stringify({ days }),
      });
      setNewStopDesc("");
      void fetchLivePlan();
      showToast("Stop added to timeline successfully");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to add stop: " + err.message);
    } finally {
      setIsAddingStop(false);
    }
  };

  // Compute status based on current time
  const getActivityStatus = (timeStr: string | null | undefined, nextTimeStr: string | null | undefined) => {
    if (!timeStr) return "upcoming";
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "upcoming";
    const stopMinutes = h * 60 + m;

    if (currentMinutes < stopMinutes) {
      return "upcoming";
    }

    if (nextTimeStr) {
      const [nh, nm] = nextTimeStr.split(":").map(Number);
      if (!isNaN(nh) && !isNaN(nm)) {
        const nextStopMinutes = nh * 60 + nm;
        if (currentMinutes >= stopMinutes && currentMinutes < nextStopMinutes) {
          return "in_progress";
        }
      }
    } else if (currentMinutes >= stopMinutes) {
      return "completed";
    }
    return "completed";
  };

  const cycleMapStyle = () => {
    const styles: ("standard" | "satellite" | "night")[] = ["standard", "satellite", "night"];
    const nextIdx = (styles.indexOf(mapStyle) + 1) % styles.length;
    const nextStyle = styles[nextIdx];
    setMapStyle(nextStyle);
    localStorage.setItem("rovvy_map_style", nextStyle);
    showToast(`Map style switched to ${nextStyle}`);
  };

  const canStartLive = (role: string) => role === "admin" || role === "coordinator";
  const canManageSession = activeTripMeta ? canStartLive(activeTripMeta.my_role) : false;

  const viewingSession = Boolean(session && activeTripMeta);
  const viewingPreLive = viewingSession && effectiveStatus !== "active";
  const viewingActive = viewingSession && effectiveStatus === "active";

  const isSoloMode = session?.mode === "SOLO";

  // Calculate coordinates centroid for members
  const groupCentroid = useMemo((): { lat: number; lng: number } | null => {
    const pts = Object.values(membersLocs).filter((l) => l.lat && l.lng);
    if (pts.length === 0) return null;
    const latSum = pts.reduce((acc, p) => acc + (p.lat || 0), 0);
    const lngSum = pts.reduce((acc, p) => acc + (p.lng || 0), 0);
    return { lat: latSum / pts.length, lng: lngSum / pts.length };
  }, [membersLocs]);

  // Compute active member details with ETAs
  const membersWithEta = useMemo(() => {
    return stripMembers.map((m) => {
      const loc = membersLocs[m.user_id];
      let etaStr = "";
      let distStr = "";
      let isStale = false;

      if (loc?.lat && loc?.lng) {
        // Stale check (120 seconds)
        const updatedTime = loc.updated_at || 0;
        const elapsed = Math.floor(Date.now() / 1000) - updatedTime;
        isStale = elapsed > 120;

        if (isStale) {
          const mins = Math.max(1, Math.round(elapsed / 60));
          distStr = `Last seen ${mins}m ago`;
        } else {
          // Calculate distance to meet point
          if (meetPoint.lat && meetPoint.lng) {
            const dist = haversineM(loc.lat, loc.lng, meetPoint.lat, meetPoint.lng);
            if (dist <= 100) {
              etaStr = "Arrived";
            } else {
              const minutes = Math.round(dist / 666.67); // 40km/h driving
              etaStr = `ETA ${minutes}m`;
            }
            distStr = `${(dist / 1000).toFixed(1)} km`;
          } else if (groupCentroid) {
            // Distance to group centroid
            const dist = haversineM(loc.lat, loc.lng, groupCentroid.lat, groupCentroid.lng);
            etaStr = `${Math.round(dist / 666.67)}m to centroid`;
            distStr = `${(dist / 1000).toFixed(1)} km`;
          }
        }
      } else {
        distStr = "No GPS signal";
      }

      return {
        ...m,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        quick_status: loc?.quick_status ?? null,
        updatedAt: loc?.updated_at ?? null,
        eta: etaStr,
        distance: distStr,
        isStale,
      };
    });
  }, [stripMembers, membersLocs, meetPoint, groupCentroid]);

  // Flat list of stops sorted by time
  const timelineStops = useMemo(() => {
    if (livePlan.length === 0) return [];
    // Accumulate all activities from all days
    const stops: any[] = [];
    livePlan.forEach((day: any) => {
      if (day.activities) {
        day.activities.forEach((act: any) => {
          stops.push(act);
        });
      }
    });
    return stops.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [livePlan]);

  return (
    <div className="relative min-h-[100dvh] w-full select-none overflow-hidden bg-[#090f1d] text-slate-100 font-sans">
      {/* 1. Pre-Session State Dashboard */}
      {!viewingSession && (
        <div className="min-h-screen w-full flex flex-col">
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.25),transparent_65%)]" />

          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#090f1d]/90 px-6 py-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 ring-2 ring-teal-500/40">
                  <Zap className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-100">Rovvy Live</h1>
                  <p className="text-xs text-slate-400">Real-time trip coordination dashboard</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdHocModal(true)}
                  className="rounded-full bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-teal-950/45 flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={2.5} /> Start New Live Trip
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <ScanLine size={14} /> Join Session
                </button>
              </div>
            </div>
          </header>

          {/* Main Pre-session Content */}
          <main className="mx-auto max-w-6xl w-full flex-1 px-6 py-8 flex flex-col justify-center">
            {loadErr && (
              <div className="mb-6 rounded-2xl border border-red-900/50 bg-red-950/45 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
                <AlertOctagon size={16} className="text-red-400" />
                {loadErr}
              </div>
            )}

            {!upcoming ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((key) => (
                  <div
                    key={`sk-${key}`}
                    className="h-[180px] animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60"
                  />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-slate-800 bg-slate-900/40 px-6 py-16 text-center max-w-md mx-auto shadow-2xl backdrop-blur-sm">
                <div className="mb-5 text-5xl">🧭</div>
                <h2 className="text-lg font-black text-slate-200">No active trips planned</h2>
                <p className="mt-2 text-xs text-slate-400">
                  Plan a trip with your crew to access real-time coordination tools, checklists, and ETAs.
                </p>
                <Link
                  href="/trips"
                  className="mt-6 rounded-full bg-teal-600 hover:bg-teal-500 px-6 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-teal-950/45"
                >
                  Create Trip Plan
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-teal-500">Upcoming Trip Sessions</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {upcoming.map((trip) => (
                    <div
                      key={trip.trip_id}
                      className="group flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/50 p-6 hover:border-teal-500/40 transition-all shadow-lg backdrop-blur-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-black text-slate-100 leading-tight group-hover:text-teal-400 transition-colors">
                            {trip.title}
                          </h3>
                          <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                            {trip.my_role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={12} className="text-teal-500" />
                          {trip.destination_hint || "Destination TBD"} • {fmtDate(trip.start_date)}
                        </p>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2 overflow-hidden rounded-full">
                            {trip.members_preview.map((m, idx) =>
                              idx < 4 ? (
                                <span
                                  key={`${trip.trip_id}-${m.user_id}`}
                                  className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-slate-900 bg-slate-800 text-[10px] font-bold text-slate-300"
                                >
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    "?"
                                  )}
                                </span>
                              ) : null
                            )}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            {trip.member_count} Members
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void hydrateSessionForTrip(trip.trip_id, trip)}
                            className="rounded-full bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition-all border border-slate-700"
                          >
                            Open Live
                          </button>
                          <button
                            type="button"
                            disabled={!canStartLive(trip.my_role)}
                            onClick={() => void beginSession(trip)}
                            className="rounded-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-teal-950/45"
                          >
                            Go Live
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* 2. Fullscreen Active Coordination Experience */}
      {viewingSession && (
        <div className="relative h-screen w-full overflow-hidden select-none">
          {/* Main Fullscreen Map Background */}
          <div className="absolute inset-0 z-0">
            <LiveMap
              tripId={session!.trip_id}
              firebaseDb={fb.db}
              members={viewingActive ? membersWithEta : []}
              meetPoint={meetPoint}
              pickingMeetPoint={pickingMeetPoint}
              currentUserId={currentUserId}
              style={mapStyle}
              routeLine={routeLine}
              centerOverride={centerOverride}
              onMapPick={(lat, lng) => {
                setPickingMeetPoint(false);
                void submitMeetPoint(lat, lng);
              }}
            />
          </div>

          {/* Floating UI Elements Overlay */}

          {/* A. Dynamic Toasts / Activity Feed (Top Left) */}
          <div className="fixed top-20 left-4 z-[4200] flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="animate-slide-in flex items-center gap-2 rounded-2xl bg-slate-900/90 border border-slate-800 px-4 py-2.5 shadow-2xl backdrop-blur-md text-xs font-semibold text-slate-100"
              >
                <div className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                <p>{toast.text}</p>
              </div>
            ))}
          </div>

          {/* B. Floating TOP BAR */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[4000] w-[90%] max-w-lg">
            <div className="flex items-center justify-between gap-4 rounded-full border border-slate-800/80 bg-slate-950/90 px-5 py-2.5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-950/60 px-2 py-0.5 text-[9px] font-bold text-red-200 uppercase tracking-widest animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Live
                </span>
                <h2 className="text-xs font-black truncate text-slate-100">
                  {isSoloMode ? `Solo: ${activeTripMeta!.title}` : activeTripMeta!.title}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <LiveTimer tripId={session!.trip_id} firebaseDb={fb.db} />

                {/* End Button */}
                {(canManageSession || isSoloMode) && (
                  <button
                    type="button"
                    onClick={() => void finishSession()}
                    className="rounded-full bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/25 px-2.5 py-1 text-[10px] font-bold transition-all"
                  >
                    End
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* C. Pre-live checklist centered screen overlay (if not active yet) */}
          {viewingPreLive && (
            <div className="absolute inset-0 z-[3800] bg-slate-950/80 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 mb-2">
                    <Users size={24} />
                  </div>
                  <h3 className="text-lg font-black text-slate-100">Checklist Ready System</h3>
                  <p className="text-xs text-slate-400">
                    Align your coordinates and accept the checklist to launch the live map.
                  </p>
                </div>

                <SessionQRCode
                  tripTitle={activeTripMeta!.title}
                  sessionCode={session!.session_code}
                />

                <LiveChecklistPanel
                  firebaseDb={fb.db}
                  sessionId={session!.id}
                  tripId={session!.trip_id}
                  members={stripMembers.map((m) => ({
                    user_id: m.user_id,
                    full_name: m.full_name,
                    avatar_url: m.avatar_url,
                    is_accepted: false,
                  }))}
                  currentUserId={currentUserId}
                  onAcceptedAll={() => void postChecklistCelebrate()}
                />

                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => void finishSession()}
                    className="rounded-full bg-slate-800 text-slate-300 px-5 py-2 text-xs font-bold"
                  >
                    Cancel Session
                  </button>
                  <button
                    onClick={() => void shareCode()}
                    className="rounded-full bg-teal-600 text-white px-5 py-2 text-xs font-bold flex items-center gap-1"
                  >
                    <Share2 size={13} /> Share Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* D. Group together celebration banner */}
          {viewingActive && groupTogether && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3900] w-[90%] max-w-sm">
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-2.5 text-center text-xs font-bold text-emerald-100 shadow-2xl backdrop-blur-md flex items-center justify-center gap-2">
                <span>🎉</span>
                <p>Group Formed! Everyone is close within {session!.meet_radius_meters}m.</p>
              </div>
            </div>
          )}

          {/* E. Floating Action Button Stack (Right Side) */}
          {viewingActive && (
            <div className="fixed bottom-36 right-4 z-[3500] flex flex-col gap-3">
              {/* SOS Button */}
              <button
                type="button"
                onClick={() => setShowSosConfirm(true)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-all border border-red-500/40 active:scale-95 cursor-pointer"
                title="Emergency SOS"
              >
                <AlertOctagon size={24} className="animate-pulse" />
              </button>

              {/* Map Style Switcher */}
              <button
                type="button"
                onClick={cycleMapStyle}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white shadow-lg backdrop-blur-md transition-all cursor-pointer"
                title="Change Map Style"
              >
                <Layers size={18} />
              </button>

              {/* Meet Point Pin (Group Mode Only) */}
              {!isSoloMode && (
                <button
                  type="button"
                  onClick={() => setPickingMeetPoint((prev) => !prev)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                    pickingMeetPoint
                      ? "bg-teal-500 border-teal-400 text-white"
                      : "bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white"
                  }`}
                  title="Drop Meet Point"
                >
                  <MapPin size={18} />
                </button>
              )}

              {/* Quick Status */}
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white shadow-lg backdrop-blur-md transition-all cursor-pointer"
                title="Quick Status"
              >
                <Bell size={18} />
              </button>
            </div>
          )}

          {/* F. Multi-State Coordination Bottom Sheet */}
          {viewingActive && (
            <div
              className={`fixed inset-x-0 bottom-0 z-[3600] flex justify-center transition-all duration-300`}
              style={{
                height: sheetState === "peek" ? "130px" : sheetState === "half" ? "42vh" : "80vh",
              }}
            >
              <div className="w-full max-w-lg bg-slate-950/96 backdrop-blur-lg border-t border-slate-800/80 rounded-t-[28px] shadow-2xl flex flex-col overflow-hidden">
                {/* Drag Handle Indicator */}
                <div
                  className="h-7 w-full shrink-0 flex items-center justify-center cursor-pointer group"
                  onClick={() => {
                    if (sheetState === "peek") setSheetState("half");
                    else if (sheetState === "half") setSheetState("full");
                    else setSheetState("peek");
                  }}
                >
                  <div className="w-12 h-1.5 bg-slate-800 group-hover:bg-slate-700 rounded-full transition-all" />
                </div>

                {/* Toggle state indicator row */}
                <div className="px-5 pb-2 shrink-0 flex justify-between items-center border-b border-slate-900">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSheetState("peek")}
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        sheetState === "peek" ? "bg-teal-950 border border-teal-500/30 text-teal-400" : "text-slate-500"
                      }`}
                    >
                      Peek
                    </button>
                    <button
                      onClick={() => setSheetState("half")}
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        sheetState === "half" ? "bg-teal-950 border border-teal-500/30 text-teal-400" : "text-slate-500"
                      }`}
                    >
                      Status
                    </button>
                    <button
                      onClick={() => setSheetState("full")}
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        sheetState === "full" ? "bg-teal-950 border border-teal-500/30 text-teal-400" : "text-slate-500"
                      }`}
                    >
                      Timeline
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    Swipe up for stops
                  </span>
                </div>

                {/* Sheet Body Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 pb-12">
                  {/* PEEK STATE */}
                  {sheetState === "peek" && (
                    <div className="space-y-4">
                      {isSoloMode ? (
                        /* Solo Mode Peek Quick Tools */
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase text-teal-500 tracking-wider">Wayra Assistant</p>
                            <p className="text-xs text-slate-300 font-medium truncate">
                              {destinationMeta ? `Navigating to ${destinationMeta.name}` : "Search a destination to set route line"}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleWayraSuggestion("Find food near me")}
                              className="rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold px-3 py-1.5 hover:bg-slate-800 text-slate-300"
                            >
                              🍔 Food
                            </button>
                            <button
                              onClick={() => handleWayraSuggestion("Nearest gas")}
                              className="rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold px-3 py-1.5 hover:bg-slate-800 text-slate-300"
                            >
                              ⛽ Gas
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Group Mode Member Avatars + Info */
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {membersWithEta.map((m) => (
                                <span
                                  key={`peek-avatar-${m.user_id}`}
                                  className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-950 bg-slate-800 text-[10px] font-black uppercase ${
                                    m.isStale ? "brightness-50" : ""
                                  }`}
                                  title={m.full_name || "Member"}
                                >
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    (m.full_name || "?")[0]
                                  )}
                                </span>
                              ))}
                            </div>
                            <span className="text-[11px] font-bold text-slate-400">
                              {membersWithEta.length} Member{membersWithEta.length !== 1 ? "s" : ""} Live
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setQuickOpen(true)}
                              className="rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold px-3 py-1.5 text-slate-300 flex items-center gap-1"
                            >
                              📢 Status
                            </button>
                            <button
                              onClick={() => void shareCode()}
                              className="rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold px-3 py-1.5 text-slate-300 flex items-center gap-1"
                            >
                              <Share2 size={10} /> Invite
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* HALF STATE */}
                  {sheetState === "half" && (
                    <div className="space-y-4">
                      {isSoloMode ? (
                        /* Solo Mode Route Input & Wayra Suggestions */
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Destination</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={destinationSearch}
                                onChange={(e) => void handleSearchDestination(e.target.value)}
                                placeholder="Type stop or city name..."
                                className="w-full rounded-2xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                              />
                              <Search className="absolute right-4 top-3 h-4 w-4 text-slate-500" />
                            </div>

                            {/* Autocomplete suggestions */}
                            {destSearchResults.length > 0 && (
                              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden divide-y divide-slate-800 max-h-40 overflow-y-auto">
                                {destSearchResults.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectDestination(item)}
                                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-slate-850 text-slate-300 hover:text-white truncate"
                                  >
                                    {item.display_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Wayra AI Assistant Suggestions</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleWayraSuggestion("Find food near me")}
                                className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 p-3 hover:bg-slate-850 text-left space-y-1"
                              >
                                <span className="text-sm">🍔</span>
                                <h4 className="text-xs font-bold text-slate-200">Find food near me</h4>
                                <p className="text-[10px] text-slate-500 leading-tight">Find gas & diners along your track</p>
                              </button>
                              <button
                                onClick={() => handleWayraSuggestion("Nearest gas")}
                                className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 p-3 hover:bg-slate-850 text-left space-y-1"
                              >
                                <span className="text-sm">⛽</span>
                                <h4 className="text-xs font-bold text-slate-200">Nearest gas</h4>
                                <p className="text-[10px] text-slate-500 leading-tight">Quick gas check stops near you</p>
                              </button>
                            </div>
                          </div>

                          {destinationMeta && (
                            <div className="rounded-2xl bg-teal-950/30 border border-teal-500/20 p-3 flex justify-between items-center">
                              <div>
                                <h4 className="text-xs font-bold text-teal-400">{destinationMeta.name}</h4>
                                <p className="text-[10px] text-slate-400">Route drawn on map</p>
                              </div>

                              <button
                                onClick={() => {
                                  setDestinationMeta(null);
                                  setRouteLine(undefined);
                                  setDestinationSearch("");
                                }}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Group Mode Member ETAs & Statuses */
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Member ETAs</span>
                            {meetPoint.lat && meetPoint.lng ? (
                              <span className="text-[10px] text-teal-500 font-bold flex items-center gap-0.5">
                                <MapPin size={10} /> Meet Point: {meetPoint.name || "Gather here"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-500 font-bold">
                                No Meet Point Set (showing centroid distance)
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 max-h-[25vh] overflow-y-auto">
                            {membersWithEta.map((m) => (
                              <div
                                key={m.user_id}
                                className="flex items-center justify-between rounded-2xl bg-slate-900/60 border border-slate-900 p-3 hover:border-slate-800 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="relative h-8 w-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-xs font-black uppercase">
                                    {m.avatar_url ? (
                                      <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      (m.full_name || "?")[0]
                                    )}
                                  </span>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-200">{m.full_name || "Traveler"}</h4>
                                    <p className="text-[10px] text-slate-500">{m.quick_status || "On Track"}</p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <p className="text-xs font-black text-teal-400">{m.eta || "calculating..."}</p>
                                  <p className="text-[9px] text-slate-500">{m.distance}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FULL STATE */}
                  {sheetState === "full" && (
                    <div className="space-y-5">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h3 className="text-xs font-black uppercase tracking-widest text-teal-500">Trip stops timeline</h3>
                        <span className="text-[10px] text-slate-500 font-bold">{timelineStops.length} stops scheduled</span>
                      </div>

                      {/* Stops Timeline List */}
                      {timelineStops.length === 0 ? (
                        <div className="text-center py-8 space-y-2">
                          <p className="text-xs text-slate-500">No stops scheduled in the timeline yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-850">
                          {timelineStops.map((stop, idx) => {
                            const nextStop = timelineStops[idx + 1];
                            const status = getActivityStatus(stop.time, nextStop?.time);

                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  // Center override if lat/lng is mock or stored
                                  if (stop.lat && stop.lng) {
                                    setCenterOverride([Number(stop.lat), Number(stop.lng)]);
                                    showToast(`Centering map on ${stop.description}`);
                                  }
                                }}
                                className="relative flex gap-4 pl-8 group cursor-pointer"
                              >
                                {/* Time/Status Indicator Dot */}
                                <div
                                  className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-slate-950 transition-all ${
                                    status === "completed"
                                      ? "bg-teal-500"
                                      : status === "in_progress"
                                        ? "bg-amber-500 animate-pulse"
                                        : "bg-slate-800"
                                  }`}
                                />

                                <div className="flex-1 rounded-2xl bg-slate-900/40 border border-slate-900 p-3 hover:border-slate-800 transition-all">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-xs font-bold text-slate-200">{stop.description}</p>
                                      <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                        <Clock size={10} /> {stop.time || "No schedule"}
                                      </span>
                                    </div>

                                    <span
                                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        status === "completed"
                                          ? "bg-teal-950 text-teal-400 border border-teal-500/20"
                                          : status === "in_progress"
                                            ? "bg-amber-950 text-amber-400 border border-amber-500/20"
                                            : "bg-slate-850 text-slate-500"
                                      }`}
                                    >
                                      {status === "completed" ? "Completed ✓" : status === "in_progress" ? "In Progress →" : "Upcoming"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add stop timeline form (Admin Only) */}
                      {(canManageSession || isSoloMode) && (
                        <div className="rounded-3xl border border-slate-900 bg-slate-900/20 p-4 space-y-3 mt-6">
                          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Add stop (Admin)</h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newStopDesc}
                              onChange={(e) => setNewStopDesc(e.target.value)}
                              placeholder="Stop name (e.g. Navy Pier)"
                              className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none"
                            />
                            <input
                              type="time"
                              value={newStopTime}
                              onChange={(e) => setNewStopTime(e.target.value)}
                              className="w-20 rounded-xl bg-slate-900 border border-slate-800 px-2 py-2 text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddStop}
                              disabled={isAddingStop}
                              className="rounded-xl bg-teal-600 hover:bg-teal-500 px-3 text-xs font-bold text-white transition-all disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* G. SOS Confirmation Modal Overlay */}
          {showSosConfirm && (
            <div className="fixed inset-0 z-[5500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="w-full max-w-sm rounded-[28px] border border-red-500/20 bg-slate-900 p-6 shadow-2xl text-center space-y-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500 ring-4 ring-red-500/20">
                  <AlertOctagon size={28} className="animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-100 uppercase tracking-wide">Confirm SOS broadcast</h3>
                  <p className="text-xs text-slate-400 leading-normal">
                    This will send a priority emergency alert containing your current GPS location to all crew members and emergency contacts.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSosConfirm(false)}
                    className="flex-1 rounded-full bg-slate-800 hover:bg-slate-700 py-3 text-xs font-bold text-slate-300 transition-all border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={triggerEmergencySos}
                    disabled={isSendingSos}
                    className="flex-1 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 py-3 text-xs font-bold text-white transition-all shadow-lg shadow-red-950/50"
                  >
                    {isSendingSos ? "Broadcasting..." : "Confirm SOS"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Ad-hoc Live Session Creation Modal */}
      {showAdHocModal && (
        <div className="fixed inset-0 z-[5200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-teal-500">Go Live Directly</h3>
              <button
                type="button"
                onClick={() => setShowAdHocModal(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Trip Name</label>
                <input
                  type="text"
                  value={adHocTripName}
                  onChange={(e) => setAdHocTripName(e.target.value)}
                  placeholder="e.g. Chicago Roadtrip"
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Destination</label>
                <input
                  type="text"
                  value={adHocDestination}
                  onChange={(e) => setAdHocDestination(e.target.value)}
                  placeholder="e.g. Navy Pier"
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Mode Selection</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdHocMode("SOLO")}
                    className={`rounded-2xl border p-4 text-left space-y-1 cursor-pointer transition-all ${
                      adHocMode === "SOLO"
                        ? "bg-teal-950/40 border-teal-500 text-teal-400"
                        : "bg-slate-950 border-slate-800 hover:border-slate-750 text-slate-400"
                    }`}
                  >
                    <Compass size={18} />
                    <h4 className="text-xs font-bold">Solo Mode</h4>
                    <p className="text-[10px] text-slate-500 leading-tight">Wayra AI routing & search help</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdHocMode("GROUP")}
                    className={`rounded-2xl border p-4 text-left space-y-1 cursor-pointer transition-all ${
                      adHocMode === "GROUP"
                        ? "bg-teal-950/40 border-teal-500 text-teal-400"
                        : "bg-slate-950 border-slate-800 hover:border-slate-750 text-slate-400"
                    }`}
                  >
                    <Users size={18} />
                    <h4 className="text-xs font-bold">Group Mode</h4>
                    <p className="text-[10px] text-slate-500 leading-tight">Sync checkpoints & map crew</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoLive}
                disabled={isCreatingAdHoc}
                className="w-full rounded-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 py-3 text-xs font-black uppercase tracking-wider text-white transition-all shadow-md shadow-teal-950/50"
              >
                {isCreatingAdHoc ? "Initializing Live..." : "Go Live Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist success confetti */}
      {confettiBurst && (
        <div className="pointer-events-none fixed inset-0 z-[5000] flex items-start justify-around overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={`conf-${i}`}
              className="mt-[-12vh] animate-bounce text-xl"
              style={{
                animationDuration: `${1.2 + (i % 6) * 0.12}s`,
                color: "#0F766E",
              }}
              aria-hidden
            >
              🎉
            </span>
          ))}
        </div>
      )}

      {/* QRCode scanner modal */}
      <LiveQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCode={(code) => {
          void joinBySessionCode(code);
        }}
      />

      {/* Quick Status bottom sheet */}
      <QuickStatusSheet
        tripId={session?.trip_id ?? null}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
      />
    </div>
  );
}
