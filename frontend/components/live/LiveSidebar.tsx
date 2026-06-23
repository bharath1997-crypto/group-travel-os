"use client";

import {
  Home,
  Map,
  Radio,
  Users,
  MapPin,
  AlertTriangle,
  MessageSquare,
  DollarSign,
  BarChart,
  Image as ImageIcon,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Menu,
  Play,
  Pause,
  Square,
  UserPlus,
  ChevronLeft,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { RovvyLogo } from "@/components/RovvyLogo";
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
  isOpen: boolean;
  onToggle: () => void;
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
  isOpen,
  onToggle,
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

  // Compute status counts & groupings
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
      return { label: "Offline", colorClass: "bg-stone-500/10 text-stone-405 border-stone-500/20" };
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
      return { label: "On the Way", colorClass: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
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
        if (mode === "driving") {
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

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "trips", label: "Trips", icon: Map },
    { id: "live", label: "LIVE", icon: Radio, isLive: true },
    { id: "groups", label: "Groups", icon: Users },
    { id: "meetups", label: "Meetups", icon: MapPin },
    { id: "reports", label: "Reports", icon: AlertTriangle },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: 2 },
    { id: "expenses", label: "Expenses", icon: DollarSign },
    { id: "polls", label: "Polls", icon: BarChart },
    { id: "memories", label: "Memories", icon: ImageIcon },
    { id: "wayra", label: "Wayra AI", icon: Sparkles, tag: "BETA" },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (!isOpen) {
    return (
      <div className="flex h-full w-16 flex-col items-center bg-[#0F172A] py-4 text-white">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 hover:bg-slate-800"
          aria-label="Expand Sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="mt-8 flex flex-col gap-6">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative rounded-lg p-2 transition hover:bg-slate-800 ${
                activeTab === item.id ? "text-[#0F766E]" : "text-slate-400"
              }`}
              title={item.label}
            >
              <item.icon size={20} />
              {item.isLive && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[260px] flex-col bg-[#0F172A] text-white overflow-y-auto custom-scrollbar border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <RovvyLogo variant="white" className="h-6 w-auto" />
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white animate-pulse">
            LIVE
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Collapse Sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Group Pulse summary layer 1 */}
      <div className="px-4 py-3 bg-[#1E293B]/40 border-b border-slate-800/40">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>{sidebarCounts.totalMembers} Member{sidebarCounts.totalMembers !== 1 ? "s" : ""} • {vehicleGroups.length} Car{vehicleGroups.length !== 1 ? "s" : ""}</span>
          <span className={`flex items-center gap-1 ${sidebarCounts.hasOnlineMember ? "text-green-400" : "text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sidebarCounts.hasOnlineMember ? "bg-green-400 animate-pulse" : "bg-stone-500"}`} />
            {sidebarCounts.hasOnlineMember ? "Live" : "Inactive"}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-400 border border-green-500/20">
            🟢 {sidebarCounts.movingCount} Moving
          </span>
          <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            🟡 {sidebarCounts.stoppedCount} Stopped
          </span>
          {sidebarCounts.staleCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-400 border border-orange-500/20">
              🟠 {sidebarCounts.staleCount} Stale
            </span>
          )}
          <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            🔴 {sidebarCounts.offlineCount} Offline
          </span>
        </div>
      </div>

      {/* GROUP OVERVIEW */}
      <div className="px-4 py-3 border-b border-slate-800/40">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span>GROUP VEHICLES</span>
          <span className="text-[10px] text-teal-400 hover:underline cursor-pointer">View all</span>
        </div>
        <div className="mt-2.5 space-y-2">
          {vehicleGroups.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">No live members yet.</p>
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
                  <span className={`text-[10px] font-semibold ${
                    group.statusStr === "On route" ? "text-green-400" :
                    group.statusStr === "Offline" ? "text-slate-500" :
                    "text-amber-400"
                  }`}>
                    {group.statusStr}
                  </span>
                </div>
                
                {/* Member List within the Vehicle Group */}
                <div className="mt-2 pl-4 border-l border-slate-850 space-y-1.5">
                  {group.members.map((member, idx) => {
                    const badge = getMemberStatusBadge(member, destination);
                    const nameStr = member.display_name || member.name || "Member";
                    return (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">{nameStr}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${badge.colorClass}`}>
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

      {/* NEXT MEETUP */}
      <div className="px-4 py-3 border-b border-slate-800/40">
        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Next Meetup</p>
        <div className="mt-1 flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-white">{nextMeetup?.label || "Lake View Point"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Est. 12:45 PM • 0.8 mi</p>
          </div>
          <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-400 border border-teal-500/20">
            6/8 Arrived
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {/* Avatar stack */}
          <div className="flex -space-x-1.5 overflow-hidden">
            <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-teal-600 text-[8px] flex items-center justify-center font-bold">JD</div>
            <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-indigo-600 text-[8px] flex items-center justify-center font-bold">AS</div>
            <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-amber-600 text-[8px] flex items-center justify-center font-bold">MK</div>
            <div className="inline-block h-5 w-5 rounded-full ring-2 ring-[#0F172A] bg-slate-700 text-[8px] flex items-center justify-center font-bold text-slate-300">+2</div>
          </div>
          <button
            type="button"
            onClick={onNavigateMeetup}
            className="rounded-lg border border-teal-500/50 px-2.5 py-1 text-xs font-bold text-teal-400 hover:bg-teal-500 hover:text-white transition"
          >
            Navigate
          </button>
        </div>
      </div>

      {/* TRIP TIMER */}
      <div className="px-4 py-3 border-b border-slate-800/40">
        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Trip Timer</p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-800 p-1.5 text-teal-400">
              <Sun className="animate-spin-slow" size={14} />
            </span>
            <span className="font-mono text-sm font-semibold tracking-wider text-white">
              {formatTimer(timerSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTimerIsActive(!timerIsActive)}
              className="rounded-lg bg-slate-800 p-1 text-slate-300 hover:bg-slate-700 transition"
              title={timerIsActive ? "Pause" : "Resume"}
            >
              {timerIsActive ? <Pause size={14} /> : <Play size={14} />}
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
              <Square size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4">
        <p className="px-4 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">Navigation</p>
        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#0F766E]/20 text-teal-400 border-l-4 border-[#0F766E]"
                    : "text-slate-300 hover:bg-slate-850 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={16} className={isActive ? "text-teal-400" : "text-slate-400"} />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {item.badge && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.tag && (
                    <span className="rounded bg-[#0F766E]/30 px-1.5 py-0.5 text-[8px] font-bold text-teal-400">
                      {item.tag}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* WAYRA AI Card */}
      <div className="m-3 rounded-2xl bg-[#0F766E]/15 border border-[#0F766E]/25 p-3.5">
        <div className="flex items-center gap-2 text-teal-400">
          <Sparkles size={14} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider">Wayra AI Assistant</span>
        </div>
        <p className="mt-2 text-xs text-slate-300 leading-normal">
          Suggesting fuel stop: Love's Travel Stop is 4.2 miles ahead. Save 10 min.
        </p>
        <button
          type="button"
          onClick={onOpenWayra}
          className="mt-3 w-full rounded-xl bg-[#0F766E] py-2 text-center text-xs font-bold text-white hover:bg-teal-700 transition"
        >
          View Suggestion
        </button>
      </div>

      {/* Invite Members & Settings */}
      <div className="mt-auto p-3 border-t border-slate-800/60 bg-slate-950/40">
        <button
          type="button"
          onClick={onInviteMembers}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-teal-700 transition"
        >
          <UserPlus size={14} />
          Invite Members
        </button>
        <div className="mt-3 flex items-center justify-between px-2 text-slate-400">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-white"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className="text-[10px] text-slate-500 font-medium">v1.2.0-prod</span>
        </div>
      </div>
    </div>
  );
}
