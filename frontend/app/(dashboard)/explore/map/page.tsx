"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Loader } from "@googlemaps/js-api-loader";
import {
  ArrowLeft,
  Calendar,
  Compass,
  MapPin,
  Search,
  Star,
  Info,
  Map,
  List,
  Grid,
  Navigation,
  Share2,
  CalendarPlus,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cityLabel } from "@/lib/explore-events";

// Custom pin colors per category
const PIN_COLORS: Record<string, string> = {
  Events: "#3B82F6",
  Activities: "#0F766E",
  Food: "#F97316",
  Parks: "#10B981",
  Nightlife: "#EC4899",
  Gaming: "#8B5CF6",
  Amusement: "#EF4444",
  Trekking: "#F59E0B",
  Landmarks: "#F59E0B",
  Shopping: "#6366F1",
  Sports: "#6366F1"
};

const PIN_EMOJI: Record<string, string> = {
  Events: "🎵",
  Activities: "🎭",
  Food: "🍕",
  Parks: "🌲",
  Nightlife: "🍸",
  Gaming: "🎮",
  Amusement: "🎢",
  Trekking: "🥾",
  Landmarks: "📸",
  Shopping: "🛍️",
  Sports: "⚾"
};

const CATEGORIES = [
  "All",
  "Events",
  "Activities",
  "Food",
  "Parks",
  "Nightlife",
  "Gaming",
  "Amusement",
  "Trekking",
  "Landmarks",
  "Shopping",
  "Sports"
];

// Rich fallback placeholder locations
const PLACEHOLDERS: Record<string, any[]> = {
  landmarks: [
    { id: "p-lm-1", name: "Millennium Park Cloud Gate", category: "Landmarks", venue: "Millennium Park", price_min: 0, price_max: 0 },
    { id: "p-lm-2", name: "Chicago Skydeck Ledge", category: "Landmarks", venue: "Willis Tower", price_min: 35, price_max: 45 },
    { id: "p-lm-3", name: "Navy Pier Centennial Wheel", category: "Landmarks", venue: "Navy Pier", price_min: 18, price_max: 25 },
    { id: "p-lm-4", name: "Art Institute of Chicago", category: "Landmarks", venue: "Art Institute", price_min: 25, price_max: 30 },
    { id: "p-lm-5", name: "Wrigley Field Historic Tour", category: "Landmarks", venue: "Wrigley Field", price_min: 30, price_max: 40 }
  ],
  trekking: [
    { id: "p-tk-1", name: "Starved Rock Canyons Hike", category: "Trekking", venue: "Starved Rock State Park", price_min: 0, price_max: 0 },
    { id: "p-tk-2", name: "Waterfall Glen Trail Loop", category: "Trekking", venue: "Waterfall Glen Forest Preserve", price_min: 0, price_max: 0 },
    { id: "p-tk-3", name: "Swallow Cliff Stairclimb", category: "Trekking", venue: "Swallow Cliff Woods", price_min: 0, price_max: 0 },
    { id: "p-tk-4", name: "Des Plaines River Kayak Trail", category: "Trekking", venue: "Des Plaines River", price_min: 15, price_max: 30 },
    { id: "p-tk-5", name: "Palos Forest Mountain Biking", category: "Trekking", venue: "Palos Trail System", price_min: 0, price_max: 0 }
  ],
  gaming: [
    { id: "p-gm-1", name: "Ignite Gaming Esports League", category: "Gaming", venue: "Ignite Gaming Lounge", price_min: 10, price_max: 25 },
    { id: "p-gm-2", name: "Galloping Ghost Arcade", category: "Gaming", venue: "Galloping Ghost Arcade", price_min: 25, price_max: 25 },
    { id: "p-gm-3", name: "VR Cyber Arena Tournament", category: "Gaming", venue: "Basecamp Esports", price_min: 30, price_max: 50 }
  ],
  amusement: [
    { id: "p-am-1", name: "Six Flags Great America Passes", category: "Amusement", venue: "Six Flags", price_min: 45, price_max: 85 },
    { id: "p-am-2", name: "Santa's Village Family Azoosment", category: "Amusement", venue: "Santa's Village", price_min: 32, price_max: 38 },
    { id: "p-am-3", name: "Safari Land Indoor Coasters", category: "Amusement", venue: "Safari Land Indoor Park", price_min: 15, price_max: 25 }
  ],
  food: [
    { id: "p-fd-1", name: "Alinea Michelin Dinner", category: "Food", venue: "Alinea", price_min: 250, price_max: 450 },
    { id: "p-fd-2", name: "Lou Malnati's Deep Dish Workshop", category: "Food", venue: "Lou Malnati's", price_min: 30, price_max: 50 },
    { id: "p-fd-3", name: "Girl & The Goat Chef's Table", category: "Food", venue: "Girl & The Goat", price_min: 80, price_max: 150 }
  ]
};

// Client-side Haversine helper
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ExploreMapViewPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Default to Chicago coordinates
  const [userLocation, setUserLocation] = useState({ lat: 41.8781, lng: -87.6298 });
  const [displayCity, setDisplayCity] = useState("Chicago");
  const [radius, setRadius] = useState<number>(50);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("This Weekend");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState("☀️ 71°F · Clear · Chicago");

  // Interaction State
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [votes, setVotes] = useState<Record<string, "go" | "skip" | "maybe">>({});
  const [events, setEvents] = useState<any[]>([]);

  // Open-Meteo Weather Integration
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.lat}&longitude=${userLocation.lng}&current_weather=true`
        );
        if (res.ok) {
          const data = await res.json();
          const tempC = data.current_weather.temperature;
          const tempF = Math.round((tempC * 9) / 5 + 32);
          const code = data.current_weather.weathercode;

          let condition = "Clear";
          let emoji = "☀️";
          if (code >= 1 && code <= 3) {
            condition = "Partly Cloudy";
            emoji = "⛅";
          } else if (code === 45 || code === 48) {
            condition = "Foggy";
            emoji = "🌫️";
          } else if (code >= 51 && code <= 67) {
            condition = "Rainy";
            emoji = "🌧️";
          } else if (code >= 71 && code <= 77) {
            condition = "Snowy";
            emoji = "❄️";
          } else if (code >= 80 && code <= 82) {
            condition = "Showers";
            emoji = "🌧️";
          } else if (code === 95 || code === 99) {
            condition = "Thunderstorm";
            emoji = "⛈️";
          }

          setWeather(`${emoji} ${tempF}°F · ${condition} · ${cityLabel(displayCity)}`);
        }
      } catch {
        setWeather("☀️ 71°F · Clear · Chicago");
      }
    };
    void fetchWeather();
  }, [userLocation, displayCity]);

  // Geolocation tracking
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(newLoc);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo(newLoc);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 120000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Hydrate local cache or fetch from backend
  useEffect(() => {
    setLoading(true);
    const apiPath = `/explore/events?lat=${userLocation.lat}&lon=${userLocation.lng}&radius=${radius}&per_page=200`;

    apiFetch<any>(apiPath)
      .then((data) => {
        let list = data.events || [];
        if (list.length === 0) {
          list = getHydratedPlaceholders(userLocation.lat, userLocation.lng);
        }
        setEvents(list);
        setIsCached(false);
        try {
          localStorage.setItem("rovvy_map_cache", JSON.stringify(list));
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        console.error("Map events API issue:", err);
        // Load offline cache
        try {
          const cached = localStorage.getItem("rovvy_map_cache");
          if (cached) {
            setEvents(JSON.parse(cached));
            setIsCached(true);
            triggerToast("Showing cached offline results");
          } else {
            // Fallback immediately to nearby placeholders
            setEvents(getHydratedPlaceholders(userLocation.lat, userLocation.lng));
          }
        } catch {
          setEvents(getHydratedPlaceholders(userLocation.lat, userLocation.lng));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userLocation.lat, userLocation.lng, radius]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getHydratedPlaceholders = (lat: number, lng: number) => {
    const list: any[] = [];
    Object.keys(PLACEHOLDERS).forEach((catKey) => {
      const items = PLACEHOLDERS[catKey];
      items.forEach((item, idx) => {
        const angle = (idx * 72 + catKey.charCodeAt(0)) * (Math.PI / 180);
        const radiusDeg = 0.01 + idx * 0.008;
        const offsetLat = lat + Math.sin(angle) * radiusDeg;
        const offsetLng = lng + Math.cos(angle) * radiusDeg;

        list.push({
          ...item,
          venue_lat: offsetLat,
          venue_lon: offsetLng,
          city: item.city || "Nearby",
          distance_miles: haversineDistance(lat, lng, offsetLat, offsetLng)
        });
      });
    });
    return list;
  };

  // Google Maps Loader
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      version: "weekly",
      libraries: ["places", "geometry"]
    });

    (loader as any)
      .load()
      .then((google: any) => {
        const map = new google.maps.Map(mapContainerRef.current!, {
          center: userLocation,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
          styles: [] // Clean standard style
        });

        mapInstanceRef.current = map;

        // User location marker
        new google.maps.Marker({
          position: userLocation,
          map,
          title: "Your Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0F766E",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2
          }
        });
      })
      .catch((err: any) => console.error("Maps loader failed:", err));
  }, []);

  // Update map markers when events or filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === "undefined" || !(window as any).google) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Filter events
    const filtered = events.filter((ev) => {
      const matchCat =
        activeCategory === "All" ||
        (ev.category || "").toLowerCase() === activeCategory.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        ev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.venue?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    filtered.forEach((ev) => {
      const lat = ev.venue_lat || ev.lat;
      const lng = ev.venue_lon || ev.lng;
      if (!lat || !lng) return;

      const marker = new (window as any).google.maps.Marker({
        position: { lat, lng },
        map,
        title: ev.name,
        icon: getPinIcon(ev.category || "Events")
      });

      marker.addListener("click", () => {
        setSelectedItem(ev);
        map.panTo({ lat, lng });
      });

      markersRef.current.push(marker);
    });
  }, [events, activeCategory, searchQuery]);

  // SVG customized category pin icon
  const getPinIcon = (category: string) => {
    if (typeof window === "undefined" || !(window as any).google) return undefined;
    const color = PIN_COLORS[category] || "#0F766E";
    const emoji = PIN_EMOJI[category] || "📍";
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="#FFFFFF" stroke-width="2.5" filter="url(#shadow)"/>
        <text x="20" y="25" font-size="18" text-anchor="middle" font-family="Segoe UI Symbol, Apple Color Emoji">${emoji}</text>
      </svg>
    `;
    return {
      url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
      scaledSize: new (window as any).google.maps.Size(36, 36),
      anchor: new (window as any).google.maps.Point(18, 18)
    };
  };

  // Memoized lists of filtered items
  const filteredEventsList = useMemo(() => {
    let result = events;
    if (activeCategory !== "All") {
      result = result.filter(
        (ev) => (ev.category || "").toLowerCase() === activeCategory.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ev) =>
          ev.name?.toLowerCase().includes(q) ||
          ev.venue?.toLowerCase().includes(q)
      );
    }
    // Sort by distance
    return [...result].sort((a, b) => (a.distance_miles || 0) - (b.distance_miles || 0));
  }, [events, activeCategory, searchQuery]);

  // Drive time estimator
  const driveTime = (miles: number) => {
    const mins = Math.max(2, Math.round(miles * 2));
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remaining = mins % 60;
      return `${hrs} hr ${remaining} min`;
    }
    return `${mins} min`;
  };

  const handleVote = (id: string, option: "go" | "skip" | "maybe") => {
    setVotes((prev) => ({ ...prev, [id]: prev[id] === option ? undefined : (option as any) }));
    triggerToast(`Vote registered: ${option.toUpperCase()}`);
  };

  const toggleSaveItem = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        triggerToast("Removed from saved list");
      } else {
        next.add(id);
        triggerToast("Saved to Trip Workspace!");
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
              {weather}
            </span>
          </div>
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2">
          {/* Mode Toggles */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <Link href="/explore">
              <button className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                <List size={14} />
                <span>List</span>
              </button>
            </Link>
            <button className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-teal-700 shadow-sm">
              <Map size={14} />
              <span>Map</span>
            </button>
          </div>

          {/* Date Selector */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300"
            >
              <option>Today</option>
              <option>This Weekend</option>
              <option>This Week</option>
            </select>
          </div>

          {/* Radius Selector */}
          <div className="relative">
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300"
            >
              <option value={10}>10 miles</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
              <option value={200}>200 miles</option>
            </select>
          </div>

          {/* Search bar */}
          <div className="relative w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search map..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-3 text-xs outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2 shrink-0 overflow-x-auto select-none no-scrollbar">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const count = events.filter(
            (ev) => cat === "All" || (ev.category || "").toLowerCase() === cat.toLowerCase()
          ).length;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0 ${
                isActive
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span>{PIN_EMOJI[cat] || "🧭"}</span>
              <span>{cat}</span>
              <span
                className={`ml-1 rounded px-1 py-0.2 text-[9px] ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Map & Sidebar Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Map view (left, full height minus bottom strip) */}
        <div className="flex-1 h-full relative flex flex-col">
          <div ref={mapContainerRef} className="flex-1 w-full bg-slate-100 relative" />

          {/* Floating Premium Popup Card at Bottom Left of Map */}
          {selectedItem && (
            <div className="absolute bottom-4 left-4 z-10 w-80 rounded-2xl border border-white/20 bg-white/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-start mb-2">
                <span className="rounded-lg px-2 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur" style={{ backgroundColor: PIN_COLORS[selectedItem.category] || "#0F766E" }}>
                  {PIN_EMOJI[selectedItem.category] || "🧭"} {selectedItem.category || "Place"}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                  🚗 {driveTime(selectedItem.distance_miles || 1.5)} drive
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{selectedItem.name}</h3>
              <div className="flex items-center gap-1.5 my-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-[9px] text-slate-500">4.5 (200+)</span>
              </div>
              <div className="flex items-start gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="truncate">{selectedItem.venue}</span>
              </div>
              
              {/* Actions Grid */}
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => triggerToast("Booking experience redirect...")}
                  className="rounded-lg bg-teal-700 py-1.5 text-center text-[10px] font-bold text-white hover:bg-teal-800 transition"
                >
                  Book
                </button>
                <button 
                  onClick={() => toggleSaveItem(selectedItem.id)}
                  className={`rounded-lg py-1.5 text-center text-[10px] font-bold transition border ${
                    savedIds.has(selectedItem.id)
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {savedIds.has(selectedItem.id) ? "Saved!" : "Save to Trip"}
                </button>
                <button 
                  onClick={() => triggerToast("Group Poll created!")}
                  className="rounded-lg bg-slate-100 py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  Poll
                </button>
              </div>
            </div>
          )}

          {/* Street View thumbnail strip */}
          <div className="h-[60px] bg-slate-900 flex items-center px-4 gap-4 overflow-x-auto text-white text-xs border-t border-slate-800 shrink-0">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Street View:</span>
            {selectedItem ? (
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-20 rounded bg-slate-800 overflow-hidden relative border border-slate-700 shrink-0">
                  <img
                    src={`https://maps.googleapis.com/maps/api/streetview?size=160x80&location=${selectedItem.venue_lat || 41.8781},${selectedItem.venue_lon || -87.6298}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                    alt="Street View Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=160&q=80";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate text-slate-200 text-[11px]">{selectedItem.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{selectedItem.venue}</p>
                </div>
              </div>
            ) : (
              <span className="text-slate-500 italic text-[10px]">Select a marker on the map to see Street View panorama</span>
            )}
          </div>
        </div>

        {/* Sidebar list (right, 265px) */}
        <div className="w-[265px] border-l border-slate-200 flex flex-col h-full bg-white shrink-0 select-none">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700">Explore List</span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              {filteredEventsList.length} items
            </span>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredEventsList.map((ev) => {
              const isSelected = selectedItem?.id === ev.id;
              const hasSaved = savedIds.has(ev.id);
              const vote = votes[ev.id];

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedItem(ev)}
                  className={`p-3 transition hover:bg-slate-50/80 cursor-pointer ${
                    isSelected ? "bg-teal-50/60 border-l-4 border-teal-700" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-bold truncate flex items-center gap-1" style={{ color: PIN_COLORS[ev.category] || "#0F766E" }}>
                      {PIN_EMOJI[ev.category] || "🧭"} {ev.category}
                    </span>
                    {hasSaved && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Saved to Trip" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{ev.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{ev.venue}</p>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/60">
                    <span className="text-[9px] text-slate-400">
                      🚗 {driveTime(ev.distance_miles || 1.5)}
                    </span>
                    
                    {/* Voting Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "go");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "go" ? "text-emerald-600 bg-emerald-50" : "text-slate-400"
                        }`}
                        title="Go"
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "skip");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "skip" ? "text-rose-600 bg-rose-50" : "text-slate-400"
                        }`}
                        title="Skip"
                      >
                        <ThumbsDown size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "maybe");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "maybe" ? "text-amber-600 bg-amber-50" : "text-slate-400"
                        }`}
                        title="Maybe"
                      >
                        <HelpCircle size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEventsList.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-400 italic">No matching places found</p>
            )}
          </div>

          {/* Bottom Actions Workspace */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2 shrink-0">
            <button
              onClick={() => triggerToast("Group Poll created in Trip Workspace!")}
              className="w-full rounded-xl bg-teal-700 py-2 text-center text-xs font-bold text-white hover:bg-teal-800 transition"
            >
              Group Poll
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerToast("Planning route sequence...")}
                className="rounded-xl border border-slate-200 bg-white py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Plan Route
              </button>
              <button
                onClick={() => triggerToast("Structuring Plan Day schedule...")}
                className="rounded-xl border border-slate-200 bg-white py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Plan Day
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Toast Messages */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
