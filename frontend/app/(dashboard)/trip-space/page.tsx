"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Calendar,
  Users,
  Compass,
  DollarSign,
  Activity,
  Utensils,
  ChevronRight,
  Info,
  ArrowLeft,
  Navigation,
  Vote,
  Plus,
  Search,
  Building,
  Briefcase,
  Clock,
  Sparkles,
  CloudSun,
  AlertCircle,
  ThumbsUp,
  CheckCircle,
  ExternalLink,
  Share2,
  Car
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDashboardUser } from "@/contexts/dashboard-user-context";

// Curated fallback destinations for Chicago
const CHICAGO_DESTINATIONS = [
  {
    name: "Starved Rock State Park",
    state: "IL",
    drive: "1.5 hrs",
    vibe: "Hiking, Canyons, Waterfalls",
    image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
    city_search: "Utica,IL",
    why: "Perfect for scenic hiking through towering canyons and seeing seasonal waterfalls. Ideal for active group outings.",
    activities: [
      { name: "Canyon Hiking", desc: "Explore the famous French Canyon and Wildcat Canyon trails." },
      { name: "Waterfall Tour", desc: "Discover hidden waterfalls deep in the sandstone canyons." },
      { name: "Eagle Watching", desc: "Spot bald eagles soaring over the scenic Illinois River." },
      { name: "Kayaking & Canoeing", desc: "Paddle down the river for unique scenic viewpoints." }
    ],
    parking: "Main Lower Dell area fills by 10 AM on holiday weekends. Overflow parking is available at the overflow lots on Route 71.",
    fuel_miles: 95
  },
  {
    name: "Galena",
    state: "IL",
    drive: "2.5 hrs",
    vibe: "Charming town, Rolling hills, History",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    city_search: "Galena,IL",
    why: "Rich historical heritage, boutique shopping, wine tasting, and beautiful views across the rolling hills of northwest Illinois.",
    activities: [
      { name: "Historic Main Street", desc: "Stroll 19th-century storefronts filled with local boutique shops." },
      { name: "Wine Tasting", desc: "Sip local wines at the award-winning Galena Cellars Vineyard." },
      { name: "Bike Rentals", desc: "Ride along the scenic Galena River Trail for peaceful views." },
      { name: "Haunted History Tours", desc: "Take an evening ghost walk through Galena's oldest neighborhoods." }
    ],
    parking: "Metered parking is available on Main St. Large free public lots are located just across the footbridge near Grant Park.",
    fuel_miles: 160
  },
  {
    name: "Lake Geneva",
    state: "WI",
    drive: "1.5 hrs",
    vibe: "Lake activities, Boating, Beaches",
    image: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
    city_search: "Lake Geneva,WI",
    why: "The ultimate classic resort town. Incredible lake-path hikes, dynamic boat charters, beaches, and lively dining spots.",
    activities: [
      { name: "Boat Rentals", desc: "Rent a pontoon boat or take a historical narrated cruise." },
      { name: "Scenic Lake Path Hike", desc: "Walk the historic 21-mile shorepath past historic Gilded Age estates." },
      { name: "Riviera Beach Day", desc: "Relax on the sandy shores and swim in crystal-clear waters." },
      { name: "Zip Lining", desc: "Fly through the forest canopy at Lake Geneva Zipline Adventures." }
    ],
    parking: "Paid parking is enforced around the beach and downtown. Free parking is available further up Broad St and in municipal lots.",
    fuel_miles: 83
  },
  {
    name: "Shawnee National Forest",
    state: "IL",
    drive: "3 hrs",
    vibe: "Rock formations, Hiking, Camping",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800",
    city_search: "Harrisburg,IL",
    why: "Incredible rock canyons and rugged stone cliffs. Features the stunning Garden of the Gods and spectacular scenic viewpoints.",
    activities: [
      { name: "Garden of the Gods Trail", desc: "Witness the iconic Camel Rock and dramatic rock formations." },
      { name: "Rim Rock Drive Hike", desc: "Hike around a massive ancient stone escarpment." },
      { name: "Jackson Falls Climbing", desc: "Climb beautiful stone walls or hike down to quiet pools." },
      { name: "Pounds Hollow Swim", desc: "Cool off in a tranquil forest lake with sand beach." }
    ],
    parking: "Garden of the Gods trailhead parking is free but gets highly congested. Always arrive early in the morning.",
    fuel_miles: 300
  },
  {
    name: "Peninsula State Park",
    state: "WI",
    drive: "3 hrs",
    vibe: "Camping, Kayaking, Scenic views",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    city_search: "Fish Creek,WI",
    why: "Stunning bluffs looking out over Green Bay, historic lighthouses, biking, kayaking, and exceptional sunset viewpoints.",
    activities: [
      { name: "Eagle Tower Walk", desc: "Walk the fully accessible canopy boardwalk for panoramic views." },
      { name: "Sunset Sea Kayaking", desc: "Paddle around the bluffs and islands of Door County." },
      { name: "Biking the Sunset Trail", desc: "Pedal a flat, scenic 9.6-mile path through deep cedar forests." },
      { name: "Eagle Bluff Lighthouse", desc: "Tour the beautifully restored 1868 lighthouse perched on a cliff." }
    ],
    parking: "Wisconsin State Park vehicle admission sticker is required. Buy online or at park entry station.",
    fuel_miles: 250
  }
];

export default function TripSpacePage() {
  const { user } = useDashboardUser();
  const router = useRouter();
  
  // Setup form states
  const [origin, setOrigin] = useState("Chicago");
  const [dateFrom, setDateFrom] = useState("2026-05-24");
  const [dateTo, setDateTo] = useState("2026-05-27");
  const [groupSize, setGroupSize] = useState(6);
  const [maxDriveHours, setMaxDriveHours] = useState(3);
  const [selectedVibe, setSelectedVibe] = useState("Adventure");
  
  // App UI states
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<any | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "stay" | "do" | "eat" | "getting_there">("overview");
  
  // Live API states
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [placesData, setPlacesData] = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [routeData, setRouteData] = useState<any | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // Events integration states
  const [tripEvents, setTripEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Vibe options
  const vibes = ["Adventure", "Nature", "Relaxing", "Cultural", "Food & Drink", "Party"];

  // Search destinations handler
  const handleFindDestinations = async () => {
    setLoadingDestinations(true);
    setSelectedDestination(null);
    try {
      // Call backend route
      const response = await apiFetch<any>(
        `/trip-space/destinations?origin=${encodeURIComponent(origin)}&max_hours=${maxDriveHours}&vibe=${encodeURIComponent(selectedVibe)}`
      );
      if (response && response.destinations && response.destinations.length > 0) {
        setDestinations(response.destinations);
      } else {
        // Fallback filter
        const filtered = CHICAGO_DESTINATIONS.filter(d => {
          const hours = parseFloat(d.drive);
          return hours <= maxDriveHours;
        });
        setDestinations(filtered.length > 0 ? filtered : CHICAGO_DESTINATIONS);
      }
    } catch (err) {
      console.error("Failed to fetch destinations:", err);
      // Fallback
      setDestinations(CHICAGO_DESTINATIONS);
    } finally {
      setLoadingDestinations(false);
    }
  };

  // Fetch destination specific details on selection
  useEffect(() => {
    if (!selectedDestination) return;

    // 1. Fetch Weather
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const res = await apiFetch<any>(`/explore/weather?city=${encodeURIComponent(selectedDestination.city_search)}`);
        if (res && res.weather) {
          setWeatherData(res.weather);
        } else {
          setWeatherData({ temp_c: 21, description: "Partly Cloudy", humidity: 62, wind_kph: 14 });
        }
      } catch (err) {
        console.error("Failed to fetch weather:", err);
        setWeatherData({ temp_c: 21, description: "Partly Cloudy", humidity: 62, wind_kph: 14 });
      } finally {
        setWeatherLoading(false);
      }
    };

    // 2. Fetch Restaurants
    const fetchRestaurants = async () => {
      setPlacesLoading(true);
      try {
        const res = await apiFetch<any>(
          `/explore/places?city=${encodeURIComponent(selectedDestination.city_search)}&category=restaurants`
        );
        if (res && res.places) {
          setPlacesData(res.places.slice(0, 6));
        } else {
          // Hardcoded fallback restaurants for the destination
          setPlacesData([
            { name: "Riverview Cafe & Bistro", rating: 4.7, address: "102 Main St", types: ["local_cuisine"] },
            { name: "Canyon Grill House", rating: 4.5, address: "55 State Route 71", types: ["steakhouse", "bar"] },
            { name: "The Timberline Bakery", rating: 4.8, address: "14 Broad St", types: ["cafe", "bakery"] },
            { name: "Overlook Tavern", rating: 4.4, address: "201 Scenic Route", types: ["american", "bar"] },
            { name: "Grand Hill Pizzeria", rating: 4.6, address: "88 Market Rd", types: ["italian", "pizza"] },
            { name: "Greenwood Organic Eats", rating: 4.9, address: "12 Pine Rd", types: ["healthy", "vegetarian"] }
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch restaurants:", err);
        setPlacesData([
          { name: "Riverview Cafe & Bistro", rating: 4.7, address: "102 Main St", types: ["local_cuisine"] },
          { name: "Canyon Grill House", rating: 4.5, address: "55 State Route 71", types: ["steakhouse", "bar"] },
          { name: "The Timberline Bakery", rating: 4.8, address: "14 Broad St", types: ["cafe", "bakery"] },
          { name: "Overlook Tavern", rating: 4.4, address: "201 Scenic Route", types: ["american", "bar"] },
          { name: "Grand Hill Pizzeria", rating: 4.6, address: "88 Market Rd", types: ["italian", "pizza"] },
          { name: "Greenwood Organic Eats", rating: 4.9, address: "12 Pine Rd", types: ["healthy", "vegetarian"] }
        ]);
      } finally {
        setPlacesLoading(false);
      }
    };

    // 3. Fetch Route Summary
    const fetchRoute = async () => {
      setRouteLoading(true);
      try {
        const res = await apiFetch<any>(
          `/routes/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(selectedDestination.city_search)}&date=${dateFrom}&adults=${groupSize}`
        );
        if (res) {
          setRouteData(res);
        } else {
          setRouteData({ distance_miles: selectedDestination.fuel_miles || 120, duration_mins: 90 });
        }
      } catch (err) {
        console.error("Failed to fetch routes:", err);
        setRouteData({ distance_miles: selectedDestination.fuel_miles || 120, duration_mins: 90 });
      } finally {
        setRouteLoading(false);
      }
    };

    // 4. Fetch AI Generated Summary
    const fetchAiSummary = async () => {
      setAiSummaryLoading(true);
      try {
        const payload = {
          page: "trip-space",
          user_message: `Suggest a weekend trip itinerary to ${selectedDestination.name} for Memorial Day weekend May 24-27`,
          context: {
            origin_city: origin,
            group_size: groupSize,
            dates: `${dateFrom} to ${dateTo}`,
            max_drive_hours: maxDriveHours,
            vibes: [selectedVibe]
          }
        };
        const res = await apiFetch<any>("/ai/assistant", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (res && res.message) {
          setAiSummary(res.message);
        } else {
          setAiSummary(
            `Here is a perfect weekend getaway plan for your group of ${groupSize} heading from ${origin} to ${selectedDestination.name} from ${dateFrom} to ${dateTo}.\n\n` +
            `This trip perfectly caters to your **${selectedVibe}** vibe! You can look forward to exploring the beautiful regional sights, scenic hiking routes, and historic venues. ` +
            `We recommend departing early on Friday to beat the holiday traffic, settling into your cabin, and starting your exploration fresh.`
          );
        }
      } catch (err) {
        console.error("Failed to fetch AI summary:", err);
        setAiSummary(
          `Here is a perfect weekend getaway plan for your group of ${groupSize} heading from ${origin} to ${selectedDestination.name} from ${dateFrom} to ${dateTo}.\n\n` +
          `This trip perfectly caters to your **${selectedVibe}** vibe! You can look forward to exploring the beautiful regional sights, scenic hiking routes, and historic venues. ` +
          `We recommend departing early on Friday to beat the holiday traffic, settling into your cabin, and starting your exploration fresh.`
        );
      } finally {
        setAiSummaryLoading(false);
      }
    };

    fetchWeather();
    fetchRestaurants();
    fetchRoute();
    fetchAiSummary();
    setSelectedTab("overview");
  }, [selectedDestination]);

  // Fetch events for the selected destination during trip dates
  const fetchTripEvents = async (city: string, dateFrom: string, dateTo: string) => {
    setEventsLoading(true);
    try {
      const citySearch = selectedDestination?.city_search || city;
      const data = await apiFetch<any>(
        `/trip-space/events?city=${encodeURIComponent(citySearch)}&date_from=${dateFrom}&date_to=${dateTo}`
      );
      setTripEvents(data.events || []);
    } catch (e) {
      console.error("Failed to fetch trip events:", e);
      setTripEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDestination && dateFrom && dateTo) {
      fetchTripEvents(selectedDestination.name, dateFrom, dateTo);
    }
  }, [selectedDestination, dateFrom, dateTo]);

  // Create event poll option
  const createEventPoll = () => {
    const pollEvents = tripEvents.slice(0, 4).map(e => ({
      label: e.name,
      description: `${e.date} at ${e.venue}`,
      url: e.ticket_url
    }));
    localStorage.setItem("pending_poll_options", JSON.stringify(pollEvents));
    router.push("/trips/plan");
  };

  // Pre-fill query parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const destParam = params.get("destination");
      const fromParam = params.get("date_from");
      const toParam = params.get("date_to");
      
      if (fromParam) setDateFrom(fromParam);
      if (toParam) setDateTo(toParam);
      
      if (destParam) {
        const match = CHICAGO_DESTINATIONS.find(
          d => d.name.toLowerCase().includes(destParam.toLowerCase()) || 
               d.city_search.toLowerCase().includes(destParam.toLowerCase())
        );
        if (match) {
          setSelectedDestination(match);
        } else {
          const customDest = {
            name: destParam,
            state: "IL",
            drive: "2.0 hrs",
            vibe: "Events Match",
            image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
            city_search: destParam,
            why: `Dynamic destination curated around events happening in ${destParam}.`,
            activities: [],
            parking: "Check local parking guidelines.",
            fuel_miles: 100
          };
          setSelectedDestination(customDest);
        }
      }
    }
  }, []);

  // Load Travelpayouts script when tab changes to stay
  useEffect(() => {
    if (selectedTab === "stay" && selectedDestination) {
      const container = document.getElementById("tp-widget-container");
      if (container) {
        container.innerHTML = "";
        const script = document.createElement("script");
        script.src = "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&powered_by=true&locale=en&searchUrl=www.booking.com%2Fsearch&promo_id=3728&campaign_id=200&color_bg=%231E293B&color_text=%23FFFFFF&color_button=%230F766E";
        script.async = true;
        container.appendChild(script);
      }
    }
  }, [selectedTab, selectedDestination]);

  // Load GetYourGuide widget when tab changes to do
  useEffect(() => {
    if (selectedTab === "do" && selectedDestination) {
      const container = document.getElementById("gyg-widget-container");
      if (container) {
        container.innerHTML = "";
        const div = document.createElement("div");
        div.className = "gyg-widget";
        div.setAttribute("data-gyg-href", "https://widget.getyourguide.com/default/activities.frame");
        div.setAttribute("data-gyg-locale-code", "en-US");
        div.setAttribute("data-gyg-widget", "activities");
        div.setAttribute("data-gyg-number-of-items", "6");
        div.setAttribute("data-gyg-q", selectedDestination.name);
        div.setAttribute("data-gyg-partner-id", "ROVVY01");
        
        const script = document.createElement("script");
        script.src = "https://widget.getyourguide.com/dist/pa.umd.production.min.js";
        script.async = true;
        script.defer = true;
        
        container.appendChild(div);
        container.appendChild(script);
      }
    }
  }, [selectedTab, selectedDestination]);

  // Calculate dynamic fuel cost
  const miles = routeData?.distance_miles || selectedDestination?.fuel_miles || 100;
  const estimatedFuelCost = Math.round((miles / 25) * 3.50);
  const costPerPerson = (estimatedFuelCost / groupSize).toFixed(2);

  // Date formatter
  const formatDateReadable = (ymd: string) => {
    try {
      const d = new Date(ymd);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return ymd;
    }
  };

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8">
      <div className="mx-auto max-w-5xl">
        
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F766E]/20 text-[#CCFBF1]" aria-hidden>
            <Compass className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Trip Space</h1>
            <p className="text-xs text-[#94A3B8] font-medium tracking-wide uppercase">
              Rovvy · Premium Weekend Travel Planner
            </p>
          </div>
        </div>

        {/* Page Content: Form / Suggestion OR Trip Workspace */}
        {!selectedDestination ? (
          <div className="mt-8 space-y-8">
            {/* SETUP FORM */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/70 p-6 shadow-xl backdrop-blur-md">
              <h2 className="text-lg font-bold text-[#CCFBF1] flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-teal-400" />
                Plan Your Perfect Weekend Trip
              </h2>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Starting City */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="origin" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Starting From
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                    <select
                      id="origin"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full rounded-xl border border-[#334155] bg-[#0F172A] py-3 pl-10 pr-4 text-sm text-[#F8FAFC] outline-none focus:border-[#0F766E] transition-colors"
                    >
                      <option value="Chicago">Chicago, IL</option>
                      <option value="New York">New York, NY</option>
                      <option value="San Francisco">San Francisco, CA</option>
                      <option value="Houston">Houston, TX</option>
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Travel Dates
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full rounded-xl border border-[#334155] bg-[#0F172A] py-3 pl-9 pr-2 text-xs text-[#F8FAFC] outline-none focus:border-[#0F766E] transition-colors"
                      />
                    </div>
                    <span className="text-[#94A3B8] text-xs font-bold">to</span>
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full rounded-xl border border-[#334155] bg-[#0F172A] py-3 pl-9 pr-2 text-xs text-[#F8FAFC] outline-none focus:border-[#0F766E] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Group size */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="group-size" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Group Size
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                    <select
                      id="group-size"
                      value={groupSize}
                      onChange={(e) => setGroupSize(parseInt(e.target.value))}
                      className="w-full rounded-xl border border-[#334155] bg-[#0F172A] py-3 pl-10 pr-4 text-sm text-[#F8FAFC] outline-none focus:border-[#0F766E] transition-colors"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} People</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Max Drive hours */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="drive-time" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Max Drive Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                    <select
                      id="drive-time"
                      value={maxDriveHours}
                      onChange={(e) => setMaxDriveHours(parseInt(e.target.value))}
                      className="w-full rounded-xl border border-[#334155] bg-[#0F172A] py-3 pl-10 pr-4 text-sm text-[#F8FAFC] outline-none focus:border-[#0F766E] transition-colors"
                    >
                      <option value={1}>Under 1 hour</option>
                      <option value={2}>Under 2 hours</option>
                      <option value={3}>Under 3 hours</option>
                      <option value={4}>Under 4 hours</option>
                      <option value={5}>Under 5 hours</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* VIBE SELECTOR */}
              <div className="mt-6 flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Select Trip Vibe
                </span>
                <div className="flex flex-wrap gap-2">
                  {vibes.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVibe(v)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                        selectedVibe === v
                          ? "bg-[#0F766E] text-white border-[#0F766E] shadow-lg shadow-[#0F766E]/20"
                          : "bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:border-[#0F766E] hover:text-[#CCFBF1]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* ACTION BUTTON */}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleFindDestinations}
                  className="flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 active:scale-95 px-8 py-3.5 text-sm font-bold text-slate-900 transition shadow-lg shadow-teal-500/20"
                >
                  <Search className="h-4 w-4" />
                  Find Destinations
                </button>
              </div>
            </div>

            {/* SUGGESTED DESTINATIONS GRID */}
            {destinations.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Compass className="h-5 w-5 text-teal-400" />
                  AI Suggested Weekend Getaways from {origin}
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {destinations.map((dest, idx) => (
                    <div
                      key={dest.name + idx}
                      className="group overflow-hidden rounded-2xl border border-[#1E293B] bg-[#1E293B]/40 hover:border-[#0F766E]/50 hover:bg-[#1E293B]/70 transition-all flex flex-col shadow-lg"
                    >
                      <div className="relative h-44 w-full overflow-hidden">
                        <img
                          src={dest.image}
                          alt={dest.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute top-3 right-3 rounded-full bg-slate-900/85 px-3 py-1 text-[10px] font-bold text-emerald-400 border border-[#334155]">
                          🚗 {dest.drive || `${dest.drive_hours} hrs`}
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <h4 className="text-base font-bold text-[#F8FAFC] group-hover:text-teal-400 transition-colors">
                            {dest.name}, {dest.state}
                          </h4>
                          <span className="mt-1 inline-block rounded bg-[#0F766E]/20 px-2 py-0.5 text-[10px] font-semibold text-[#CCFBF1]">
                            {dest.vibe || dest.vibes?.join(", ")}
                          </span>
                          <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
                            {dest.why || "Incredible weekend option with top activities and scenery perfect for group coordination."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDestination(dest)}
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-900 group-hover:bg-[#0f766e] py-3 text-xs font-bold text-white border border-[#334155] transition"
                        >
                          Explore This Destination
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TRIP WORKSPACE */
          <div className="mt-8 space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/70 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedDestination(null)}
                  className="mt-1 rounded-lg border border-[#334155] bg-[#0F172A] p-2 hover:border-[#0F766E] text-[#94A3B8] hover:text-[#CCFBF1] transition-colors"
                  title="Go Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white md:text-2xl">{selectedDestination.name}</h2>
                    <span className="rounded-full bg-[#0F766E]/20 px-2.5 py-0.5 text-xs font-semibold text-[#CCFBF1]">
                      {selectedDestination.state}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-[#94A3B8] flex flex-wrap gap-x-4 gap-y-1">
                    <span>📅 {formatDateReadable(dateFrom)} - {formatDateReadable(dateTo)}</span>
                    <span>👥 {groupSize} people</span>
                    <span>🚗 {selectedDestination.drive || `${selectedDestination.drive_hours} hrs`} from {origin}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex overflow-x-auto border-b border-[#1E293B] pb-1 gap-2 scrollbar-none">
              {(
                [
                  { id: "overview", label: "Overview", icon: Compass },
                  { id: "stay", label: "Stay", icon: Building },
                  { id: "do", label: "Do", icon: Activity },
                  { id: "eat", label: "Eat", icon: Utensils },
                  { id: "getting_there", label: "Getting There", icon: Car }
                ] as const
              ).map(t => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTab(t.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 rounded-t-lg -mb-[2px] ${
                      selectedTab === t.id
                        ? "border-teal-500 text-teal-400 bg-[#1E293B]/40"
                        : "border-transparent text-[#94A3B8] hover:text-[#CCFBF1] hover:bg-[#1E293B]/20"
                    }`}
                  >
                    <TabIcon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENTS */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/40 p-6 min-h-[300px]">
              
              {/* TAB 1: OVERVIEW */}
              {selectedTab === "overview" && (
                <div className="space-y-6">
                  {/* Weather & Quick Stats */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* AI Weather Widget */}
                    <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2 mb-4">
                        <CloudSun className="h-4 w-4 text-teal-400" />
                        Weekend Forecast · Utica, IL
                      </h4>
                      {weatherLoading ? (
                        <div className="h-20 animate-pulse bg-slate-800 rounded-xl" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-3xl font-extrabold text-white">
                              {weatherData?.temp_c != null ? `${weatherData.temp_c}°C` : "21°C"}
                            </p>
                            <p className="text-xs font-semibold text-[#CCFBF1] capitalize mt-1">
                              {weatherData?.description || "Partly Cloudy"}
                            </p>
                          </div>
                          <div className="text-right text-xs text-[#94A3B8] space-y-1">
                            <p>💧 Humidity: {weatherData?.humidity || 62}%</p>
                            <p>💨 Wind speed: {weatherData?.wind_kph || 14} kph</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Drive stats */}
                    <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5 flex flex-col justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
                        Getaway Snapshot
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 border-r border-[#334155]">
                          <p className="text-lg font-bold text-white">🚗 {selectedDestination.drive || "1.5 hrs"}</p>
                          <p className="text-[10px] text-[#94A3B8] uppercase">Drive</p>
                        </div>
                        <div className="p-2 border-r border-[#334155]">
                          <p className="text-lg font-bold text-emerald-400">💚 100%</p>
                          <p className="text-[10px] text-[#94A3B8] uppercase">Group Match</p>
                        </div>
                        <div className="p-2">
                          <p className="text-lg font-bold text-teal-400">{selectedVibe}</p>
                          <p className="text-[10px] text-[#94A3B8] uppercase">Vibe</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Itinerary Summary */}
                  <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-teal-400 animate-pulse" />
                      AI Suggested Itinerary Preview
                    </h4>
                    {aiSummaryLoading ? (
                      <div className="space-y-2 animate-pulse py-4">
                        <div className="h-4 bg-slate-800 rounded w-full" />
                        <div className="h-4 bg-slate-800 rounded w-5/6" />
                        <div className="h-4 bg-slate-800 rounded w-2/3" />
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                        {aiSummary}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: STAY */}
              {selectedTab === "stay" && (
                <div className="space-y-6">
                  {/* Travelpayouts widget container */}
                  <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-4">
                      Section A — Interactive Stays Map (Travelpayouts)
                    </h4>
                    <div id="tp-widget-container" className="w-full min-h-[300px] bg-slate-900 rounded-lg flex items-center justify-center p-4">
                      <p className="text-xs text-[#94A3B8]">Loading Stays Widget...</p>
                    </div>
                  </div>

                  {/* Direct search buttons */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Airbnb */}
                    <a
                      href={`https://www.airbnb.com/s/${encodeURIComponent(selectedDestination.city_search)}/homes?checkin=${dateFrom}&checkout=${dateTo}&adults=${groupSize}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] p-4 text-left group transition"
                    >
                      <div>
                        <h5 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                          Find Cabins & Houses on Airbnb
                        </h5>
                        <p className="text-[10px] text-[#94A3B8] mt-1">
                          Browse cabins, scenic treehouses & vacation homes
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-[#94A3B8] group-hover:text-[#CCFBF1] transition-colors" />
                    </a>

                    {/* Booking.com */}
                    <a
                      href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(selectedDestination.city_search)}&checkin=${dateFrom}&checkout=${dateTo}&group_adults=${groupSize}&aid=727732`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] p-4 text-left group transition"
                    >
                      <div>
                        <h5 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                          Search Stays on Booking.com
                        </h5>
                        <p className="text-[10px] text-[#94A3B8] mt-1">
                          Compare hotels, resort lodges & holiday rentals
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-[#94A3B8] group-hover:text-[#CCFBF1] transition-colors" />
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 3: DO */}
              {selectedTab === "do" && (
                <div className="space-y-6">
                  {/* Events During Your Trip */}
                  <div className="mb-8">
                    <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <span>🎉</span> Events During Your Trip
                    </h3>
                    
                    {eventsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="bg-[#0F172A] border border-[#334155] rounded-xl h-32 animate-pulse" />
                        ))}
                      </div>
                    ) : tripEvents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tripEvents.slice(0, 6).map((event, i) => (
                          <div key={i} className="bg-[#0F172A] rounded-xl p-4 border border-[#334155] hover:border-teal-500 transition-colors flex flex-col justify-between gap-3 shadow-md">
                            <div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold mb-2 inline-block ${
                                event.category === 'Music' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                event.category === 'Sports' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                event.category === 'Arts' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                                'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              }`}>
                                {event.category}
                              </span>
                              
                              <h4 className="text-white font-bold text-sm mb-1 line-clamp-2">{event.name}</h4>
                              
                              <p className="text-slate-400 text-[11px] mb-1">
                                📅 {event.date} {event.time && `at ${event.time}`}
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                📍 {event.venue}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-[#334155] pt-3 mt-1">
                              <span className="text-teal-400 text-xs font-semibold">
                                {event.price_min ? `From $${event.price_min}` : 'See prices'}
                              </span>
                              {event.ticket_url && (
                                <a 
                                  href={event.ticket_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-teal-600 hover:bg-teal-500 text-white text-[11px] px-3 py-1.5 rounded-lg transition font-bold"
                                >
                                  Get Tickets →
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#0F172A] rounded-xl p-6 text-center border border-[#334155]">
                        <p className="text-slate-400 text-sm">No events found for these dates.</p>
                        <p className="text-slate-500 text-xs mt-1">Try browsing the full Events Directory for more options.</p>
                        <Link href="/explore/events" className="text-teal-400 text-sm mt-3 inline-block hover:underline font-bold">
                          Browse All Events →
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Add to Trip Poll Button */}
                  {tripEvents.length > 0 && (
                    <div className="mb-6 p-4 bg-teal-950/20 border border-[#0F766E]/40 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <p className="text-[#CCFBF1] text-xs font-semibold">
                        🗳️ Want your group to vote on which events to attend?
                      </p>
                      <button 
                        type="button"
                        onClick={createEventPoll}
                        className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-4 py-2.5 rounded-xl transition font-bold"
                      >
                        Create Event Poll for Group →
                      </button>
                    </div>
                  )}

                  {/* GetYourGuide Widget */}
                  <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-4">
                      Premium Activities (GetYourGuide)
                    </h4>
                    <div id="gyg-widget-container" className="w-full min-h-[250px] bg-slate-900 rounded-lg flex items-center justify-center p-4">
                      <p className="text-xs text-[#94A3B8]">Loading Activities Widget...</p>
                    </div>
                  </div>

                  {/* Curated Hardcoded Activity cards */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                      Curated Top Things To Do
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(selectedDestination.activities || [
                        { name: "Local Hike", desc: "Discover historic woods and scenic trails." },
                        { name: "Scenic Overlook", desc: "Enjoy panoramic viewpoints of the landscapes." }
                      ]).map((act: any) => (
                        <div key={act.name} className="flex gap-3 rounded-xl border border-[#334155] bg-[#0F172A] p-4">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F766E]/20 text-[#CCFBF1]" aria-hidden>
                            <Activity className="h-4 w-4" />
                          </span>
                          <div>
                            <h5 className="text-xs font-bold text-white">{act.name}</h5>
                            <p className="text-[10px] text-[#94A3B8] mt-1 leading-relaxed">
                              {act.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EAT */}
              {selectedTab === "eat" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
                    Top Group Dining & Restaurants in {selectedDestination.name}
                  </h4>
                  
                  {placesLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <div key={n} className="h-28 bg-slate-800 rounded-xl" />
                      ))}
                    </div>
                  ) : placesData.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">No restaurants found.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {placesData.map(p => (
                        <div key={p.name} className="rounded-xl border border-[#334155] bg-[#0F172A] p-4 flex flex-col justify-between gap-3 shadow-md">
                          <div>
                            <h5 className="text-xs font-bold text-white">{p.name}</h5>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-amber-400 text-xs">★</span>
                              <span className="text-[10px] font-bold text-white">{p.rating}</span>
                              <span className="text-[10px] text-[#94A3B8] capitalize">
                                · {p.types?.[0]?.replace("_", " ") || "Restaurant"}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#94A3B8] mt-2 truncate">
                              📍 {p.address || "Local Address"}
                            </p>
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " " + selectedDestination.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 w-full rounded-lg bg-slate-900 hover:bg-[#0f766e] py-2 text-[10px] font-bold text-white border border-[#334155] transition"
                          >
                            Get Directions
                            <Navigation className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: GETTING THERE */}
              {selectedTab === "getting_there" && (
                <div className="space-y-6">
                  {/* Route & Fuel info */}
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    {/* Fuel card */}
                    <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2 mb-4">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        Estimated Fuel Cost
                      </h4>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-3xl font-extrabold text-emerald-400">
                            ${estimatedFuelCost}
                          </p>
                          <p className="text-[10px] text-[#94A3B8] mt-1 font-semibold leading-relaxed">
                            Based on {miles} miles drive at 25 MPG and gas priced at $3.50/gal.
                          </p>
                        </div>
                        <div className="bg-[#0F766E]/20 border border-[#0F766E]/30 rounded-xl p-3 text-center">
                          <p className="text-xs font-extrabold text-[#CCFBF1]">${costPerPerson}</p>
                          <p className="text-[8px] text-[#94A3B8] uppercase mt-0.5">Per Person</p>
                        </div>
                      </div>
                    </div>

                    {/* Driving details */}
                    <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                        Parking Tip
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-300">
                        {selectedDestination.parking || "Parking is readily available in local public parking spaces and municipal lots."}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#0F766E]">
                        <Info className="h-3.5 w-3.5" />
                        <span className="font-semibold text-[#CCFBF1]">Static Tip: Keep gas tanks filled before mountain tracks.</span>
                      </div>
                    </div>
                  </div>

                  {/* Route overview */}
                  <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2 mb-3">
                      <Navigation className="h-4 w-4 text-teal-400" />
                      Drive Route Summary
                    </h4>
                    {routeLoading ? (
                      <div className="h-10 animate-pulse bg-slate-800 rounded-xl" />
                    ) : (
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-white">Origin: {origin}</p>
                          <p className="font-bold text-teal-400">Destination: {selectedDestination.name}</p>
                        </div>
                        <div className="text-right text-[#94A3B8]">
                          <p className="font-bold text-white">🚗 Total Miles: {miles} mi</p>
                          <p className="mt-0.5">Approx Drive: {selectedDestination.drive || "1.5 hrs"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* GROUP COORDINATION TOOLS PANEL */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/70 p-6 shadow-xl">
              <h3 className="text-base font-bold text-[#CCFBF1] flex items-center gap-2 mb-6">
                <Users className="h-5 w-5 text-teal-400" />
                Group Coordination Panel
              </h3>
              
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {/* Polls */}
                <Link
                  href="/trips/new?tab=polls"
                  className="flex flex-col items-center justify-center text-center rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] hover:bg-[#0F766E]/10 p-5 group transition"
                >
                  <Vote className="h-6 w-6 text-teal-400 group-hover:scale-110 transition-transform mb-3" />
                  <span className="text-xs font-bold text-white">Create Poll</span>
                  <span className="text-[9px] text-[#94A3B8] mt-1">Vote on details</span>
                </Link>

                {/* Split Costs */}
                <Link
                  href="/split-activities"
                  className="flex flex-col items-center justify-center text-center rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] hover:bg-[#0F766E]/10 p-5 group transition"
                >
                  <DollarSign className="h-6 w-6 text-emerald-400 group-hover:scale-110 transition-transform mb-3" />
                  <span className="text-xs font-bold text-white">Split Costs</span>
                  <span className="text-[9px] text-[#94A3B8] mt-1">Track shared costs</span>
                </Link>

                {/* Share Trip */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Trip workspace invite link copied to clipboard!");
                  }}
                  className="flex flex-col items-center justify-center text-center rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] hover:bg-[#0F766E]/10 p-5 group transition w-full"
                >
                  <Share2 className="h-6 w-6 text-sky-400 group-hover:scale-110 transition-transform mb-3" />
                  <span className="text-xs font-bold text-white">Invite Friends</span>
                  <span className="text-[9px] text-[#94A3B8] mt-1">Copy invite link</span>
                </button>

                {/* LIVE Mode */}
                <Link
                  href="/live"
                  className="flex flex-col items-center justify-center text-center rounded-xl border border-[#334155] bg-[#0F172A] hover:border-[#0F766E] hover:bg-[#0F766E]/10 p-5 group transition"
                >
                  <MapPin className="h-6 w-6 text-pink-400 group-hover:scale-110 transition-transform mb-3" />
                  <span className="text-xs font-bold text-white">LIVE Mode</span>
                  <span className="text-[9px] text-[#94A3B8] mt-1">Live trip tracking</span>
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
