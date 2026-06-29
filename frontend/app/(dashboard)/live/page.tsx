"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  MapPin,
  Search,
  Star,
  Volume2,
  VolumeX,
  Bell,
  Layers,
  Maximize2,
} from "lucide-react";

const LiveMapComponent = dynamic(() => import("./LiveMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm font-medium">
      Loading Map...
    </div>
  ),
});

const TRAVEL_MODES = ["Drive", "Bike", "Trek", "Walk"] as const;
const WORKFLOW_TYPES = ["Solo", "Group Travel", "Seat Share"] as const;

export default function LivePage() {
  const mapRef = useRef<any>(null);
  const router = useRouter();

  const [activeLayer, setActiveLayer] = 
    useState<"street" | "satellite" | "dark">("street");
  const [liveStage, setLiveStage] = useState("static_landing");
  const [workflowType, setWorkflowType] = 
    useState<typeof WORKFLOW_TYPES[number]>("Solo");
  const [travelMode, setTravelMode] = 
    useState<typeof TRAVEL_MODES[number]>("Drive");
  const [liveStatus] = useState("not_started");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [destination, setDestination] = useState(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const recentSearches = [
    "Starbucks Reserve Chicago",
    "Shedd Aquarium", 
    "Navy Pier",
  ];

  const savedPlaces = [
    { name: "Home", address: "123 Main St" },
    { name: "Work", address: "456 Broadway" },
    { name: "Gym", address: "789 Fitness Ave" },
  ];

  function locateUser() {
    mapRef.current?.locateUser();
  }

  return (
    <div className="h-full relative select-none">
      {/* Map */}  
      <LiveMapComponent 
        activeLayer={activeLayer}
        mapRef={mapRef}
      />
      
      {/* Left Controls */}
      <div className="absolute top-4 left-4 p-3 z-10 bg-white rounded-xl shadow-lg">
        {/* Status Pill */}
        <div className="flex items-center gap-1.5 px-2 py-1 mb-3 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-100 w-max">
          Live not started
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-full bg-stone-100 w-72 lg:w-80">
          <Search className="w-4 h-4 shrink-0 text-stone-400" />
          <input
            type="text"
            placeholder="Search places, stops, meet points..."
            className="w-full bg-transparent focus:outline-none text-sm text-stone-600 placeholder:text-stone-400"
          />
        </div>

        {/* Travel Mode + Workflow */}
        <div className="flex gap-3">
          <select
            value={travelMode}
            onChange={e => setTravelMode(e.target.value as any)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 outline-none bg-white"
          >
            {TRAVEL_MODES.map(mode => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <select
            value={workflowType}
            onChange={e => setWorkflowType(e.target.value as any)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 outline-none bg-white"
          >  
            {WORKFLOW_TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center Card */}  
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-white rounded-xl shadow-lg p-5 max-w-sm text-center w-full max-sm:px-4">
        <h3 className="text-lg font-semibold text-stone-900 mb-2">
          Where are you headed?
        </h3>
        <p className="text-sm text-stone-500">
          Search a place, pick a saved spot, or open your group trip.
        </p>

        <div className="mt-4 pt-3 border-t border-stone-100">
          <h4 className="mb-1.5 text-[13px] font-semibold text-stone-500">
            Recent Searches
          </h4>
          <ul className="flex flex-col gap-1 text-sm text-stone-600">
            {recentSearches.map(search => (
              <li key={search}>
                <button 
                  type="button"
                  className="flex justify-between items-center w-full px-2 py-1.5 hover:bg-stone-50 rounded" 
                >
                  {search}
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mt-3">
          <h4 className="mb-1.5 text-[13px] font-semibold text-stone-500">
            Saved Places
          </h4>
          <ul className="flex flex-col gap-1 text-sm text-stone-600">
            {savedPlaces.map(place => (
              <li key={place.name}>
                <button
                  type="button"
                  className="flex justify-between items-center w-full px-2 py-1.5 hover:bg-stone-50 rounded"
                >
                  <span className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-400 shrink-0" />
                    {place.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />  
                </button>
              </li>  
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="px-4 py-2 text-sm font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-lg w-full"
            onClick={() => router.push("/trips")}
          >
            Open Group Trip
          </button>
        </div>
      </div>

      {/* Right Map Controls */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-10">
        <button
          type="button" 
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg" 
          onClick={() => mapRef.current?.zoomIn()}
        >
          <span className="text-2xl font-light text-stone-600">+</span>
        </button>
        <button 
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => mapRef.current?.zoomOut()}  
        >
          <span className="text-2xl font-light text-stone-600">-</span>  
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"  
          onClick={locateUser}
          title="Locate User"
        >
          <MapPin className="w-5 h-5 text-stone-500" />
        </button>
        <button
          type="button"  
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => setSoundEnabled(prev => !prev)}
          title="Sound"
        >
          {soundEnabled ? (
            <Volume2 className="w-5 h-5 text-stone-500" />
          ) : (
            <VolumeX className="w-5 h-5 text-stone-300" />
          )}
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"  
          onClick={() => setAlertsEnabled(prev => !prev)}
          title="Alerts"
        >
          <Bell className={`w-5 h-5 ${alertsEnabled ? "text-amber-500" : "text-stone-300"}`} />
        </button>
        <button
          type="button"  
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => {
            const layers = ["street", "satellite", "dark"] as const;  
            setActiveLayer(current => {
              const i = layers.indexOf(current);
              return layers[(i + 1) % layers.length];  
            })
          }}
          title={`Layer: ${activeLayer}`}
        >
          <Layers className="w-5 h-5 text-stone-500" />
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"  
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-5 h-5 text-stone-500" />
        </button>
      </div>
    </div>
  );
}
