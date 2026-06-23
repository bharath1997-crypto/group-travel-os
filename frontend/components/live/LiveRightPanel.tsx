"use client";

import {
  Share2,
  MapPin,
  Phone,
  AlertTriangle,
  Music,
  Utensils,
  Fuel,
  Calendar,
  Compass,
  CloudSun,
  AlertOctagon,
  Grid,
  MapPin as PinIcon,
  Car,
  AlertCircle,
  Battery,
  Shield,
  Activity,
} from "lucide-react";

type TimelineEvent = {
  id: string;
  icon: any;
  iconColor: string;
  bgColor: string;
  time: string;
  desc: string;
};

type LiveRightPanelProps = {
  onQuickAction: (actionId: string) => void;
  cohesionScore?: "Good" | "Fair" | "Poor";
  cohesionPercentage?: number;
  onOpenSOS?: () => void;
  onOpenMeetupSetup?: () => void;
  onOpenLocationShare?: () => void;
};

export function LiveRightPanel({
  onQuickAction,
  cohesionScore = "Good",
  cohesionPercentage = 88,
  onOpenSOS,
  onOpenMeetupSetup,
  onOpenLocationShare,
}: LiveRightPanelProps) {
  const events: TimelineEvent[] = [
    {
      id: "1",
      icon: MapPin,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
      time: "10:15 AM",
      desc: "Trip started by Bharath",
    },
    {
      id: "2",
      icon: Car,
      iconColor: "text-amber-650",
      bgColor: "bg-amber-50",
      time: "11:04 AM",
      desc: "Car 2 fuel stop (8 min)",
    },
    {
      id: "3",
      icon: PinIcon,
      iconColor: "text-teal-600",
      bgColor: "bg-teal-50",
      time: "11:45 AM",
      desc: "Meetup created: Lake View Point",
    },
    {
      id: "4",
      icon: AlertCircle,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      time: "12:02 PM",
      desc: "Alex outside group radius (0.7 mi)",
    },
    {
      id: "5",
      icon: Activity,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      time: "12:25 PM",
      desc: "Car 3 slowed down: Traffic ahead",
    },
  ];

  const quickActions = [
    { id: "share_loc", label: "Share Location", icon: Share2, onClick: onOpenLocationShare },
    { id: "meetup_pt", label: "Meetup Point", icon: PinIcon, onClick: onOpenMeetupSetup },
    { id: "group_call", label: "Group Call", icon: Phone },
    { id: "send_alert", label: "Send Alert", icon: AlertTriangle },
    { id: "music", label: "Music", icon: Music },
    { id: "find_food", label: "Find Food", icon: Utensils },
    { id: "fuel_stops", label: "Fuel Stops", icon: Fuel },
    { id: "events", label: "Events", icon: Calendar },
    { id: "parking", label: "Parking", icon: Compass },
    { id: "weather", label: "Weather", icon: CloudSun },
    { id: "sos", label: "SOS Alert", icon: AlertOctagon, onClick: onOpenSOS, isCritical: true },
    { id: "more", label: "More Tools", icon: Grid },
  ];

  return (
    <div className="hidden lg:flex h-full w-[280px] flex-col border-l border-stone-200 bg-white p-4 overflow-y-auto custom-scrollbar shrink-0">
      
      {/* LIVE TIMELINE */}
      <div className="mb-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
            Live Timeline
          </h3>
          <span className="text-[10px] text-[#0F766E] font-semibold hover:underline cursor-pointer">
            View all
          </span>
        </div>
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt.id} className="flex gap-2.5 items-start">
              <span className={`rounded-xl p-2 ${evt.bgColor} ${evt.iconColor} shrink-0`}>
                <evt.icon size={14} />
              </span>
              <div className="text-[11px] leading-snug">
                <span className="block font-bold text-stone-500">{evt.time}</span>
                <span className="font-semibold text-stone-800">{evt.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mb-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
            Quick Actions
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                if (act.onClick) act.onClick();
                else onQuickAction(act.id);
              }}
              className={`flex flex-col items-center justify-center rounded-2xl border p-2 text-center transition ${
                act.isCritical
                  ? "bg-red-50/50 border-red-205 hover:bg-red-100/60"
                  : "bg-stone-50/40 border-stone-200/70 hover:bg-stone-50 hover:border-stone-300"
              }`}
            >
              <act.icon
                size={18}
                className={`mb-1 shrink-0 ${act.isCritical ? "text-red-650" : "text-[#0F766E]"}`}
              />
              <span className="text-[9px] font-bold text-stone-700 leading-tight">
                {act.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* GROUP COHESION */}
      <div>
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
            Group Cohesion
          </h3>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700">Cohesion Score</span>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-extrabold text-green-700">
              {cohesionScore}
            </span>
          </div>

          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                style={{ width: `${cohesionPercentage}%` }}
              />
            </div>
          </div>

          {/* Sub-scores */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white border border-stone-100 p-2 shadow-sm">
              <Car size={14} className="mx-auto text-teal-650 mb-1" />
              <p className="text-[9px] text-stone-400 font-semibold">Distance</p>
              <p className="text-[10px] font-extrabold text-green-700">Good</p>
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-2 shadow-sm">
              <Battery size={14} className="mx-auto text-teal-650 mb-1" />
              <p className="text-[9px] text-stone-400 font-semibold">Battery</p>
              <p className="text-[10px] font-extrabold text-green-700">Good</p>
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-2 shadow-sm">
              <Shield size={14} className="mx-auto text-teal-650 mb-1" />
              <p className="text-[9px] text-stone-400 font-semibold">Members</p>
              <p className="text-[10px] font-extrabold text-green-700">7 / 8</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
