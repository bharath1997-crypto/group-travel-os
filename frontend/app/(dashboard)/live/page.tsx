"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  Car,
  Bike,
  Footprints,
  Compass,
  Navigation,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Bell,
  Layers,
  Maximize2,
  Locate,
  MapPin,
  Clock,
  Bookmark,
  Users,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

// Dynamically import MapLibre map to prevent SSR issues
const LiveMap = dynamic(() => import("./LiveMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 text-sm font-medium">
      Loading Interactive Map...
    </div>
  ),
});

export default function LiveLandingPage() {
  // Required exact State variables
  const [liveStage, setLiveStage] = useState<string>("static_landing");
  const [workflowType, setWorkflowType] = useState<"solo" | "group" | "seat_share">("solo");
  const [travelMode, setTravelMode] = useState<"drive" | "bike" | "trek" | "walk">("drive");
  const [liveStatus, setLiveStatus] = useState<string>("not_started");
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);

  // UI State toggles for Map controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [activeLayer, setActiveLayer] = useState<"street" | "satellite" | "dark">("street");
  const [searchQuery, setSearchQuery] = useState("");

  const mapRef = useRef<any>(null);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-slate-900 select-none">
      {/* MAP BACKGROUND (HERO) */}
      <div className="absolute inset-0 z-0">
        <LiveMap activeLayer={activeLayer} mapRef={mapRef} />
      </div>

      {/* TOP LEFT CONTROLS PANEL */}
      <div className="absolute top-4 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] flex flex-col gap-3 pointer-events-auto">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg w-fit">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            Live not started
          </span>
        </div>

        {/* Destination Search Bar */}
        <div className="relative flex items-center w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden focus-within:ring-2 focus-within:ring-[#0F766E]">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search places, stops, meet points..."
            className="w-full py-3 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 bg-transparent outline-none"
          />
        </div>

        {/* Travel Mode Selector */}
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/80 flex items-center justify-between gap-1">
          {[
            { id: "drive", label: "Drive", icon: Car },
            { id: "bike", label: "Bike", icon: Bike },
            { id: "trek", label: "Trek", icon: Footprints },
            { id: "walk", label: "Walk", icon: Navigation },
          ].map((mode) => {
            const IconComponent = mode.icon;
            const active = travelMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTravelMode(mode.id as any)}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-[#0F766E] text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <IconComponent className="h-4 w-4 mb-0.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Workflow Selector */}
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/80 grid grid-cols-3 gap-1">
          {[
            { id: "solo", label: "Solo" },
            { id: "group", label: "Group Travel" },
            { id: "seat_share", label: "Seat Share" },
          ].map((flow) => {
            const active = workflowType === flow.id;
            return (
              <button
                key={flow.id}
                onClick={() => setWorkflowType(flow.id as any)}
                className={`py-2 px-1 rounded-xl text-[11px] font-semibold text-center truncate transition-all ${
                  active
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {flow.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT MAP CONTROLS (VERTICALLY STACKED) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 pointer-events-auto bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/80">
        <button
          onClick={() => mapRef.current?.zoomIn?.()}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut?.()}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-px w-full bg-slate-200" />
        <button
          onClick={() => mapRef.current?.locateUser?.()}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          title="Locate"
        >
          <Locate className="h-4 w-4" />
        </button>
        <button
          onClick={() => setSoundEnabled((prev) => !prev)}
          className={`p-2 rounded-xl transition ${
            soundEnabled ? "text-[#0F766E] bg-[#F0FDF9]" : "text-slate-400 hover:bg-slate-100"
          }`}
          title="Sound"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setAlertsEnabled((prev) => !prev)}
          className={`p-2 rounded-xl transition ${
            alertsEnabled ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:bg-slate-100"
          }`}
          title="Alerts"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            setActiveLayer((prev) =>
              prev === "street" ? "satellite" : prev === "satellite" ? "dark" : "street"
            )
          }
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          title={`Layer: ${activeLayer}`}
        >
          <Layers className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="h-px w-full bg-slate-200" />
        <button
          onClick={() => mapRef.current?.locateUser?.()}
          className="p-2 rounded-xl text-[#0F766E] hover:bg-[#F0FDF9] transition"
          title="My Location"
        >
          <Compass className="h-4 w-4" />
        </button>
      </div>

      {/* CENTER CARD */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-slate-200/90 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Where are you headed?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Search a place, pick a saved spot, or open your group trip
            </p>
          </div>

          <div className="space-y-3">
            {/* Recent Searches */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                <Clock className="h-3 w-3" />
                Recent Searches
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Airport Terminal 2", detail: "International Hub" },
                  { name: "Central Station", detail: "Downtown Platform" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPlace(item)}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition text-left"
                  >
                    <MapPin className="h-4 w-4 text-[#0F766E] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Places */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                <Bookmark className="h-3 w-3" />
                Saved Places
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { label: "Home", icon: MapPin },
                  { label: "Office", icon: MapPin },
                  { label: "Beach House", icon: MapPin },
                ].map((spot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPlace(spot)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition shrink-0 text-xs font-medium text-slate-700"
                  >
                    <spot.icon className="h-3.5 w-3.5 text-amber-500" />
                    {spot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Open Group Trip */}
            <div className="pt-1">
              <button
                onClick={() => {}}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md hover:from-slate-800 hover:to-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#0F766E] flex items-center justify-center text-white">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">Open Group Trip</p>
                    <p className="text-[10px] text-slate-300">
                      Connect convoy & live tracking
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
