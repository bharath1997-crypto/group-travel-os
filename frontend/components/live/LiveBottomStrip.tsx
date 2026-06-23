"use client";

import {
  AlertTriangle,
  Camera,
  Navigation,
  Disc,
  Play,
  SkipForward,
  Info,
} from "lucide-react";

type LiveBottomStripProps = {
  alerts?: any[];
  cameras?: any[];
  onViewAllAlerts?: () => void;
  onViewAllCameras?: () => void;
};

export function LiveBottomStrip({
  alerts = [],
  cameras = [],
  onViewAllAlerts,
  onViewAllCameras,
}: LiveBottomStripProps) {
  // Mock data for display
  const mockAlerts = [
    { type: "Accident", location: "US-24 W (0.3 mi)", time: "2m ago", iconColor: "text-red-500" },
    { type: "Construction", location: "CO-9 S (2.1 mi)", time: "10m ago", iconColor: "text-amber-500" },
    { type: "Road Hazard", location: "I-70 E (4.5 mi)", time: "15m ago", iconColor: "text-yellow-500" },
  ];

  const mockCameras = [
    { name: "Speed Trap 1", road: "US-24 Westbound", limit: "55 mph" },
    { name: "Red Light Cam", road: "CO-9 Intersection", limit: "40 mph" },
    { name: "Traffic Flow Cam", road: "I-70 Exit 201", limit: "65 mph" },
  ];

  const mockParking = [
    { name: "Lake Point Garage", spaces: "45 open", price: "$5/hr", status: "Open" },
    { name: "Marina Surface Lot", spaces: "12 open", price: "Free", status: "Filling" },
    { name: "Scenic Overlook", spaces: "0 open", price: "Free", status: "Full" },
  ];

  const mockCarETAs = [
    { car: "Car 1 (You)", eta: "12:45 PM", duration: "15 min", progress: 90, color: "bg-purple-500" },
    { car: "Car 2", eta: "12:53 PM", duration: "23 min", progress: 75, color: "bg-blue-500" },
    { car: "Car 3", eta: "12:57 PM", duration: "27 min", progress: 68, color: "bg-amber-500" },
  ];

  return (
    <div className="w-full bg-white border-t border-stone-200 px-4 py-3 shadow-inner overflow-x-auto no-scrollbar shrink-0">
      <div className="flex gap-4 min-w-[1200px] md:min-w-0 md:grid md:grid-cols-5">
        
        {/* ROAD ALERTS */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/20 p-3 flex flex-col justify-between h-[156px] w-[240px] md:w-auto shrink-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1">
                <AlertTriangle size={12} className="text-[#0F766E]" />
                Road Alerts
              </span>
              <button
                type="button"
                onClick={onViewAllAlerts}
                className="text-[9px] text-[#0F766E] font-bold hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-1.5">
              {mockAlerts.map((alt, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] leading-tight">
                  <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${alt.iconColor}`} />
                    <span className="font-bold text-stone-850 truncate">{alt.type}</span>
                    <span className="text-stone-450 truncate">({alt.location.split(" ")[0]})</span>
                  </div>
                  <span className="text-stone-400 font-medium shrink-0">{alt.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[8px] text-stone-400 font-semibold flex items-center gap-1 border-t border-stone-100/60 pt-1 mt-1">
            <Info size={10} /> OSRM and user-reported data
          </div>
        </div>

        {/* SPEED CAMERAS */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/20 p-3 flex flex-col justify-between h-[156px] w-[240px] md:w-auto shrink-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1">
                <Camera size={12} className="text-[#0F766E]" />
                Speed Cameras
              </span>
              <button
                type="button"
                onClick={onViewAllCameras}
                className="text-[9px] text-[#0F766E] font-bold hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-1.5">
              {mockCameras.map((cam, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] leading-tight">
                  <div className="truncate max-w-[120px]">
                    <p className="font-bold text-stone-800 truncate">{cam.name}</p>
                    <p className="text-[8px] text-stone-400 truncate">{cam.road}</p>
                  </div>
                  <span className="rounded bg-red-150 border border-red-200 px-1 py-0.5 text-[8px] font-bold text-red-750 shrink-0">
                    {cam.limit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[8px] text-stone-400 font-semibold border-t border-stone-100/60 pt-1 mt-1">
            3 speed traps in radius
          </div>
        </div>

        {/* PARKING */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/20 p-3 flex flex-col justify-between h-[156px] w-[240px] md:w-auto shrink-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1">
                <Navigation size={12} className="text-[#0F766E]" />
                Parking Near Destination
              </span>
              <span className="text-[9px] text-[#0F766E] font-bold cursor-pointer hover:underline">
                View all
              </span>
            </div>
            <div className="space-y-1.5">
              {mockParking.map((prk, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] leading-tight">
                  <div className="truncate max-w-[120px]">
                    <p className="font-bold text-stone-800 truncate">{prk.name}</p>
                    <p className="text-[8px] text-stone-400 truncate">{prk.spaces} · {prk.price}</p>
                  </div>
                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                    prk.status === "Open" ? "bg-green-50 text-green-700" : prk.status === "Filling" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                  }`}>
                    {prk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[8px] text-stone-400 font-semibold border-t border-stone-100/60 pt-1 mt-1">
            Live occupancy updates
          </div>
        </div>

        {/* ETA TO MEETUP */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/20 p-3 flex flex-col justify-between h-[156px] w-[240px] md:w-auto shrink-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 truncate max-w-[150px]">
                ETA: Lake View Point
              </span>
              <span className="text-[9px] text-stone-400 font-semibold">Meetup</span>
            </div>
            <div className="space-y-2">
              {mockCarETAs.map((car, idx) => (
                <div key={idx} className="text-[9px]">
                  <div className="flex justify-between font-bold text-stone-750 mb-0.5">
                    <span>{car.car}</span>
                    <span>{car.duration}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-stone-150 overflow-hidden">
                    <div className={`h-full rounded-full ${car.color}`} style={{ width: `${car.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[8px] text-stone-400 font-semibold border-t border-[#F1F3F5] pt-0.5 mt-1">
            Re-calculating routes in real-time
          </div>
        </div>

        {/* TRIP MUSIC */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/20 p-3 flex flex-col justify-between h-[156px] w-[240px] md:w-auto shrink-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1">
                <Disc size={12} className="text-[#0F766E]" />
                Trip Music
              </span>
              <span className="rounded bg-green-100 px-1 py-0.5 text-[8px] font-bold text-green-700">
                Spotify
              </span>
            </div>
            <div className="mt-2 text-center">
              <p className="text-[11px] font-bold text-stone-800 truncate">Roadtrip Anthems v4</p>
              <p className="text-[9px] text-stone-450 truncate">Now playing: Born to Run</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <button type="button" className="rounded-full bg-stone-200 p-1.5 text-stone-600 hover:bg-stone-300 transition">
                  <Play size={12} fill="currentColor" />
                </button>
                <button type="button" className="rounded-full bg-stone-200 p-1.5 text-stone-600 hover:bg-stone-300 transition">
                  <SkipForward size={12} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
          <div className="text-[8px] text-stone-400 font-semibold border-t border-stone-100/60 pt-1 mt-1 text-center">
            Connected to vehicle audio
          </div>
        </div>

      </div>
    </div>
  );
}
