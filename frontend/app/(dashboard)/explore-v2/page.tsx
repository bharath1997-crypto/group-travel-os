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
  Star,
  Map,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { ExploreV2Card, ExplorePlace } from "@/components/explore/ExploreV2Card";
import { ExploreV2EventCard, ExploreEventV2 } from "@/components/explore/ExploreV2EventCard";
import { ExploreV2Section } from "@/components/explore/ExploreV2Section";

const CATEGORIES = [
  "All",
  "Events",
  "Landmarks",
  "Trekking",
  "Gaming",
  "Amusement",
  "Restaurants",
  "Parks",
  "Nightlife",
  "Sports",
  "Shopping",
];

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
  const [activeCategory, setActiveCategory] = useState("All");

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
        fetchV2<{ places: ExplorePlace[] }>("/nearby", { lat: latitude, lng: longitude, limit: 5, categories: ["gaming", "entertainment", "arcade"] }).catch(() => ({ places: [] })),
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

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    if (cat === "All") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const id = `section-${cat.toLowerCase()}`;
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
        const day = d.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
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

  // Total places count for map strip banner
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
    <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] overflow-hidden p-3 animate-pulse">
      <div className="h-[120px] bg-slate-100 rounded-lg mb-3" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
  );

  const SkeletonEventCard = () => (
    <div className="flex items-center gap-3 bg-white border-[0.5px] border-slate-200 rounded-[12px] p-2 animate-pulse">
      <div className="w-[76px] h-[76px] rounded-lg bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-white text-slate-800 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Hero Section */}
        <header className="space-y-1">
          <h1 className="text-[20px] font-medium text-slate-900 leading-tight">
            Discover experiences near you
          </h1>
          <p className="text-[13px] text-slate-500 flex items-center gap-1 font-normal">
            <MapPin className="h-4 w-4 text-[#0F766E] shrink-0" />
            <span>{city}, {country}</span>
          </p>
        </header>

        {/* Search & Filter Row */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Input */}
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities, landmarks, events…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition"
            />
          </div>

          {/* Location Pill */}
          <div className="flex items-center">
            {isEditingLocation ? (
              <form onSubmit={handleLocationSubmit} className="relative z-10">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#0F766E] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0F766E] text-slate-800 w-36"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F766E] hover:bg-teal-700 text-white rounded-full text-xs font-semibold shadow-sm transition shrink-0"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>{city}</span>
              </button>
            )}
          </div>

          {/* Date Filter Pill */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="inline-flex items-center gap-1 px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-full text-xs font-medium bg-white text-slate-700 shadow-sm transition shrink-0"
            >
              <span>
                {dateFilter === "any" && "Any date"}
                {dateFilter === "today" && "Today"}
                {dateFilter === "weekend" && "This weekend"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            
            {showDateDropdown && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-20">
                <button
                  onClick={() => {
                    setDateFilter("any");
                    setShowDateDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${
                    dateFilter === "any" ? "text-[#0F766E] font-semibold" : "text-slate-600"
                  }`}
                >
                  Any date
                </button>
                <button
                  onClick={() => {
                    setDateFilter("today");
                    setShowDateDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${
                    dateFilter === "today" ? "text-[#0F766E] font-semibold" : "text-slate-600"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    setDateFilter("weekend");
                    setShowDateDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition ${
                    dateFilter === "weekend" ? "text-[#0F766E] font-semibold" : "text-slate-600"
                  }`}
                >
                  This weekend
                </button>
              </div>
            )}
          </div>

          {/* Map View Button */}
          <Link
            href="/explore/map"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-teal-700 text-white rounded-full font-medium text-xs shadow-sm transition shrink-0"
          >
            <Map className="h-3.5 w-3.5" />
            <span>Map view</span>
          </Link>
        </div>

        {/* Category Chips Scroll Row */}
        <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                  activeCategory === cat
                    ? "border-[#0F766E] text-[#0F766E] bg-teal-50/20"
                    : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sections Feed */}
        {loading ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </section>
            
            <section className="space-y-4">
              <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
    </main>
  );
}
