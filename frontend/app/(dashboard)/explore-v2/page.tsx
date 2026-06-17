"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Navigation,
  ChevronDown,
  Compass,
  Ticket,
  Camera,
  Mountain,
  Gamepad2,
  FerrisWheel,
  Utensils,
  Trees,
  Moon,
  Activity,
  ShoppingBag,
  Search,
  Map,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { ExploreV2Card, ExplorePlace } from "@/components/explore/ExploreV2Card";
import { ExploreV2EventCard, ExploreEventV2 } from "@/components/explore/ExploreV2EventCard";
import { ExploreV2Section } from "@/components/explore/ExploreV2Section";

const CATEGORIES = [
  { id: "all", label: "All", icon: "🗺️" },
  { id: "events", label: "Events", icon: "🎪" },
  { id: "activities", label: "Activities", icon: "🏄" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "restaurant", label: "Food", icon: "🍽️" },
  { id: "nightlife", label: "Nightlife", icon: "🎵" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "park", label: "Parks", icon: "🌿" },
  { id: "gaming", label: "Gaming", icon: "🎮" },
  { id: "amusement", label: "Amusement", icon: "🎡" },
  { id: "trekking", label: "Trekking", icon: "🥾" },
  { id: "landmark", label: "Landmarks", icon: "🏛️" },
];

const TOP_CITIES = [
  { name: "Chicago", state: "IL", emoji: "🏙️", activities: "2,400+" },
  { name: "New York", state: "NY", emoji: "🗽", activities: "4,200+" },
  { name: "Los Angeles", state: "CA", emoji: "🎬", activities: "3,800+" },
  { name: "Miami", state: "FL", emoji: "🏖️", activities: "1,900+" },
  { name: "Las Vegas", state: "NV", emoji: "🎰", activities: "1,600+" },
  { name: "Austin", state: "TX", emoji: "🎸", activities: "1,200+" },
];

const CITY_COORDS: Record<string, { lat: number; lng: number; country: string }> = {
  "Chicago": { lat: 41.8781, lng: -87.6298, country: "United States" },
  "New York": { lat: 40.7128, lng: -74.0060, country: "United States" },
  "Los Angeles": { lat: 34.0522, lng: -118.2437, country: "United States" },
  "Miami": { lat: 25.7617, lng: -80.1918, country: "United States" },
  "Las Vegas": { lat: 36.1716, lng: -115.1398, country: "United States" },
  "Austin": { lat: 30.2672, lng: -97.7431, country: "United States" },
};

interface SectionsData {
  activities: ExplorePlace[];
  events: ExploreEventV2[];
  landmarks: ExplorePlace[];
  trekking: ExplorePlace[];
  gaming: ExplorePlace[];
  amusement: ExplorePlace[];
  restaurants: ExplorePlace[];
  parks: ExplorePlace[];
  nightlife: ExplorePlace[];
  sports: ExplorePlace[];
  shopping: ExplorePlace[];
}

export default function ExploreV2Page() {
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("Chicago");
  const [country, setCountry] = useState("United States");
  const [lat, setLat] = useState(41.8781);
  const [lng, setLng] = useState(-87.6298);

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"any" | "today" | "weekend">("any");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const [sections, setSections] = useState<SectionsData>({
    activities: [],
    events: [],
    landmarks: [],
    trekking: [],
    gaming: [],
    amusement: [],
    restaurants: [],
    parks: [],
    nightlife: [],
    sports: [],
    shopping: [],
  });

  const fetchV2 = async <T,>(path: string, params: Record<string, any>) => {
    const token = getToken();
    if (!token) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    const root = API_BASE.replace(/\/api\/v1\/?$/, "");
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (key === "categories" && Array.isArray(val)) {
        val.forEach((v) => searchParams.append("categories", v));
      } else if (val !== undefined && val !== null) {
        searchParams.set(key, String(val));
      }
    }
    const url = `${root}/api/v2/explorer${path}?${searchParams.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return res.json() as Promise<T>;
  };

  const loadData = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      // 1. Geocode City Name
      try {
        const cityData = await fetchV2<{ city: string; country: string }>("/city", {
          lat: latitude,
          lng: longitude,
        });
        if (cityData.city) {
          setCity(cityData.city);
          setCountry(cityData.country || "United States");
        }
      } catch (err) {
        console.error("City reverse geocoding failed, using fallbacks:", err);
      }

      // 2. Fetch all sections in parallel
      const [
        activitiesRes,
        eventsRes,
        landmarksRes,
        trekkingRes,
        gamingRes,
        amusementRes,
        restaurantsRes,
        parksRes,
        nightlifeRes,
        sportsRes,
        shoppingRes,
      ] = await Promise.all([
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5 }).catch(() => ({ places: [] })),
        fetchV2<ExploreEventV2[]>("/events", { lat: latitude, lng: longitude, radius_m: 50000, limit: 8 }).catch(() => []),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["landmark", "sightseeing", "monument"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["nature", "trail", "viewpoint"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["gaming"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["amusement_park", "theme_park"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["restaurant", "cafe", "food"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["park", "garden", "beach"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["bar", "pub", "nightclub"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["stadium", "sports", "gym"] }).catch(() => ({ places: [] })),
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["shopping", "mall", "store"] }).catch(() => ({ places: [] })),
      ]);

      setSections({
        activities: activitiesRes.places || [],
        events: eventsRes || [],
        landmarks: landmarksRes.places || [],
        trekking: trekkingRes.places || [],
        gaming: gamingRes.places || [],
        amusement: amusementRes.places || [],
        restaurants: restaurantsRes.places || [],
        parks: parksRes.places || [],
        nightlife: nightlifeRes.places || [],
        sports: sportsRes.places || [],
        shopping: shoppingRes.places || [],
      });
    } catch (error) {
      console.error("Failed to load explorer data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check auth
    const token = getToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    // Geolocation detection
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;
          setLat(uLat);
          setLng(uLng);
          loadData(uLat, uLng);
        },
        (error) => {
          console.warn("Geolocation access denied or failed, using Chicago fallback.", error);
          loadData(lat, lng);
        },
        { timeout: 8000 }
      );
    } else {
      loadData(lat, lng);
    }
  }, []);

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput.trim()) return;

    setIsEditingLocation(false);
    setLoading(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`,
        {
          headers: {
            "User-Agent": "Rovvy/1.0 (contact@rovvy.app)",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);
          const displayName = data[0].display_name;
          const parts = displayName.split(",");
          const resolvedCity = parts[0]?.trim() || locationInput;
          const resolvedCountry = parts[parts.length - 1]?.trim() || "United States";

          setLat(newLat);
          setLng(newLng);
          setCity(resolvedCity);
          setCountry(resolvedCountry);
          
          await loadData(newLat, newLng);
        } else {
          alert("City not found. Please try another name.");
          setLoading(false);
        }
      } else {
        throw new Error("Geocoding service unavailable");
      }
    } catch (err) {
      console.error("Location lookup failed:", err);
      alert("Could not change location. Please try again.");
      setLoading(false);
    }
  };

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    if (catId === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      let sectionName = catId;
      if (catId === "restaurant") sectionName = "restaurants";
      if (catId === "landmark") sectionName = "landmarks";
      if (catId === "park") sectionName = "parks";
      
      const id = `section-${sectionName}`;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Client side date filtering
  const filterEventsByDate = (events: ExploreEventV2[]) => {
    if (dateFilter === "any") return events;
    return events.filter((ev) => {
      if (!ev.start_time) return false;
      const d = new Date(ev.start_time);
      const now = new Date();
      if (dateFilter === "today") {
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      if (dateFilter === "weekend") {
        const day = d.getDay();
        return day === 0 || day === 5 || day === 6;
      }
      return true;
    });
  };

  // Client side search filtering
  const filterItems = <T extends { name?: string | null; title?: string | null; category?: string | null; subcategory?: string | null }>(
    items: T[]
  ): T[] => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      const nameMatch = (item.name || item.title || "").toLowerCase().includes(term);
      const catMatch = (item.category || "").toLowerCase().includes(term);
      const subMatch = (item.subcategory || "").toLowerCase().includes(term);
      return nameMatch || catMatch || subMatch;
    });
  };

  const filteredActivities = filterItems(sections.activities);
  const filteredEvents = filterItems(filterEventsByDate(sections.events));
  const filteredLandmarks = filterItems(sections.landmarks);
  const filteredTrekking = filterItems(sections.trekking);
  const filteredGaming = filterItems(sections.gaming);
  const filteredAmusement = filterItems(sections.amusement);
  const filteredRestaurants = filterItems(sections.restaurants);
  const filteredParks = filterItems(sections.parks);
  const filteredNightlife = filterItems(sections.nightlife);
  const filteredSports = filterItems(sections.sports);
  const filteredShopping = filterItems(sections.shopping);

  const totalPlacesCount =
    filteredActivities.length +
    filteredLandmarks.length +
    filteredTrekking.length +
    filteredGaming.length +
    filteredAmusement.length +
    filteredRestaurants.length +
    filteredParks.length +
    filteredNightlife.length +
    filteredSports.length +
    filteredShopping.length;

  const SkeletonCard = () => (
    <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] overflow-hidden p-3 animate-pulse shrink-0 w-[240px] md:w-auto">
      <div className="h-[120px] bg-slate-100 rounded-lg mb-3" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
  );

  const SkeletonEventCard = () => (
    <div className="flex items-center gap-3 bg-white border-[0.5px] border-slate-200 rounded-[12px] p-2 animate-pulse shrink-0 w-[280px] md:w-auto">
      <div className="w-[76px] h-[76px] rounded-lg bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
      </div>
    </div>
  );

  return (
    <div className="bg-white text-slate-800 p-6 pb-20 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* 2. HERO SECTION */}
        <div style={{
          background: 'linear-gradient(135deg, #0F766E 0%, #134E4A 100%)',
          borderRadius: '16px',
          padding: '40px 32px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background pattern */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.1,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />
          
          <h1 style={{
            color: '#FFFFFF', fontSize: '28px', fontWeight: 700,
            marginBottom: '8px', position: 'relative'
          }}>
            Discover experiences near you
          </h1>
          
          {/* Geocoding City display and edit button */}
          <div style={{
            color: 'rgba(255,255,255,0.8)', fontSize: '15px',
            marginBottom: '24px', position: 'relative', display: 'flex',
            alignItems: 'center', gap: '8px', flexWrap: 'wrap'
          }}>
            <span>Explore near you · within 250 miles of</span>
            {isEditingLocation ? (
              <form onSubmit={handleLocationSubmit} style={{ display: 'inline-block' }}>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  style={{
                    border: 'none', outline: 'none', fontSize: '14px',
                    padding: '4px 10px', borderRadius: '6px', color: '#0F172A',
                    background: '#FFFFFF', width: '140px'
                  }}
                  placeholder="Type city name..."
                  autoFocus
                  onBlur={() => setTimeout(() => setIsEditingLocation(false), 200)}
                />
              </form>
            ) : (
              <button
                onClick={() => {
                  setIsEditingLocation(true);
                  setLocationInput(city);
                }}
                style={{
                  border: 'none', outline: 'none', background: 'rgba(255,255,255,0.15)',
                  color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>{city}, {country}</span>
                <span>✏️</span>
              </button>
            )}
          </div>
          
          {/* Search bar */}
          <div style={{
            background: '#FFFFFF', borderRadius: '12px',
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            gap: '12px', maxWidth: '600px', position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <span style={{fontSize: '18px'}}>🔍</span>
            <input
              placeholder="Search activities, landmarks, events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none', outline: 'none', fontSize: '15px',
                flex: 1, color: '#0F172A', background: 'transparent'
              }}
            />
            <div style={{
              background: '#0F766E', color: '#fff', padding: '8px 20px',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
              Search
            </div>
          </div>
        </div>

        {/* 5. CITY DESTINATION GRID */}
        <section style={{marginBottom: '40px'}}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '16px'
          }}>
            <h2 style={{fontSize: '20px', fontWeight: 700, color: '#0F172A'}}>
              Where to next?
            </h2>
            <a style={{fontSize: '14px', color: '#0F766E', cursor: 'pointer'}}>
              See more →
            </a>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '12px'
          }}>
            {TOP_CITIES.map(city => (
              <div key={city.name} style={{
                borderRadius: '12px', overflow: 'hidden',
                background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                padding: '20px 16px', cursor: 'pointer',
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              onClick={async () => {
                const coords = CITY_COORDS[city.name];
                if (coords) {
                  setLat(coords.lat);
                  setLng(coords.lng);
                  setCity(city.name);
                  setCountry(coords.country);
                  await loadData(coords.lat, coords.lng);
                }
              }}
              >
                <div style={{fontSize: '28px', marginBottom: '8px'}}>
                  {city.emoji}
                </div>
                <div style={{
                  fontSize: '15px', fontWeight: 700,
                  color: '#FFFFFF', marginBottom: '2px'
                }}>{city.name}</div>
                <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.7)'}}>
                  {city.activities} activities
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. CATEGORY ICON STRIP */}
        <div style={{
          display: 'flex', gap: '8px', overflowX: 'auto',
          padding: '4px 0 12px', marginBottom: '24px',
          scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent'
        }} className="[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '4px', padding: '10px 16px', borderRadius: '12px',
                border: activeCategory === cat.id 
                  ? '2px solid #0F766E' : '2px solid #E2E8F0',
                background: activeCategory === cat.id ? '#F0FDF4' : '#FFFFFF',
                cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '70px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{fontSize: '22px'}}>{cat.icon}</span>
              <span style={{
                fontSize: '11px', fontWeight: 500,
                color: activeCategory === cat.id ? '#0F766E' : '#64748B'
              }}>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Filters and Actions Row (Date, Map View) */}
        <div className="flex items-center gap-3 justify-between flex-wrap mb-10">
          {/* Date Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-350 rounded-full text-xs font-semibold bg-white text-slate-700 shadow-sm transition shrink-0"
            >
              <span>
                {dateFilter === "any" && "📅 Any date"}
                {dateFilter === "today" && "📅 Today"}
                {dateFilter === "weekend" && "📅 This weekend"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {showDateDropdown && (
              <div className="absolute left-0 mt-1.5 w-36 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-20">
                <button
                  onClick={() => { setDateFilter("any"); setShowDateDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${dateFilter === "any" ? "text-[#0F766E] font-semibold" : "text-slate-600"}`}
                >Any date</button>
                <button
                  onClick={() => { setDateFilter("today"); setShowDateDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${dateFilter === "today" ? "text-[#0F766E] font-semibold" : "text-slate-600"}`}
                >Today</button>
                <button
                  onClick={() => { setDateFilter("weekend"); setShowDateDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${dateFilter === "weekend" ? "text-[#0F766E] font-semibold" : "text-slate-600"}`}
                >This weekend</button>
              </div>
            )}
          </div>

          {/* Map View Link */}
          <Link
            href={`/explore/map?lat=${lat}&lng=${lng}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-teal-700 text-white rounded-full font-bold text-xs shadow-sm transition"
          >
            <Map className="h-3.5 w-3.5" />
            <span>Map view</span>
          </Link>
        </div>

        {/* Sections Feed */}
        {loading ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
              <div className="flex overflow-x-auto gap-4 pb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </section>
            
            <section className="space-y-4">
              <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
              <div className="flex overflow-x-auto gap-4 pb-4">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonEventCard key={i} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-10 transition-opacity duration-300">
            {/* Section 1: Activities near you */}
            {filteredActivities.length > 0 && (
              <div id="section-activities">
                <ExploreV2Section
                  title="Activities near you"
                  icon={<Compass className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}`}
                >
                  {filteredActivities.map((place) => (
                    <ExploreV2Card key={place.id} place={place} showDistance={true} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 2: Upcoming events */}
            {filteredEvents.length > 0 && (
              <div id="section-events">
                <ExploreV2Section
                  title="Upcoming events"
                  icon={<Ticket className="h-4.5 w-4.5" />}
                  seeAllHref="/explore"
                  isEvents={true}
                >
                  {filteredEvents.map((event) => (
                    <ExploreV2EventCard key={event.id} event={event} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 3: Map Strip Banner */}
            {!loading && totalPlacesCount > 0 && (
              <div className="bg-[#0F766E] rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm hover:shadow-md transition">
                <div className="text-center md:text-left space-y-1">
                  <h3 className="text-base font-bold">
                    Explore {totalPlacesCount} places near you on the map
                  </h3>
                  <p className="text-xs text-teal-100">
                    Find and filter photo spots, outdoor adventures, restaurants, nightlife, and more.
                  </p>
                </div>
                <Link
                  href={`/explore/map?lat=${lat}&lng=${lng}`}
                  className="bg-white hover:bg-teal-50 text-[#0F766E] px-5 py-2.5 rounded-full font-bold text-xs shadow-sm transition"
                >
                  Open map
                </Link>
              </div>
            )}

            {/* Section 4: Photo spots & landmarks */}
            {filteredLandmarks.length > 0 && (
              <div id="section-landmarks">
                <ExploreV2Section
                  title="Photo spots & landmarks"
                  icon={<Camera className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=landmark`}
                >
                  {filteredLandmarks.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 5: Trekking & adventure */}
            {filteredTrekking.length > 0 && (
              <div id="section-trekking">
                <ExploreV2Section
                  title="Trekking & adventure"
                  icon={<Mountain className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=nature`}
                >
                  {filteredTrekking.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 6: Gaming */}
            {filteredGaming.length > 0 && (
              <div id="section-gaming">
                <ExploreV2Section
                  title="Gaming"
                  icon={<Gamepad2 className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=gaming`}
                >
                  {filteredGaming.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 7: Amusement parks */}
            {filteredAmusement.length > 0 && (
              <div id="section-amusement">
                <ExploreV2Section
                  title="Amusement parks"
                  icon={<FerrisWheel className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=amusement_park`}
                >
                  {filteredAmusement.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 8: Restaurants & food */}
            {filteredRestaurants.length > 0 && (
              <div id="section-restaurants">
                <ExploreV2Section
                  title="Restaurants & food"
                  icon={<Utensils className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=restaurant`}
                >
                  {filteredRestaurants.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 9: Parks & outdoors */}
            {filteredParks.length > 0 && (
              <div id="section-parks">
                <ExploreV2Section
                  title="Parks & outdoors"
                  icon={<Trees className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=park`}
                >
                  {filteredParks.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 10: Nightlife */}
            {filteredNightlife.length > 0 && (
              <div id="section-nightlife">
                <ExploreV2Section
                  title="Nightlife"
                  icon={<Moon className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=bar`}
                >
                  {filteredNightlife.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 11: Sports & fitness */}
            {filteredSports.length > 0 && (
              <div id="section-sports">
                <ExploreV2Section
                  title="Sports & fitness"
                  icon={<Activity className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=sports`}
                >
                  {filteredSports.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Section 12: Shopping */}
            {filteredShopping.length > 0 && (
              <div id="section-shopping">
                <ExploreV2Section
                  title="Shopping"
                  icon={<ShoppingBag className="h-4.5 w-4.5" />}
                  seeAllHref={`/explore/map?lat=${lat}&lng=${lng}&categories=shopping`}
                >
                  {filteredShopping.map((place) => (
                    <ExploreV2Card key={place.id} place={place} />
                  ))}
                </ExploreV2Section>
              </div>
            )}

            {/* Empty State */}
            {totalPlacesCount === 0 && filteredEvents.length === 0 && (
              <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Compass className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">No experiences found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Try adjusting your search terms or search for activities in a different location.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
