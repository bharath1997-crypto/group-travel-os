"use client";

import { use, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ref, onValue, update as rtdbUpdate, type Database } from "firebase/database";
import { API_BASE, apiFetch } from "@/lib/api";
import { RovvyLogo } from "@/components/RovvyLogo";
import { getToken } from "@/lib/auth";
import { initFirebase } from "@/lib/firebase-client";
import { ChecklistOverlay, type MemberReadiness } from "@/components/live/ChecklistOverlay";
import { TripPlanner } from "./plan";

// Icons from lucide-react
import {
  Map as MapIcon,
  Users as UsersIcon,
  MessageSquare as ChatIcon,
  Calendar as PlanIcon,
  ShieldAlert as SafetyIcon,
  Sparkles as ActivityIcon,
  Loader2,
  ArrowLeft,
  WifiOff,
  Clock,
  LogOut,
  MapPin,
  Bot,
  Send,
  ClipboardList,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import WayraIcon from "@/components/ui/WayraIcon";
import { emitOpenWayra } from "@/lib/open-wayra";

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

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 2000,
  onAttempt?: (attempt: number) => void,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    onAttempt?.(i + 1);
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Failed after retries");
}

async function pingHealth(): Promise<void> {
  try {
    const origin = new URL(API_BASE).origin;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${origin}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch {
    /* proceed with trip fetch even if health check fails */
  }
}

function SoloWayraPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "wayra" | "user"; text: string }[]
  >([
    {
      role: "wayra",
      text: "Hi! I'm Wayra, your solo travel companion. I'm watching your location and ready to help with suggestions, safety, and your itinerary.",
    },
  ]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    emitOpenWayra({ prompt: text });
    setMessages((prev) => [
      ...prev,
      {
        role: "wayra",
        text: "Opening full Wayra chat — ask me anything about your trip, nearby spots, or safety.",
      },
    ]);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-3">
        <WayraIcon state="flying" size={0.45} variant="raw" animate />
        <div>
          <p className="text-sm font-bold text-[#0F172A]">Wayra AI</p>
          <p className="text-[10px] text-violet-600 font-semibold">Solo companion · Live</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#8B5CF6] text-white"
                  : "bg-violet-50 text-slate-700 border border-violet-100"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-violet-100 p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Wayra anything…"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
          <button
            type="button"
            onClick={send}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6] text-white transition hover:bg-[#7C3AED]"
            aria-label="Send to Wayra"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
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
  const searchParams = useSearchParams();
  const { trip_id: tripId } = use(params);
  const isSoloMode = searchParams.get("mode") === "solo";

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
  const [error, setError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(1);

  const [checklistReadiness, setChecklistReadiness] = useState<MemberReadiness[]>([]);

  // Floating Checklist & Permission states
  const ITEMS = useMemo(() => [
    "I am ready to share my location coordinates",
    "I have verified the meeting point location",
    "My phone battery is charged above 20%",
    "I have reviewed the daily itinerary plans",
  ], []);

  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [showChecklistFloating, setShowChecklistFloating] = useState(false);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(Array(4).fill(false));
  const [submittingChecklist, setSubmittingChecklist] = useState(false);

  const toggleChecklistItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const isAllChecked = checkedItems.every(Boolean);
  const isUserAccepted = checklistReadiness.find((r) => r.user_id === currentUserId)?.is_accepted || false;

  const handleAcceptChecklist = async () => {
    if (!isAllChecked || submittingChecklist || !session) return;
    setSubmittingChecklist(true);
    try {
      await apiFetch(`/live/sessions/${session.id}/checklist/accept`, {
        method: "POST",
      }, 30000);
      setChecklistReadiness((prev) =>
        prev.map((m) => (m.user_id === currentUserId ? { ...m, is_accepted: true } : m))
      );
    } catch (err) {
      console.error("Failed to accept checklist:", err);
    } finally {
      setSubmittingChecklist(false);
    }
  };

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

  // Request location permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationPermissionGranted(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationPermissionGranted(true);
      },
      (err) => {
        console.warn("Location permission request failed/denied:", err);
        setLocationPermissionGranted(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    setError(false);
    setFetchAttempt(1);
    try {
      await pingHealth();

      await fetchWithRetry(
        async () => {
          const planRes = await apiFetch<any>(`/trips/${tripId}/live-plan`);
          const isPlanPopulated = Array.isArray(planRes) && planRes.length > 0;
          setHasPlan(isPlanPopulated);

          const tripRes = await apiFetch<any>(`/trips/${tripId}`);
          const userRole = tripRes?.my_role || "member";
          setTripMeta({
            id: tripRes.id,
            title: tripRes.title,
            group_id: tripRes.group_id,
            my_role: userRole,
          });

          let sessionRes = await apiFetch<LiveSession | null>(`/live/trips/${tripId}/session`);

          if (!sessionRes && locationPermissionGranted === true) {
            try {
              sessionRes = await apiFetch<LiveSession>("/live/sessions", {
                method: "POST",
                body: JSON.stringify({
                  trip_id: tripId,
                  mode: isSoloMode ? "SOLO" : "GROUP",
                }),
              });
            } catch (err) {
              console.warn("Auto-creating session failed:", err);
            }
          }

          setSession(sessionRes);

          if (sessionRes?.id) {
            const checklist = await apiFetch<any[]>(`/live/sessions/${sessionRes.id}/checklist`);
            const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
            const readiness: MemberReadiness[] = [];
            checklist.forEach((item) => {
              map[item.user_id] = { full_name: item.full_name, avatar_url: item.avatar_url };
              readiness.push({
                user_id: item.user_id,
                full_name: item.full_name,
                avatar_url: item.avatar_url,
                is_accepted: item.is_accepted,
              });
            });
            setProfiles(map);
            setChecklistReadiness(readiness);
          } else {
            setChecklistReadiness([]);
          }
        },
        3,
        2000,
        setFetchAttempt,
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId, locationPermissionGranted, isSoloMode]);

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

    const checklistRef = ref(firebase.db, `trips/${tripId}/live_session/checklist`);
    const unsubscribeChecklist = onValue(checklistRef, (snap) => {
      const val = snap.val() as Record<string, { accepted?: boolean }> | null;
      if (!val) return;
      setChecklistReadiness((prev) =>
        prev.map((m) => ({
          ...m,
          is_accepted: !!val[m.user_id]?.accepted,
        }))
      );
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLocs();
      unsubscribeMp();
      unsubscribeTimer();
      unsubscribeChecklist();
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
    } catch {
      setError(true);
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
        <RovvyLogo variant="primary" size="lg" showTagline={false} className="items-center" />
        <p className="mt-6 text-sm font-semibold text-slate-600">
          Connecting to Trip LIVE...
        </p>
        <Loader2 className="mt-4 h-10 w-10 animate-spin text-[#0F766E]" />
        {fetchAttempt > 1 && (
          <p className="mt-4 text-xs font-medium text-slate-500">
            Attempt {fetchAttempt} of 3
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <WifiOff className="h-12 w-12 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-800">Unable to connect</h2>
          <p className="text-sm text-slate-500">Check your connection and try again</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={loadPageContext}
              className="flex-1 px-6 py-2.5 bg-[#0F766E] text-white rounded-xl font-semibold shadow hover:bg-[#0D635C] transition"
            >
              Retry
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
            >
              Go back
            </button>
          </div>
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

  // Gating screens completely bypassed as requested

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

  const soloMembersList = currentUserId
    ? activeMembersList.filter((m) => m.user_id === currentUserId)
    : activeMembersList.slice(0, 1);

  const mapMembers = isSoloMode ? soloMembersList : activeMembersList;

  const navTabs = isSoloMode
    ? [
        { id: "map" as const, label: "Map", icon: MapIcon },
        { id: "members" as const, label: "Wayra AI", icon: Bot },
        { id: "plan" as const, label: "Plan", icon: PlanIcon },
        { id: "safety" as const, label: "Safety", icon: SafetyIcon },
        { id: "activity" as const, label: "Activity", icon: ActivityIcon },
      ]
    : [
        { id: "map" as const, label: "Map", icon: MapIcon },
        { id: "members" as const, label: "Members", icon: UsersIcon },
        { id: "chat" as const, label: "Chat", icon: ChatIcon },
        { id: "plan" as const, label: "Plan", icon: PlanIcon },
        { id: "safety" as const, label: "Safety", icon: SafetyIcon },
        { id: "activity" as const, label: "Activity", icon: ActivityIcon },
      ];

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#FFFFFF] font-sans">
      
      {/* 1. TOP BAR (background #F8FAFC) */}
      <header className="bg-[#F8FAFC] h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0 text-slate-900 select-none">
        <div className="flex items-center gap-3">
          {/* Pulsing red LIVE pill */}
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-red-600 tracking-wider">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight truncate max-w-[160px] md:max-w-xs text-slate-900">{tripMeta?.title || "Active Trip"}</h1>
            <span className="text-[10px] text-slate-500 font-bold block">Day 1 · Main Spot</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSoloMode ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full text-xs font-bold text-violet-700">
              <Bot size={12} className="text-[#8B5CF6]" />
              <span>Solo LIVE</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 bg-teal-50 border border-teal-200/50 px-3 py-1.5 rounded-full text-xs font-bold text-teal-700">
              <UsersIcon size={12} className="text-[#0F766E]" />
              <span>{activeMembersList.length} crew</span>
            </div>
          )}

          {/* Time remaining chip */}
          {timerState?.is_active && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-black text-amber-700 tabular-nums">
              <Clock size={12} />
              <span>{countdownFormatted}</span>
            </div>
          )}

          {/* Offline chip */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500">
            <WifiOff size={12} />
            <span className="hidden xs:inline">Offline Ready</span>
          </div>

          {/* End session button */}
          {isAdmin && (
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition border border-red-600 shadow-sm"
            >
              <LogOut size={12} />
              <span className="hidden md:inline">End Session</span>
            </button>
          )}
        </div>
      </header>

      {isSoloMode && (
        <div className="shrink-0 border-b border-violet-200 bg-gradient-to-r from-violet-600 to-[#8B5CF6] px-4 py-2.5 text-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <WayraIcon state="flying" size={0.38} variant="raw" animate />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">Wayra Solo Companion</p>
              <p className="truncate text-[11px] text-violet-100">
                Watching your location · Real-time suggestions · Safety alerts active
              </p>
            </div>
            <button
              type="button"
              onClick={() => emitOpenWayra()}
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-[10px] font-bold hover:bg-white/30 transition"
            >
              Open Wayra
            </button>
          </div>
        </div>
      )}

      {/* 2. NAVIGATION TABS (background white) */}
      <nav className="bg-white h-12 flex border-b border-slate-200 shrink-0 select-none overflow-x-auto">
        <div className="flex items-center justify-around w-full max-w-3xl mx-auto px-4 gap-1">
          {navTabs.map((tab) => {
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
                    ? isSoloMode
                      ? "border-[#8B5CF6] text-[#8B5CF6]"
                      : "border-[#0F766E] text-[#0F766E]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
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
            <div className="relative w-full h-full">
              <GroupMap
                tripId={tripId}
                firebaseDb={firebase.db}
                currentUserId={currentUserId}
                meetPoint={isSoloMode ? { lat: null, lng: null, name: null } : meetPoint}
                pickingMeetPoint={isSoloMode ? false : pickingMeetPoint}
                onMapPick={isSoloMode ? () => {} : handleMapPickPoint}
                members={mapMembers}
              />

              {/* Floating Location Permission Prompt Overlay */}
              {!session && (
                <div className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-[2px] z-20 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 text-slate-100 p-5 rounded-2xl shadow-xl max-w-xs w-full text-center flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <MapIcon className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Location Required</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Please grant location permissions to automatically start and sync the live coordination map.
                      </p>
                    </div>
                    {locationPermissionGranted === false && (
                      <button
                        onClick={() => {
                          navigator.geolocation.getCurrentPosition(
                            () => setLocationPermissionGranted(true),
                            () => setLocationPermissionGranted(false),
                            { enableHighAccuracy: true }
                          );
                        }}
                        className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-xl text-xs font-bold transition shadow-lg"
                      >
                        Allow GPS Tracking
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Floating Checklist Toggle Button */}
              {!isSoloMode && session && (
                <button
                  onClick={() => setShowChecklistFloating((v) => !v)}
                  className="absolute top-3 left-3 z-20 h-9 w-9 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
                  title="Toggle Live Checklist"
                >
                  <ClipboardList size={16} />
                </button>
              )}

              {/* Collapsible Floating Checklist Panel */}
              {!isSoloMode && session && showChecklistFloating && (
                <div className="absolute top-14 left-3 z-20 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-xl max-w-[280px] w-full p-3.5 backdrop-blur-md text-slate-200">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-black uppercase text-teal-400 tracking-wider">Live Checklist</span>
                    <button
                      onClick={() => setShowChecklistFloating(false)}
                      className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ITEMS.map((item, idx) => {
                      const isChecked = checkedItems[idx];
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleChecklistItem(idx)}
                          className="w-full flex items-start gap-2 text-left hover:bg-slate-900/60 p-1 rounded-lg transition"
                        >
                          {isChecked ? (
                            <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] text-slate-350 leading-tight">{item}</span>
                        </button>
                      );
                    })}
                    
                    {!isUserAccepted ? (
                      <button
                        disabled={!isAllChecked || submittingChecklist}
                        onClick={handleAcceptChecklist}
                        className="w-full mt-2.5 py-2 bg-[#0F766E] hover:bg-[#0D635C] disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        {submittingChecklist && <Loader2 className="h-3 w-3 animate-spin" />}
                        Confirm Ready
                      </button>
                    ) : (
                      <div className="mt-2.5 p-2 bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Ready Status Synced</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "members" && (
            isSoloMode ? (
              <SoloWayraPanel />
            ) : (
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
            )
          )}

          {!isSoloMode && activeTab === "chat" && (
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
              members={mapMembers}
              meetPoint={isSoloMode ? { lat: null, lng: null, name: null } : meetPoint}
              currentUserId={currentUserId}
              isAdmin={isSoloMode ? true : isAdmin}
            />
          )}

          {activeTab === "activity" && (
            <ActivityPanel
              tripId={tripId}
              currentUserId={currentUserId}
              members={mapMembers}
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
