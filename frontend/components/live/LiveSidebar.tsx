"use client";

import {
  Home,
  Map,
  Radio,
  Users,
  MapPin,
  AlertTriangle,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Play,
  Pause,
  Square,
  UserPlus,
  ChevronLeft,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { type TripMember, type MeetingPoint } from "@/lib/live/group";

type MemberLiveData = {
  lat?: number;
  lng?: number;
  last_seen?: string;
  battery_level?: number;
  status?: string | { status?: string; updated_at?: string };
  transport?: "driving" | "bike" | "foot";
};

type LiveSidebarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  tripName: string;
  tripMembers: TripMember[];
  memberLive: Record<string, MemberLiveData>;
  memberStatuses: Record<string, string>;
  convoy: any;
  nextMeetup: MeetingPoint | null;
  onNavigateMeetup: () => void;
  onInviteMembers: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenWayra: () => void;
  sessionMembers?: Record<string, any>;
  destination?: { lat: number; lng: number; name: string } | null;
};

export function LiveSidebar({
  sidebarOpen,
  setSidebarOpen,
  tripName,
  tripMembers,
  memberLive,
  memberStatuses,
  convoy,
  nextMeetup,
  onNavigateMeetup,
  onInviteMembers,
  isDarkMode,
  onToggleDarkMode,
  activeTab,
  onTabChange,
  onOpenWayra,
  sessionMembers = {},
  destination = null,
}: LiveSidebarProps) {
  // Trip Timer State
  const [timerSeconds, setTimerSeconds] = useState(8124); // 2h 15m 24s
  const [timerIsActive, setTimerIsActive] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerIsActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerIsActive, timerSeconds]);

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, "0");
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Distance helper
  const getDistanceM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Status classifier helper
  const getMemberStatusBadge = (m: any, dest: { lat: number; lng: number } | null): { label: string; colorClass: string } => {
    const now = Math.floor(Date.now() / 1000);
    const tsVal = m.ts ?? m.timestamp;
    const tsSec = tsVal ? (tsVal > 20000000000 ? Math.floor(tsVal / 1000) : tsVal) : now;
    const ageSec = now - tsSec;
    const speed = m.speed ?? 0;
    const isOnline = m.online !== false && m.is_active !== false;

    if (!isOnline || ageSec > 300) {
      return { label: "Offline", colorClass: "bg-stone-500/10 text-stone-400 border-stone-500/20" };
    }
    
    if (dest && m.lat != null && m.lng != null) {
      const dist = getDistanceM(m.lat, m.lng, dest.lat, dest.lng);
      if (dist < 100) {
        return { label: "Arrived", colorClass: "bg-green-500/10 text-green-400 border-green-500/20" };
      }
      if (dist < 500) {
        return { label: "Near", colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      }
    }

    if (ageSec > 120) {
      return { label: "Stale", colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    }

    if (speed > 2) {
      return { label: "On route", colorClass: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
    }

    return { label: "Stopped", colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  };

  // Grouping & Aggregating
  const vehicleGroups = useMemo(() => {
    const groups: Record<string, {
      label: string;
      members: any[];
      movingCount: number;
      stoppedCount: number;
      staleCount: number;
      offlineCount: number;
      speeds: number[];
    }> = {};

    const membersList = Object.values(sessionMembers || {});

    for (const m of membersList) {
      let vehicleId = m.vehicle_id;
      let label = vehicleId;

      if (!vehicleId) {
        const mode = (m.transport_mode || m.mode || "").toLowerCase();
        if (mode === "driving" || mode === "drive") {
          vehicleId = "car_pool";
          label = "Car Pool";
        } else if (mode === "bike") {
          vehicleId = "bike";
          label = "Bike";
        } else if (mode === "foot" || mode === "walk" || mode === "trek") {
          vehicleId = "walking_trek";
          label = "Walking / Trek";
        } else {
          vehicleId = "unassigned";
          label = "Unassigned";
        }
      }

      if (!groups[vehicleId]) {
        groups[vehicleId] = {
          label,
          members: [],
          movingCount: 0,
          stoppedCount: 0,
          staleCount: 0,
          offlineCount: 0,
          speeds: [],
        };
      }

      groups[vehicleId].members.push(m);

      const badge = getMemberStatusBadge(m, destination);
      if (badge.label === "Offline") {
        groups[vehicleId].offlineCount++;
      } else if (badge.label === "Stale") {
        groups[vehicleId].staleCount++;
      } else if (badge.label === "Stopped") {
        groups[vehicleId].stoppedCount++;
      } else {
        groups[vehicleId].movingCount++;
      }

      if (m.speed != null) {
        groups[vehicleId].speeds.push(m.speed);
      }
    }

    return Object.entries(groups).map(([id, g]) => {
      const avgSpeed = g.speeds.length > 0
        ? Math.round(g.speeds.reduce((a, b) => a + b, 0) / g.speeds.length)
        : null;

      let color = "bg-teal-500 shadow-teal-500/50";
      if (id.toLowerCase().includes("car") || id === "car_pool") {
        if (id.includes("1")) color = "bg-purple-500 shadow-purple-500/50";
        else if (id.includes("2")) color = "bg-blue-500 shadow-blue-500/50";
        else if (id.includes("3")) color = "bg-orange-500 shadow-orange-500/50";
        else color = "bg-purple-500 shadow-purple-500/50";
      }

      let statusStr = "Stopped";
      if (g.offlineCount === g.members.length) {
        statusStr = "Offline";
      } else if (g.movingCount > 0) {
        statusStr = "On route";
      } else if (g.staleCount > 0) {
        statusStr = "Stale";
      }

      return {
        ...g,
        id,
        color,
        avgSpeed,
        statusStr,
      };
    });
  }, [sessionMembers, destination]);

  const sidebarCounts = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    let moving = 0;
    let stopped = 0;
    let stale = 0;
    let offline = 0;

    const membersList = Object.values(sessionMembers || {});

    for (const m of membersList) {
      const tsVal = m.ts ?? m.timestamp;
      const tsSec = tsVal ? (tsVal > 20000000000 ? Math.floor(tsVal / 1000) : tsVal) : now;
      const ageSec = now - tsSec;
      const speed = m.speed ?? 0;
      const isOnline = m.online !== false && m.is_active !== false;

      if (!isOnline || ageSec > 300) {
        offline++;
      } else if (ageSec > 120) {
        stale++;
      } else if (speed > 2) {
        moving++;
      } else {
        stopped++;
      }
    }

    const hasOnlineMember = membersList.some((m) => m.online !== false && m.is_active !== false && (now - (m.ts ?? m.timestamp ?? 0) <= 300));

    return {
      totalMembers: membersList.length,
      movingCount: moving,
      stoppedCount: stopped,
      staleCount: stale,
      offlineCount: offline,
      hasOnlineMember,
    };
  }, [sessionMembers]);

  return (
    <div
      className={`absolute left-0 top-0 z-20 flex h-full border-r border-slate-900 shadow-2xl transition-transform duration-300 ${
        sidebarOpen
          ? "pointer-events-auto translate-x-0"
          : "pointer-events-none -translate-x-full"
      }`}
    >
      {/* ── COLUMN 1: NARROW NAVIGATION RAIL (w-16) ── */}
      <div className="flex h-full w-16 flex-col items-center justify-between border-r border-slate-900 bg-slate-950 py-4 text-white shrink-0">
        <div className="flex flex-col items-center w-full">
          {/* Active Live Pulse dot at the top */}
          <div className="mb-6 flex flex-col items-center justify-center">
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-red-600/20">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
            </span>
          </div>

          {/* Rail Navigation Tabs */}
          <nav className="flex flex-col gap-3 w-full px-2">
            {([
              { id: "overview", label: "Overview", icon: Home },
              { id: "groups", label: "Members", icon: Users },
              { id: "meetups", label: "Meetups", icon: MapPin },
              { id: "reports", label: "Hazards", icon: AlertTriangle },
              { id: "wayra", label: "Wayra AI", icon: Sparkles },
              { id: "settings", label: "Settings", icon: Settings },
            ] as const).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex h-11 w-full items-center justify-center rounded-xl transition-all ${
                    isActive
                      ? "bg-[#0F766E]/20 text-teal-400 border-l-2 border-teal-500 rounded-l-none"
                      : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
                  }`}
                  title={item.label}
                >
                  <item.icon size={19} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Theme toggle in rail footer */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition"
            title="Toggle theme mode"
          >
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>

      {/* ── COLUMN 2: SUB-SIDEBAR PANEL (w-[260px]) ── */}
      <div className="flex h-full w-[260px] flex-col bg-[#0F172A] text-white shrink-0 overflow-hidden">
        {/* Header section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {activeTab === "overview" && "Trip Overview"}
            {activeTab === "groups" && "Vehicles & Members"}
            {activeTab === "meetups" && "Trip Meetups"}
            {activeTab === "reports" && "Road Hazards"}
            {activeTab === "wayra" && "Wayra AI Assistant"}
            {activeTab === "settings" && "Map & Live Settings"}
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Collapse Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Scrollable Sub-panel Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Pulse counts */}
              <div className="rounded-xl bg-[#1E293B]/30 border border-slate-800/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>{sidebarCounts.totalMembers} Member{sidebarCounts.totalMembers !== 1 ? "s" : ""}</span>
                  <span className={`flex items-center gap-1 ${sidebarCounts.hasOnlineMember ? "text-green-400" : "text-slate-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sidebarCounts.hasOnlineMember ? "bg-green-400 animate-pulse" : "bg-stone-500"}`} />
                    {sidebarCounts.hasOnlineMember ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-center">
                  <div className="rounded bg-green-500/10 py-1 text-green-400 border border-green-500/20">
                    🟢 {sidebarCounts.movingCount} Moving
                  </div>
                  <div className="rounded bg-amber-500/10 py-1 text-amber-400 border border-amber-500/20">
                    🟡 {sidebarCounts.stoppedCount} Stopped
                  </div>
                  {sidebarCounts.staleCount > 0 && (
                    <div className="rounded bg-orange-500/10 py-1 text-orange-400 border border-orange-500/20 col-span-2">
                      🟠 {sidebarCounts.staleCount} Stale updates
                    </div>
                  )}
                </div>
              </div>

              {/* Trip Timer Widget */}
              <div className="rounded-xl bg-[#1E293B]/20 border border-slate-800/30 p-3">
                <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Trip Timer</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-800 p-1 text-teal-400">
                      <Sun className="animate-spin-slow" size={13} />
                    </span>
                    <span className="font-mono text-sm font-semibold tracking-wider text-white">
                      {formatTimer(timerSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTimerIsActive(!timerIsActive)}
                      className="rounded-lg bg-slate-800 p-1 text-slate-300 hover:bg-slate-700 transition"
                      title={timerIsActive ? "Pause" : "Resume"}
                    >
                      {timerIsActive ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimerIsActive(false);
                        setTimerSeconds(0);
                      }}
                      className="rounded-lg bg-slate-800 p-1 text-rose-400 hover:bg-rose-500/10 transition"
                      title="Stop"
                    >
                      <Square size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Proactive Wayra AI Card */}
              <div className="rounded-xl bg-[#0F766E]/10 border border-[#0F766E]/20 p-3">
                <div className="flex items-center gap-1.5 text-teal-400 font-bold text-[11px] uppercase tracking-wide">
                  <Sparkles size={13} />
                  <span>Wayra Suggestion</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Love's Travel Stop is 4.2 miles ahead. We suggest a fuel stop.
                </p>
                <button
                  type="button"
                  onClick={onOpenWayra}
                  className="mt-2.5 w-full rounded-lg bg-[#0F766E] py-1.5 text-center text-xs font-bold text-white hover:bg-teal-700 transition"
                >
                  View Details
                </button>
              </div>

              {/* Invite button */}
              <button
                type="button"
                onClick={onInviteMembers}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-teal-400 border border-slate-700 hover:bg-slate-700 transition"
              >
                <UserPlus size={13} />
                Invite Trip Members
              </button>
            </>
          )}

          {/* TAB 2: MEMBERS & VEHICLES */}
          {activeTab === "groups" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                  <span>VEHICLE GROUPS</span>
                </div>
                <div className="space-y-2">
                  {vehicleGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No active vehicles yet.</p>
                  ) : (
                    vehicleGroups.map((group) => (
                      <div key={group.id} className="rounded-xl bg-slate-800/40 border border-slate-800/30 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${group.color}`} />
                            <div className="text-xs">
                              <p className="font-semibold text-slate-200">{group.label}</p>
                              <p className="text-[10px] text-slate-400">
                                {group.members.length} Member{group.members.length !== 1 ? "s" : ""}
                                {group.avgSpeed != null ? ` • ${group.avgSpeed} mph` : ""}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold ${
                            group.statusStr === "On route" ? "text-green-400" :
                            group.statusStr === "Offline" ? "text-slate-500" :
                            "text-amber-400"
                          }`}>
                            {group.statusStr}
                          </span>
                        </div>
                        
                        {/* Member items inside the vehicle */}
                        <div className="mt-2 pl-3 border-l border-slate-800 space-y-1">
                          {group.members.map((member, idx) => {
                            const badge = getMemberStatusBadge(member, destination);
                            const nameStr = member.display_name || member.name || "Member";
                            return (
                              <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                                <span className="text-slate-300 font-medium">{nameStr}</span>
                                <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-bold border ${badge.colorClass}`}>
                                  {badge.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: MEETUPS */}
          {activeTab === "meetups" && (
            <>
              <div className="rounded-xl bg-slate-800/30 border border-slate-800/40 p-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Next Meetup</p>
                    <p className="text-sm font-bold text-white mt-0.5">{nextMeetup?.label || "No meetup active"}</p>
                    {nextMeetup && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Est. 12:45 PM • 0.8 mi</p>
                    )}
                  </div>
                  {nextMeetup && (
                    <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[9px] font-bold text-teal-400 border border-teal-500/20 shrink-0">
                      Active
                    </span>
                  )}
                </div>

                {nextMeetup ? (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-teal-600 text-[8px] flex items-center justify-center font-bold">JD</div>
                      <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-indigo-600 text-[8px] flex items-center justify-center font-bold">AS</div>
                      <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-amber-600 text-[8px] flex items-center justify-center font-bold">MK</div>
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateMeetup}
                      className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white hover:bg-teal-700 transition"
                    >
                      Navigate
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">Set a meetup point by clicking on the map coordinates.</p>
                )}
              </div>
            </>
          )}

          {/* TAB 4: REPORTS / HAZARDS */}
          {activeTab === "reports" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                <span>ACTIVE HAZARDS</span>
              </div>
              <div className="space-y-2">
                {/* Hazard reports list mock-up or dynamically populated */}
                <div className="rounded-xl bg-slate-800/40 border border-slate-800/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-500/20 p-1 text-amber-400">
                      <AlertTriangle size={14} />
                    </span>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-200">Construction Work</p>
                      <p className="text-[10px] text-slate-400">0.5 miles ahead • Confirmed by 2</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-800/40 border border-slate-800/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/20 p-1 text-rose-400">
                      <AlertTriangle size={14} />
                    </span>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-200">Speed Camera</p>
                      <p className="text-[10px] text-slate-400">1.2 miles ahead • Limit 65 mph</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WAYRA CHAT SUGGESTION */}
          {activeTab === "wayra" && (
            <div className="rounded-xl bg-teal-950/20 border border-[#0F766E]/20 p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-teal-400">
                <Sparkles size={15} />
                <span className="text-xs font-bold uppercase tracking-wider">Wayra Assistant</span>
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Hello! I am your AI travel buddy. I can monitor traffic, find POIs along the route, coordinate vehicles, and handle emergency scenarios.
              </p>
              <button
                type="button"
                onClick={onOpenWayra}
                className="w-full rounded-lg bg-[#0F766E] py-2 text-center text-xs font-bold text-white hover:bg-teal-700 transition"
              >
                Open Full Wayra Chat
              </button>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Map controls */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Map Controls</p>
                <div className="rounded-xl bg-slate-800/30 border border-slate-800/40 p-3 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Dark Map Style</span>
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isDarkMode ? "bg-teal-600" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isDarkMode ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-slate-800/40 bg-slate-950/20 text-center shrink-0">
          <span className="text-[9px] text-slate-500 font-medium">v1.2.0-prod</span>
        </div>
      </div>
    </div>
  );
}
