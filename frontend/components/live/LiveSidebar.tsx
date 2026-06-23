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
import { useState, useEffect } from "react";
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

  // Compute status counts
  const totalMembers = tripMembers.length || 8;
  // Mock status counts for display matching rovvy_live_1.png
  const movingCount = 6;
  const stoppedCount = 1;
  const offlineCount = 1;

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
          <span>{totalMembers} Members • 3 Cars</span>
          <span className="flex items-center gap-1 text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-400 border border-green-500/20">
            🟢 {movingCount} Moving
          </span>
          <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            🟡 {stoppedCount} Stopped
          </span>
          <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            🔴 {offlineCount} Offline
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
          {/* Car 1 */}
          <div className="flex items-center justify-between rounded-xl bg-slate-800/40 p-2.5 border border-slate-800/30">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Car 1 (You)</p>
                <p className="text-[10px] text-slate-400">3 Members</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-green-400">ETA 2:15 PM</span>
          </div>
          {/* Car 2 */}
          <div className="flex items-center justify-between rounded-xl bg-slate-800/40 p-2.5 border border-slate-800/30">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Car 2</p>
                <p className="text-[10px] text-slate-400">2 Members</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-amber-400">8 min behind</span>
          </div>
          {/* Car 3 */}
          <div className="flex items-center justify-between rounded-xl bg-slate-800/40 p-2.5 border border-slate-800/30">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Car 3</p>
                <p className="text-[10px] text-slate-400">3 Members</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-rose-400">12 min behind</span>
          </div>
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
