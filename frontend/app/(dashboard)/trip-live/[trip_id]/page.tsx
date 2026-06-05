"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { onValue, ref, update as rtdbUpdate, type Database } from "firebase/database";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { initFirebase } from "@/lib/firebase-client";
import { LivePaywall } from "@/components/live/LivePaywall";
import { ChecklistOverlay } from "@/components/live/ChecklistOverlay";
import { LiveSidebar } from "@/components/live/LiveSidebar";
import { CountdownTimer } from "@/components/live/CountdownTimer";
import { TripPlanner } from "./plan";
import { AlertCircle, ArrowLeft, Loader2, Navigation, MapPin } from "lucide-react";

const LiveMap = dynamic(
  () => import("@/components/live/LiveMap").then((m) => m.LiveMap),
  { ssr: false }
);

interface LiveSession {
  id: string;
  trip_id: string;
  session_code: string;
  status: string;
  meet_radius_meters: number;
}

interface TripMeta {
  id: string;
  title: string;
  group_id: string;
  my_role: "admin" | "coordinator" | "member";
}

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  quick_status?: string | null;
}

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

export default function TripLivePage({ params }: { params: Promise<{ trip_id: string }> }) {
  const router = useRouter();
  const { trip_id: tripId } = use(params);

  // States
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [firebase, setFirebase] = useState<{ ok: boolean; db: Database | null }>({
    ok: false,
    db: null,
  });

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState<boolean>(false);
  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Sync states
  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const [membersLocs, setMembersLocs] = useState<
    Record<string, { lat: number | null; lng: number | null; quick_status?: string | null }>
  >({});
  const [meetPoint, setMeetPoint] = useState<{
    lat: number | null;
    lng: number | null;
    name?: string | null;
  }>({ lat: null, lng: null, name: null });

  const [pickingMeetPoint, setPickingMeetPoint] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});

  // 1. Initial configuration setup
  useEffect(() => {
    const t = getToken();
    setCurrentUserId(parseJwtUserId(t));
    const ready = initFirebase();
    setFirebase({ ok: ready.ok, db: ready.db });
  }, []);

  // 2. Fetch page load gating context
  const loadPageContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check Stripe Paywall Access
      const accessRes = await apiFetch<{ has_access: boolean }>(`/payments/live-access/${tripId}`);
      setHasAccess(accessRes.has_access);

      if (!accessRes.has_access) {
        setLoading(false);
        return;
      }

      // Check Trip Plan / Itinerary
      const planRes = await apiFetch<any>(`/trips/${tripId}/plan`);
      const isPlanPopulated = Array.isArray(planRes?.days) && planRes.days.length > 0;
      setHasPlan(isPlanPopulated);

      // Fetch Trip metadata
      const tripRes = await apiFetch<any>(`/trips/${tripId}`);
      // Find my member role on this trip
      // For fallback/simplicity, retrieve user list or role from response or set member
      const userRole = tripRes?.my_role || "member";
      setTripMeta({
        id: tripRes.id,
        title: tripRes.title,
        group_id: tripRes.group_id,
        my_role: userRole,
      });

      // Fetch Active Live Session
      const sessionRes = await apiFetch<LiveSession | null>(`/live/trips/${tripId}/session`);
      setSession(sessionRes);

      if (sessionRes?.id) {
        // Fetch Checklist status to get profile names
        const checklist = await apiFetch<any[]>(`/live/sessions/${sessionRes.id}/checklist`);
        const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        checklist.forEach((item) => {
          map[item.user_id] = { full_name: item.full_name, avatar_url: item.avatar_url };
        });
        setProfiles(map);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load trip coordination data");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadPageContext();
  }, [loadPageContext]);

  // 3. Firebase state listeners
  useEffect(() => {
    if (!firebase.db || !tripId) return undefined;
    const statusRef = ref(firebase.db, `trips/${tripId}/live_session/status`);
    const unsubscribeStatus = onValue(statusRef, (snap) => {
      const val = snap.val();
      setFbStatus(typeof val === "string" ? val : null);
    });

    const locationsRef = ref(firebase.db, `trips/${tripId}/locations`);
    const unsubscribeLocs = onValue(locationsRef, (snap) => {
      const val = snap.val() as Record<string, any> | null;
      if (!val) {
        setMembersLocs({});
        return;
      }
      const parsed: typeof membersLocs = {};
      Object.keys(val).forEach((uid) => {
        const row = val[uid];
        parsed[uid] = {
          lat: row?.lat ?? row?.latitude ?? null,
          lng: row?.lng ?? row?.longitude ?? null,
          quick_status: row?.quick_status ?? null,
        };
      });
      setMembersLocs(parsed);
    });

    const mpRef = ref(firebase.db, `trips/${tripId}/meet_point`);
    const unsubscribeMp = onValue(mpRef, (snap) => {
      const val = snap.val();
      if (val?.lat && val?.lng) {
        setMeetPoint({
          lat: val.lat,
          lng: val.lng,
          name: val.name || "Meet point",
        });
      } else {
        setMeetPoint({ lat: null, lng: null, name: null });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLocs();
      unsubscribeMp();
    };
  }, [firebase.db, tripId]);

  // 4. GPS Position Streaming to Firebase RTDB
  const effectiveStatus = fbStatus || session?.status || "";
  useEffect(() => {
    if (!firebase.db || !tripId || !currentUserId || !navigator.geolocation) return undefined;
    if (effectiveStatus !== "active" && effectiveStatus !== "pre_live") return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const updated_at = Math.floor(Date.now() / 1000);
        rtdbUpdate(ref(firebase.db!, `trips/${tripId}/locations/${currentUserId}`), {
          lat,
          lng,
          updated_at,
        }).catch((err) => console.warn("Failed to update coordinates in Firebase:", err));
      },
      (err) => console.warn("Geolocation watch error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [firebase.db, tripId, currentUserId, effectiveStatus]);

  // 5. Handlers
  const handleStartSession = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<LiveSession>("/live/sessions", {
        method: "POST",
        body: JSON.stringify({ trip_id: tripId }),
      });
      setSession(res);
      await loadPageContext();
    } catch (err: any) {
      setError(err?.message || "Failed to initialize live coordination session");
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    if (!confirm("Are you sure you want to end this live session for everyone?")) return;
    try {
      await apiFetch(`/live/sessions/${session.id}/end`, {
        method: "POST",
      });
      setSession(null);
      setFbStatus(null);
      await loadPageContext();
    } catch (err: any) {
      alert(err?.message || "Failed to end session");
    }
  };

  const handleGoLiveManual = () => {
    // Just trigger state refresh; FCM notify / firebase state already managed by API
    loadPageContext();
  };

  const triggerQuickStatus = async (statusVal: string) => {
    try {
      await apiFetch(`/live/trips/${tripId}/quick-status`, {
        method: "POST",
        body: JSON.stringify({ status: statusVal }),
      });
    } catch (err) {
      console.error("Failed to update quick status:", err);
    }
  };

  const handleMapPickPoint = async (lat: number, lng: number) => {
    setPickingMeetPoint(false);
    const label = prompt("Label for meeting point:", "Main gathering spot");
    if (!label) return;

    try {
      await apiFetch(`/live/trips/${tripId}/meet-point`, {
        method: "POST",
        body: JSON.stringify({ lat, lng, name: label }),
      });
    } catch (err) {
      console.error("Failed to publish meet point:", err);
    }
  };

  // 6. View Rendering Decision Tree
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-800">
        <Loader2 className="h-10 w-10 animate-spin text-[#0F766E]" />
        <p className="mt-4 text-sm font-semibold text-slate-500 animate-pulse">
          Loading Trip LIVE dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
          <h2 className="text-xl font-bold text-slate-850">Something went wrong</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={loadPageContext}
            className="mt-4 px-6 py-2.5 bg-[#0F766E] text-white rounded-xl font-semibold shadow hover:bg-[#0D635C] transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    return <LivePaywall tripId={tripId} onAccessGranted={() => setHasAccess(true)} />;
  }

  if (hasPlan === false || showPlanEditor) {
    return (
      <TripPlanner
        tripId={tripId}
        onPlanSaved={() => {
          setHasPlan(true);
          setShowPlanEditor(false);
          loadPageContext();
        }}
      />
    );
  }

  // If no session exists
  if (!session) {
    const isOwner = tripMeta?.my_role === "admin" || tripMeta?.my_role === "coordinator";
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-6">
          <div className="h-16 w-16 bg-teal-50 text-[#0F766E] rounded-full flex items-center justify-center shadow-inner">
            <Navigation className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Ready to Roam Together?
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Start a live session to activate real-time GPS coordinate synchronization, meeting point pins, group timers, and Wayra coordination.
            </p>
          </div>

          {isOwner ? (
            <button
              onClick={handleStartSession}
              className="w-full py-4 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-xl font-bold transition shadow-lg shadow-teal-100"
            >
              Start Live Coordination
            </button>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl text-xs font-semibold">
              Waiting for trip coordinator or group admin to initiate the live session.
            </div>
          )}

          <button
            onClick={() => router.push("/live")}
            className="text-xs text-slate-500 hover:text-slate-800 underline flex items-center gap-1 mt-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Live Hub
          </button>
        </div>
      </div>
    );
  }

  // Pre-live checklist overlay
  if (effectiveStatus === "pre_live") {
    return (
      <ChecklistOverlay
        tripId={tripId}
        sessionId={session.id}
        firebaseDb={firebase.db}
        isAdmin={tripMeta?.my_role === "admin" || tripMeta?.my_role === "coordinator"}
        onGoLive={handleGoLiveManual}
        currentUserId={currentUserId}
      />
    );
  }

  // Active Live state
  const activeMembersList = Object.keys(profiles).map((uid) => {
    const loc = membersLocs[uid];
    return {
      user_id: uid,
      full_name: profiles[uid]?.full_name || "Traveler",
      avatar_url: profiles[uid]?.avatar_url || null,
      quick_status: loc?.quick_status || null,
      lat: loc?.lat || null,
      lng: loc?.lng || null,
    };
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0F172A]">
      {/* Sidebar Controls */}
      <LiveSidebar
        tripId={tripId}
        sessionId={session.id}
        members={activeMembersList}
        firebaseDb={firebase.db}
        isAdmin={tripMeta?.my_role === "admin" || tripMeta?.my_role === "coordinator"}
        onSetMeetPoint={() => setPickingMeetPoint(true)}
        onEndSession={handleEndSession}
        currentUserId={currentUserId}
      />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Quick status bar */}
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur border border-slate-200 p-2 rounded-2xl shadow-xl pointer-events-auto">
            <span className="text-xs font-bold text-slate-500 px-2 uppercase tracking-wider">Status:</span>
            <button
              onClick={() => triggerQuickStatus("here")}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100 transition"
            >
              ✅ Here
            </button>
            <button
              onClick={() => triggerQuickStatus("on_my_way")}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-100 transition"
            >
              🚗 On Way
            </button>
            <button
              onClick={() => triggerQuickStatus("running_late")}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-xl border border-amber-100 transition"
            >
              🏃 Late
            </button>
          </div>

          {/* Right Side Top Status (Countdown Timer) */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {pickingMeetPoint && (
              <div className="bg-[#0F766E] text-white px-4 py-2 rounded-xl text-xs font-bold animate-pulse shadow-xl flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Click map to place meet point coordinate
              </div>
            )}
            <div className="bg-white/95 backdrop-blur border border-slate-200 p-2 rounded-2xl shadow-xl">
              <CountdownTimer tripId={tripId} firebaseDb={firebase.db} />
            </div>
          </div>
        </div>

        {/* The Live Interactive Map */}
        <div className="w-full h-full">
          <LiveMap
            tripId={tripId}
            firebaseDb={firebase.db}
            members={activeMembersList}
            meetPoint={meetPoint}
            pickingMeetPoint={pickingMeetPoint}
            onMapPick={handleMapPickPoint}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}
