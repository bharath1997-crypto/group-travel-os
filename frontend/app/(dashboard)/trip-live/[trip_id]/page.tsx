"use client";

import { use, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ref, onValue, update as rtdbUpdate, type Database } from "firebase/database";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { initFirebase } from "@/lib/firebase-client";
import { ChecklistOverlay } from "@/components/live/ChecklistOverlay";
import { TripPlanner } from "./plan";

// Icons from lucide-react
import {
  Map as MapIcon,
  Users as UsersIcon,
  MessageSquare as ChatIcon,
  Calendar as PlanIcon,
  ShieldAlert as SafetyIcon,
  Sparkles as ActivityIcon,
  AlertCircle,
  Loader2,
  ArrowLeft,
  WifiOff,
  Clock,
  LogOut,
  MapPin
} from "lucide-react";

// Dynamically import GroupMap to avoid Leaflet SSR issues
const GroupMap = dynamic(
  () => import("@/components/live/GroupMap").then((m) => m.GroupMap),
  { ssr: false }
);

import { MemberPanel } from "@/components/live/MemberPanel";
import { GroupChat } from "@/components/live/GroupChat";
import { TripPlan } from "@/components/live/TripPlan";
import { SafetyPanel } from "@/components/live/SafetyPanel";
import { ActivityPanel } from "@/components/live/ActivityPanel";

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

  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState<boolean>(false);
  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Sync states
  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const [timerState, setTimerState] = useState<{
    started_at?: number;
    duration_seconds?: number;
    is_active?: boolean;
  } | null>(null);

  const [membersLocs, setMembersLocs] = useState<
    Record<string, { lat: number | null; lng: number | null; quick_status?: string | null; updated_at?: number | null }>
  >({});
  const [meetPoint, setMeetPoint] = useState<{
    lat: number | null;
    lng: number | null;
    name?: string | null;
  }>({ lat: null, lng: null, name: null });

  const [pickingMeetPoint, setPickingMeetPoint] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [activeTab, setActiveTab] = useState<"map" | "members" | "chat" | "plan" | "safety" | "activity">("map");

  // Footer Duration clock
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 1. Initial configuration setup
  useEffect(() => {
    const t = getToken();
    setCurrentUserId(parseJwtUserId(t));
    const ready = initFirebase();
    setFirebase({ ok: ready.ok, db: ready.db });
  }, []);

  // Timer for footer duration
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStartTime) / 1000);
      setElapsedSeconds(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // 2. Fetch page load gating context (subscription gate completely bypassed as requested)
  const loadPageContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check Trip Plan / Itinerary
      const planRes = await apiFetch<any>(`/trips/${tripId}/live-plan`);
      const isPlanPopulated = Array.isArray(planRes) && planRes.length > 0;
      setHasPlan(isPlanPopulated);

      // Fetch Trip metadata
      const tripRes = await apiFetch<any>(`/trips/${tripId}`);
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
          updated_at: row?.updated_at ?? null,
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

    const timerRef = ref(firebase.db, `trips/${tripId}/timer`);
    const unsubscribeTimer = onValue(timerRef, (snap) => {
      setTimerState(snap.val());
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLocs();
      unsubscribeMp();
      unsubscribeTimer();
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
      setSessionStartTime(Date.now());
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
    loadPageContext();
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

  // Remaining count for active countdown timer
  const countdownFormatted = useMemo(() => {
    if (!timerState || !timerState.is_active || !timerState.started_at || !timerState.duration_seconds) {
      return "00:00";
    }
    const elapsed = Math.floor(Date.now() / 1000) - timerState.started_at;
    const remaining = Math.max(0, timerState.duration_seconds - elapsed);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [timerState, elapsedSeconds]);

  // Session duration formatting
  const formattedSessionDuration = useMemo(() => {
    const hrs = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [elapsedSeconds]);

  // View Rendering Decision Tree
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
            <MapIcon className="h-8 w-8" />
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
      updated_at: loc?.updated_at || null,
    };
  });

  const isAdmin = tripMeta?.my_role === "admin" || tripMeta?.my_role === "coordinator";

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#FFFFFF] font-sans">
      
      {/* 1. TOP BAR (background #0A0F1E) */}
      <header className="bg-[#0A0F1E] h-16 px-4 flex items-center justify-between border-b border-slate-900 shrink-0 text-white select-none">
        <div className="flex items-center gap-3">
          {/* Pulsing red LIVE pill */}
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-red-500 tracking-wider">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight truncate max-w-[160px] md:max-w-xs">{tripMeta?.title || "Active Trip"}</h1>
            <span className="text-[10px] text-slate-400 font-bold block">Day 1 · Main Spot</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Members online chip */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-bold text-slate-300">
            <UsersIcon size={12} className="text-[#0F766E]" />
            <span>{activeMembersList.length} crew</span>
          </div>

          {/* Time remaining chip */}
          {timerState?.is_active && (
            <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-black text-teal-400 tabular-nums">
              <Clock size={12} />
              <span>{countdownFormatted}</span>
            </div>
          )}

          {/* Offline chip */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-bold text-slate-400">
            <WifiOff size={12} />
            <span className="hidden xs:inline">Offline Ready</span>
          </div>

          {/* End session button */}
          {isAdmin && (
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition border border-red-600 shadow"
            >
              <LogOut size={12} />
              <span className="hidden md:inline">End Session</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. 6 NAVIGATION TABS (background #0F172A) */}
      <nav className="bg-[#0F172A] h-12 flex border-b border-slate-800 shrink-0 select-none overflow-x-auto">
        <div className="flex items-center justify-around w-full max-w-3xl mx-auto px-4 gap-1">
          {[
            { id: "map", label: "Map", icon: MapIcon },
            { id: "members", label: "Members", icon: UsersIcon },
            { id: "chat", label: "Chat", icon: ChatIcon },
            { id: "plan", label: "Plan", icon: PlanIcon },
            { id: "safety", label: "Safety", icon: SafetyIcon },
            { id: "activity", label: "Activity", icon: ActivityIcon },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComp = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setPickingMeetPoint(false);
                }}
                className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 border-b-2 text-xs font-black transition-all ${
                  isActive
                    ? "border-[#0F766E] text-[#0F766E]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <IconComp size={16} />
                <span className="text-[10px] tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. PANEL HEIGHT: 520px container for active tab content */}
      <main className="w-full max-w-3xl mx-auto flex-1 md:flex-none h-[520px] bg-[#F8FAFC] border-x border-slate-200 relative overflow-hidden">
        {/* Picking Location Overlay Banner */}
        {pickingMeetPoint && (
          <div className="absolute top-2 inset-x-2 z-50 flex justify-center">
            <div className="bg-[#0F766E] text-white px-4 py-2 rounded-xl text-xs font-bold animate-pulse shadow-lg flex items-center gap-2">
              <MapPin className="h-4 w-4 animate-bounce" /> Click the map to drop your new meeting coordinate
            </div>
          </div>
        )}

        <div className="w-full h-full p-4 overflow-hidden">
          {activeTab === "map" && (
            <GroupMap
              tripId={tripId}
              firebaseDb={firebase.db}
              currentUserId={currentUserId}
              meetPoint={meetPoint}
              pickingMeetPoint={pickingMeetPoint}
              onMapPick={handleMapPickPoint}
              members={activeMembersList}
            />
          )}

          {activeTab === "members" && (
            <MemberPanel
              tripId={tripId}
              firebaseDb={firebase.db}
              members={activeMembersList}
              meetPoint={meetPoint}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onSetMeetPointClick={() => {
                setActiveTab("map");
                setPickingMeetPoint(true);
              }}
            />
          )}

          {activeTab === "chat" && (
            <GroupChat
              tripId={tripId}
              firebaseDb={firebase.db}
              currentUserId={currentUserId}
              currentUserName={profiles[currentUserId!]?.full_name || "Traveler"}
            />
          )}

          {activeTab === "plan" && (
            <TripPlan
              tripId={tripId}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === "safety" && (
            <SafetyPanel
              tripId={tripId}
              members={activeMembersList}
              meetPoint={meetPoint}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === "activity" && (
            <ActivityPanel
              tripId={tripId}
              currentUserId={currentUserId}
              members={activeMembersList}
            />
          )}
        </div>
      </main>

      {/* 4. FOOTER BAR */}
      <footer className="bg-[#0A0F1E] h-10 px-4 flex items-center justify-between border-t border-slate-900 shrink-0 text-slate-400 text-[10px] font-black select-none uppercase tracking-wider">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Offline Maps: Chicago Area Cached (42.5 MB)</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} className="text-teal-400" />
          <span>Duration: {formattedSessionDuration}</span>
        </div>
      </footer>

    </div>
  );
}
