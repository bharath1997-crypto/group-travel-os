"use client";

/*
  Required env variables in
  .env.local file:

  NEXT_PUBLIC_TICKETMASTER_KEY=your_key
  NEXT_PUBLIC_EVENTBRITE_TOKEN=your_token

  Get Ticketmaster key:
  developer.ticketmaster.com
  → My Apps → your app → Consumer Key

  Get Eventbrite token:
  eventbrite.com/platform/api-keys
  → Your private token
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { apiFetch } from "@/lib/api";

const TM_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_KEY || "";
const EB_TOKEN = process.env.NEXT_PUBLIC_EVENTBRITE_TOKEN || "";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BG = "#F8F9FA";

type FeedEvent = {
  id: string;
  source: string;
  name: string;
  date?: string;
  time?: string;
  venue?: string;
  city?: string;
  lat: number;
  lon: number;
  category?: string;
  price?: string;
  isFree?: boolean;
  image?: string;
  url?: string;
  emoji?: string;
};

type TrendingDestination = {
  id: string;
  name: string;
  country: string;
  category: string;
  trending_score: number;
  emoji?: string;
};

type TrendingResponse = {
  items: TrendingDestination[];
};

const PLACEHOLDER_EVENTS: FeedEvent[] = [
  {
    id: "p1",
    source: "Sample",
    name: "Local Food Festival",
    date: new Date().toISOString().split("T")[0],
    time: "12:00",
    venue: "City Park",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Food",
    price: "Free",
    isFree: true,
    emoji: "🍽️",
  },
  {
    id: "p2",
    source: "Sample",
    name: "Live Music Night",
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    venue: "Local Venue",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Music",
    price: "$15",
    isFree: false,
    emoji: "🎵",
  },
  {
    id: "p3",
    source: "Sample",
    name: "Art Exhibition Opening",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    venue: "Art Gallery",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Art",
    price: "Free",
    isFree: true,
    emoji: "🎨",
  },
  {
    id: "p4",
    source: "Sample",
    name: "Community Sports Day",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    venue: "Sports Complex",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Sports",
    price: "Free",
    isFree: true,
    emoji: "⚽",
  },
];

const PLACEHOLDER_DESTINATIONS: TrendingDestination[] = [
  {
    id: "1",
    name: "Chicago",
    country: "US",
    category: "City",
    trending_score: 95,
    emoji: "🏙️",
  },
  {
    id: "2",
    name: "New York",
    country: "US",
    category: "City",
    trending_score: 89,
    emoji: "🗽",
  },
  {
    id: "3",
    name: "Miami",
    country: "US",
    category: "Beach",
    trending_score: 82,
    emoji: "🏖️",
  },
  {
    id: "4",
    name: "Denver",
    country: "US",
    category: "Adventure",
    trending_score: 76,
    emoji: "🏔️",
  },
];

const CATEGORY_PILLS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "music", label: "🎵 Music" },
  { key: "food", label: "🍽️ Food" },
  { key: "art", label: "🎨 Art" },
  { key: "sports", label: "⚽ Sports" },
  { key: "culture", label: "🎭 Culture" },
  { key: "nature", label: "🌿 Nature" },
  { key: "festival", label: "🎪 Festival" },
  { key: "business", label: "💼 Business" },
  { key: "travel", label: "✈️ Travel" },
];

const TIME_PILLS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "pick", label: "📅 Pick Date" },
];

function getCategoryEmoji(cat?: string): string {
  if (!cat) return "🎪";
  const c = cat.toLowerCase();
  if (c.includes("music")) return "🎵";
  if (c.includes("sport")) return "⚽";
  if (c.includes("art") || c.includes("theatre")) return "🎨";
  if (c.includes("food") || c.includes("drink")) return "🍽️";
  if (c.includes("festival")) return "🎪";
  if (c.includes("culture") || c.includes("community")) return "🎭";
  if (c.includes("nature") || c.includes("outdoor")) return "🌿";
  if (c.includes("business") || c.includes("conference")) return "💼";
  if (c.includes("travel")) return "✈️";
  return "🎪";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Date TBD";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m ?? "00"} ${ampm}`;
}

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.asin(Math.sqrt(a));
  return d < 1 ? `${(d * 5280).toFixed(0)} ft` : `${d.toFixed(1)} mi`;
}

function cardGradient(category?: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("music"))
    return "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)";
  if (c.includes("sport"))
    return "linear-gradient(135deg, #059669 0%, #34d399 100%)";
  if (c.includes("art") || c.includes("culture"))
    return "linear-gradient(135deg, #db2777 0%, #f472b6 100%)";
  if (c.includes("food"))
    return "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)";
  return `linear-gradient(135deg, ${NAVY} 0%, #1e5a8a 100%)`;
}

export default function FeedPage() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [userCity, setUserCity] = useState("your location");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [apiSearchQuery, setApiSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTime, setActiveTime] = useState("today");
  const [pickedDate, setPickedDate] = useState("");
  const [activeScope, setActiveScope] = useState("50mi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);
  const [apiStatus, setApiStatus] = useState({
    ticketmaster: false,
    eventbrite: false,
  });
  const [trendingDestinations, setTrendingDestinations] = useState<
    TrendingDestination[]
  >([]);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [holidays, setHolidays] = useState<{ name: string; date: string }[]>(
    [],
  );
  const [countryCode, setCountryCode] = useState("US");

  const isDev = process.env.NODE_ENV === "development";

  const checkApiKeys = useCallback(async () => {
    const results = {
      ticketmaster: false,
      eventbrite: false,
    };

    if (TM_KEY) {
      try {
        const res = await fetch(
          `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(TM_KEY)}&size=1`,
        );
        results.ticketmaster = res.status === 200;
      } catch {
        results.ticketmaster = false;
      }
    }

    if (EB_TOKEN) {
      try {
        const res = await fetch(
          "https://www.eventbriteapi.com/v3/users/me/",
          {
            headers: { Authorization: `Bearer ${EB_TOKEN}` },
          },
        );
        results.eventbrite = res.status === 200;
      } catch {
        results.eventbrite = false;
      }
    }

    setApiStatus(results);
    return results;
  }, []);

  const fetchHolidaysForCountry = useCallback(async (cc: string) => {
    const y = new Date().getFullYear();
    try {
      const res = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { name: string; date: string }[];
      setHolidays(Array.isArray(data) ? data.slice(0, 12) : []);
    } catch {
      setHolidays([]);
    }
  }, []);

  const fetchTicketmasterEvents = useCallback(
    async (lat: number, lon: number): Promise<FeedEvent[]> => {
      if (!TM_KEY) {
        console.warn(
          "Ticketmaster key missing. Add NEXT_PUBLIC_TICKETMASTER_KEY to .env.local",
        );
        return [];
      }

      const radiusMap: Record<string, number> = {
        "10mi": 10,
        "25mi": 25,
        "50mi": 50,
        "100mi": 100,
        "500mi": 500,
        city: 25,
        district: 50,
        state: 200,
        country: 500,
        world: 1000,
      };
      const radius = radiusMap[activeScope] ?? 50;

      const now = new Date();
      let startDate = now.toISOString().replace(".000Z", "Z");
      let endDate = "";

      if (activeTime === "today") {
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        endDate = end.toISOString().replace(".000Z", "Z");
      } else if (activeTime === "tomorrow") {
        const start = new Date(now);
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        startDate = start.toISOString().replace(".000Z", "Z");
        endDate = end.toISOString().replace(".000Z", "Z");
      } else if (activeTime === "weekend") {
        const day = now.getDay();
        const daysToSat = (6 - day + 7) % 7;
        const sat = new Date(now);
        sat.setDate(now.getDate() + daysToSat);
        sat.setHours(0, 0, 0, 0);
        const sun = new Date(sat);
        sun.setDate(sat.getDate() + 1);
        sun.setHours(23, 59, 59, 999);
        startDate = sat.toISOString().replace(".000Z", "Z");
        endDate = sun.toISOString().replace(".000Z", "Z");
      } else if (activeTime === "week") {
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        endDate = end.toISOString().replace(".000Z", "Z");
      } else if (activeTime === "month") {
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        endDate = end.toISOString().replace(".000Z", "Z");
      } else if (activeTime === "pick" && pickedDate) {
        const start = new Date(pickedDate + "T00:00:00");
        const end = new Date(pickedDate + "T23:59:59");
        startDate = start.toISOString().replace(".000Z", "Z");
        endDate = end.toISOString().replace(".000Z", "Z");
      }

      const categoryMap: Record<string, string> = {
        music: "KZFzniwnSyZfZ7v7nJ",
        sports: "KZFzniwnSyZfZ7v7nE",
        art: "KZFzniwnSyZfZ7v7na",
        culture: "KZFzniwnSyZfZ7v7na",
        food: "",
        festival: "KZFzniwnSyZfZ7v7n1",
        business: "KZFzniwnSyZfZ7v7n1",
        nature: "",
        travel: "",
      };

      const segmentId =
        activeCategory !== "all"
          ? categoryMap[activeCategory] || ""
          : "";

      let url =
        `https://app.ticketmaster.com/discovery/v2/events.json` +
        `?apikey=${encodeURIComponent(TM_KEY)}` +
        `&latlong=${lat},${lon}` +
        `&radius=${radius}` +
        `&unit=miles` +
        `&size=20` +
        `&sort=date,asc` +
        `&startDateTime=${encodeURIComponent(startDate)}`;

      if (endDate) url += `&endDateTime=${encodeURIComponent(endDate)}`;
      if (segmentId) url += `&segmentId=${segmentId}`;
      if (apiSearchQuery.trim())
        url += `&keyword=${encodeURIComponent(apiSearchQuery.trim())}`;

      try {
        const res = await fetch(url);

        if (res.status === 401) {
          console.error(
            "Ticketmaster: Invalid API key. Check NEXT_PUBLIC_TICKETMASTER_KEY",
          );
          setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
          return [];
        }

        if (res.status === 429) {
          console.warn(
            "Ticketmaster: Rate limit hit. 5000 calls/day max.",
          );
          return [];
        }

        if (!res.ok) {
          setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
          return [];
        }

        const data = (await res.json()) as {
          _embedded?: { events?: Record<string, unknown>[] };
        };
        const tmEvents = data._embedded?.events || [];

        const mapped: FeedEvent[] = tmEvents.map((e: Record<string, unknown>) => {
          const ev = e as {
            id: string;
            name: string;
            dates?: {
              start?: { localDate?: string; localTime?: string };
            };
            _embedded?: {
              venues?: {
                name?: string;
                city?: { name?: string };
                location?: { latitude?: string; longitude?: string };
              }[];
            };
            classifications?: {
              segment?: { name?: string };
            }[];
            priceRanges?: { min?: number }[];
            images?: { url?: string }[];
            url?: string;
          };
          const venue = ev._embedded?.venues?.[0];
          return {
            id: `tm_${ev.id}`,
            source: "Ticketmaster",
            name: ev.name,
            date: ev.dates?.start?.localDate,
            time: ev.dates?.start?.localTime,
            venue: venue?.name,
            city: venue?.city?.name,
            lat: parseFloat(venue?.location?.latitude || "0"),
            lon: parseFloat(venue?.location?.longitude || "0"),
            category:
              ev.classifications?.[0]?.segment?.name || "Event",
            price: ev.priceRanges?.[0]
              ? `$${ev.priceRanges[0].min}`
              : "Free",
            isFree: !ev.priceRanges?.length,
            image: ev.images?.[0]?.url,
            url: ev.url,
            emoji: getCategoryEmoji(ev.classifications?.[0]?.segment?.name),
          };
        });

        setApiStatus((prev) => ({ ...prev, ticketmaster: true }));
        return mapped;
      } catch (err) {
        console.error("Ticketmaster fetch error:", err);
        setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
        return [];
      }
    },
    [
      activeScope,
      activeTime,
      activeCategory,
      apiSearchQuery,
      pickedDate,
    ],
  );

  const fetchEventbriteEvents = useCallback(
    async (lat: number, lon: number): Promise<FeedEvent[]> => {
      if (!EB_TOKEN) {
        console.warn(
          "Eventbrite token missing. Add NEXT_PUBLIC_EVENTBRITE_TOKEN to .env.local",
        );
        return [];
      }

      const radiusMap: Record<string, string> = {
        "10mi": "10mi",
        "25mi": "25mi",
        "50mi": "50mi",
        "100mi": "100mi",
        "500mi": "500mi",
        city: "25mi",
        district: "50mi",
        state: "200mi",
        country: "500mi",
        world: "2000mi",
      };
      const radius = radiusMap[activeScope] || "50mi";

      const url =
        `https://www.eventbriteapi.com/v3/events/search/` +
        `?location.latitude=${lat}` +
        `&location.longitude=${lon}` +
        `&location.within=${radius}` +
        `&expand=venue,ticket_classes` +
        `&sort_by=date` +
        `&page_size=20`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${EB_TOKEN}` },
        });

        if (res.status === 401) {
          console.error(
            "Eventbrite: Invalid token. Check NEXT_PUBLIC_EVENTBRITE_TOKEN",
          );
          setApiStatus((prev) => ({ ...prev, eventbrite: false }));
          return [];
        }

        if (!res.ok) {
          setApiStatus((prev) => ({ ...prev, eventbrite: false }));
          return [];
        }

        const data = (await res.json()) as {
          events?: Record<string, unknown>[];
        };
        const ebEvents = data.events || [];

        const mapped: FeedEvent[] = ebEvents.map((raw) => {
          const e = raw as {
            id: string;
            name?: { text?: string };
            start?: { local?: string };
            venue?: {
              name?: string;
              address?: { city?: string };
              latitude?: string;
              longitude?: string;
            };
            category?: { name?: string };
            is_free?: boolean;
            ticket_classes?: { cost?: { display?: string } }[];
            logo?: { url?: string };
            url?: string;
          };
          const local = e.start?.local || "";
          const [dPart, tPart] = local.split("T");
          return {
            id: `eb_${e.id}`,
            source: "Eventbrite",
            name: e.name?.text || "Event",
            date: dPart,
            time: tPart?.slice(0, 5),
            venue: e.venue?.name,
            city: e.venue?.address?.city,
            lat: parseFloat(e.venue?.latitude || "0"),
            lon: parseFloat(e.venue?.longitude || "0"),
            category: e.category?.name || "Community",
            price: e.is_free
              ? "Free"
              : e.ticket_classes?.[0]?.cost?.display || "Paid",
            isFree: e.is_free,
            image: e.logo?.url,
            url: e.url,
            emoji: getCategoryEmoji(e.category?.name),
          };
        });

        setApiStatus((prev) => ({ ...prev, eventbrite: true }));
        return mapped;
      } catch (err) {
        console.error("Eventbrite fetch error:", err);
        setApiStatus((prev) => ({ ...prev, eventbrite: false }));
        return [];
      }
    },
    [activeScope],
  );

  function loadPlaceholderEvents() {
    setEvents(PLACEHOLDER_EVENTS);
    setLoading(false);
  }

  const loadTrending = useCallback(() => {
    apiFetch<TrendingResponse>("/feed/trending?page_size=6")
      .then((data) => {
        const items = data?.items ?? [];
        setTrendingDestinations(
          items.map((d) => ({
            id: String(d.id),
            name: d.name,
            country: d.country,
            category: d.category,
            trending_score: d.trending_score,
            emoji:
              d.category?.toLowerCase().includes("beach")
                ? "🏖️"
                : d.category?.toLowerCase().includes("city")
                  ? "🏙️"
                  : "🌍",
          })),
        );
      })
      .catch(() => {
        setTrendingDestinations(PLACEHOLDER_DESTINATIONS);
      });
  }, []);

  useEffect(() => {
    void checkApiKeys();
  }, [checkApiKeys]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  useEffect(() => {
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (cancelled) return;
        setUserLocation({ lat, lon });

        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "Travello/1.0" } },
          );
          const geo = (await geoRes.json()) as {
            address?: {
              city?: string;
              town?: string;
              suburb?: string;
              country_code?: string;
            };
          };
          const city =
            geo.address?.city ||
            geo.address?.town ||
            geo.address?.suburb ||
            "your area";
          const cc = (geo.address?.country_code || "us").toUpperCase();
          setUserCity(city);
          setCountryCode(cc);
          await fetchHolidaysForCountry(cc);
        } catch {
          setUserCity("your area");
        }
      },
      () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then(async (data: {
            latitude?: number;
            longitude?: number;
            city?: string;
            country_code?: string;
          }) => {
            if (cancelled) return;
            const lat = data.latitude ?? 41.8781;
            const lon = data.longitude ?? -87.6298;
            setUserLocation({ lat, lon });
            setUserCity(data.city || "Chicago");
            const cc = (data.country_code || "US").toUpperCase();
            setCountryCode(cc);
            await fetchHolidaysForCountry(cc);
          })
          .catch(() => {
            if (!cancelled) loadPlaceholderEvents();
          });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );

    return () => {
      cancelled = true;
    };
  }, [fetchHolidaysForCountry]);

  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    setLoading(true);
    setEvents([]);
    (async () => {
      const [tm, eb] = await Promise.all([
        fetchTicketmasterEvents(userLocation.lat, userLocation.lon),
        fetchEventbriteEvents(userLocation.lat, userLocation.lon),
      ]);
      if (!cancelled) {
        setEvents([...tm, ...eb]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    userLocation,
    activeScope,
    activeTime,
    activeCategory,
    apiSearchQuery,
    pickedDate,
    fetchTicketmasterEvents,
    fetchEventbriteEvents,
  ]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (activeCategory !== "all") {
        const cat = (e.category || "").toLowerCase();
        const query = activeCategory.toLowerCase();
        const emojiMatch =
          e.emoji === getCategoryEmoji(activeCategory);
        if (!cat.includes(query) && !emojiMatch) {
          const map: Record<string, string[]> = {
            music: ["music", "concert"],
            food: ["food", "dining"],
            art: ["art", "theatre", "theater"],
            sports: ["sport"],
            culture: ["culture", "community"],
            nature: ["nature", "outdoor"],
            festival: ["festival"],
            business: ["business", "conference"],
            travel: ["travel"],
          };
          const keys = map[activeCategory] || [];
          if (!keys.some((k) => cat.includes(k))) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !e.name?.toLowerCase().includes(q) &&
          !e.venue?.toLowerCase().includes(q) &&
          !e.city?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [events, activeCategory, searchQuery]);

  const statsCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    const totalToday = filteredEvents.filter(
      (e) => e.date && new Date(e.date).toDateString() === todayStr,
    ).length;
    const free = filteredEvents.filter((e) => e.isFree).length;
    const weekend = filteredEvents.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      const day = d.getDay();
      return day === 0 || day === 6;
    }).length;
    const sources = new Set(filteredEvents.map((e) => e.source)).size;
    return {
      total: totalToday,
      free,
      weekend,
      trending: sources,
    };
  }, [filteredEvents]);

  function refetchExternal() {
    if (!userLocation) return;
    setLoading(true);
    setEvents([]);
    Promise.all([
      fetchTicketmasterEvents(userLocation.lat, userLocation.lon),
      fetchEventbriteEvents(userLocation.lat, userLocation.lon),
    ]).then(([tm, eb]) => {
      setEvents([...tm, ...eb]);
      setLoading(false);
    });
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      setApiSearchQuery(searchQuery);
      refetchExternal();
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setApiSearchQuery("");
    refetchExternal();
  }

  function setCategoryAndRefetch(key: string) {
    setActiveCategory(key);
  }

  function setTimeAndRefetch(key: string) {
    setActiveTime(key);
  }

  function setScopeAndRefetch(scope: string) {
    setActiveScope(scope);
    setScopeMenuOpen(false);
  }

  const distanceScopes = ["10mi", "25mi", "50mi", "100mi", "500mi"] as const;
  const regionScopes = [
    { key: "city", label: "My City" },
    { key: "district", label: "District" },
    { key: "state", label: "State" },
    { key: "country", label: "Country" },
    { key: "world", label: "🌍 Worldwide" },
  ];

  return (
    <div
      className="relative mx-auto max-w-[1200px] px-4 py-4 md:px-5"
      style={{ background: BG }}
    >
      {isDev ? (
        <div className="pointer-events-none absolute right-3 top-3 z-40 flex gap-2 text-[10px] font-semibold text-[#6C757D]">
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow">
            TM
            <span
              className={`ml-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                apiStatus.ticketmaster ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow">
            EB
            <span
              className={`ml-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                apiStatus.eventbrite ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
        </div>
      ) : null}

      {/* Top row: search + scope */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-[#E9ECEF] bg-white px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <span className="shrink-0 text-lg" style={{ color: CORAL }}>
            🔍
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search events, places, festivals..."
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#2C3E50] outline-none placeholder:text-[#ADB5BD]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={clearSearch}
              className="shrink-0 text-[#6C757D] hover:text-[#0F3460]"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setScopeMenuOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-1.5 rounded-[14px] border border-[#E9ECEF] bg-white px-3.5 py-2.5 text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            style={{ color: NAVY }}
          >
            📍 {activeScope}
          </button>
          {scopeMenuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                onClick={() => setScopeMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-[#E9ECEF] bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                  Distance
                </p>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {distanceScopes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScopeAndRefetch(s)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        activeScope === s
                          ? "bg-[#E94560] text-white"
                          : "bg-[#F8F9FA] text-[#6C757D]"
                      }`}
                    >
                      {s.replace("mi", " mi")}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                  Region
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {regionScopes.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setScopeAndRefetch(key)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        activeScope === key
                          ? "text-white"
                          : "bg-[#F8F9FA] text-[#6C757D]"
                      }`}
                      style={
                        activeScope === key
                          ? { background: NAVY }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {activeTime === "pick" ? (
        <div className="mb-3">
          <label className="text-xs font-semibold text-[#6C757D]">
            Pick a date
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="ml-2 rounded-lg border border-[#E9ECEF] px-2 py-1 text-sm"
            />
          </label>
        </div>
      ) : null}

      {/* Categories */}
      <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryAndRefetch(key)}
            className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-[11px] font-bold ${
              activeCategory === key
                ? "border-[#E94560] bg-[#E94560] text-white"
                : "border-[#E9ECEF] bg-white text-[#6C757D]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Time */}
      <div className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TIME_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTimeAndRefetch(key)}
            className={`shrink-0 rounded-full border border-[#E9ECEF] px-3 py-1.5 text-[11px] font-semibold ${
              activeTime === key
                ? "text-white"
                : "bg-white text-[#6C757D]"
            }`}
            style={activeTime === key ? { background: NAVY } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Events today", statsCount.total],
            ["Free events", statsCount.free],
            ["This weekend", statsCount.weekend],
            ["Sources", statsCount.trending],
          ] as const
        ).map(([label, val]) => (
          <div
            key={label}
            className="rounded-xl border border-[#E9ECEF] bg-white px-3 py-2.5 text-center"
          >
            <p className="text-lg font-bold text-[#0F3460]">{val}</p>
            <p className="text-[10px] font-semibold text-[#6C757D]">{label}</p>
          </div>
        ))}
      </div>

      {/* Happening now */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#0F3460]">
          🔥 Happening in {userCity}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E9ECEF] bg-white p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              className={`rounded-md px-2 py-1 text-xs ${
                viewMode === "grid"
                  ? "bg-[#E94560] text-white"
                  : "text-[#6C757D]"
              }`}
            >
              ⊞
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setViewMode("list")}
              className={`rounded-md px-2 py-1 text-xs ${
                viewMode === "list"
                  ? "bg-[#E94560] text-white"
                  : "text-[#6C757D]"
              }`}
            >
              ☰
            </button>
          </div>
          <span className="hidden text-xs font-semibold text-[#E94560] sm:inline">
            See all →
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl bg-gray-200"
            />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[#E9ECEF] bg-white py-12 text-center">
          <p className="text-4xl">🎪</p>
          <p className="mt-3 text-lg font-bold text-[#0F3460]">
            No events found near you
          </p>
          <p className="mt-1 max-w-sm text-sm text-[#6C757D]">
            Try expanding your search radius or changing the time filter
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveScope("100mi");
            }}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: CORAL }}
          >
            Expand to 100 miles
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEvent(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setSelectedEvent(e);
                }
              }}
              className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
            >
              <div
                className="relative h-[90px] w-full overflow-hidden"
                style={{ background: cardGradient(e.category) }}
              >
                {e.image ? (
                  <Image
                    src={e.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">
                    {e.emoji || "🎪"}
                  </div>
                )}
                <span
                  className={`absolute left-2 top-2 rounded-[10px] px-2 py-0.5 text-[9px] font-bold text-white ${
                    e.isFree ? "bg-green-600" : ""
                  }`}
                  style={!e.isFree ? { background: CORAL } : undefined}
                >
                  {e.isFree ? "FREE" : e.price || "—"}
                </span>
                <span className="absolute right-2 top-2 rounded-lg bg-white/95 px-1.5 py-0.5 text-[8px] font-semibold text-[#6C757D]">
                  {e.source}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-2.5">
                <p className="line-clamp-1 text-xs font-bold" style={{ color: NAVY }}>
                  {e.name}
                </p>
                <p className="mt-0.5 text-[10px] text-[#6C757D]">
                  {formatDate(e.date)} {formatTime(e.time || "")}
                </p>
                <p className="line-clamp-1 text-[10px] text-[#6C757D]">
                  {e.venue}
                  {e.city ? ` · ${e.city}` : ""}
                </p>
                <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                  <span style={{ color: CORAL }}>{e.price}</span>
                  {userLocation &&
                  e.lat &&
                  e.lon &&
                  (e.lat !== 0 || e.lon !== 0) ? (
                    <span className="text-[#6C757D]">
                      {getDistance(
                        userLocation.lat,
                        userLocation.lon,
                        e.lat,
                        e.lon,
                      )}
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEvent(e);
                    }}
                    className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: CORAL }}
                  >
                    Interested
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredEvents.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEvent(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setSelectedEvent(e);
                }
              }}
              className="flex w-full cursor-pointer gap-3 rounded-[14px] border border-[#E9ECEF] bg-white p-3 text-left shadow-sm"
            >
              <div
                className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ background: `${CORAL}22` }}
              >
                {e.emoji || "🎪"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold text-[#0F3460]">
                  {e.name}
                </p>
                <p className="text-[10px] text-[#6C757D]">
                  {formatDate(e.date)} · {e.venue}
                </p>
                <span className="mt-1 inline-block rounded-md bg-[#F8F9FA] px-1.5 py-0.5 text-[9px] text-[#6C757D]">
                  {e.source}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-center gap-1">
                <span className="text-xs font-bold" style={{ color: CORAL }}>
                  {e.price}
                </span>
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelectedEvent(e);
                  }}
                  className="cursor-pointer rounded-full px-2 py-1 text-[10px] font-bold text-white"
                  style={{ background: CORAL }}
                >
                  Interested
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trending near you */}
      <h3 className="mb-2 mt-8 text-sm font-bold text-[#0F3460]">
        Trending near you
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trendingDestinations.map((d) => (
          <div
            key={d.id}
            className="w-[140px] shrink-0 rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm"
          >
            <p className="text-xl">{d.emoji || "🌍"}</p>
            <p className="mt-1 line-clamp-1 text-xs font-bold text-[#0F3460]">
              {d.name}
            </p>
            <p className="text-[10px] text-[#6C757D]">{d.country}</p>
            <p className="mt-1 text-[10px] font-semibold text-[#E94560]">
              {d.trending_score.toFixed(0)} pts
            </p>
          </div>
        ))}
      </div>

      {holidays.length > 0 ? (
        <p className="mt-4 text-[10px] text-[#6C757D]">
          Upcoming public holidays ({countryCode}):{" "}
          {holidays
            .slice(0, 3)
            .map((h) => h.name)
            .join(" · ")}
        </p>
      ) : null}

      {/* Event detail overlay */}
      {selectedEvent ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setSelectedEvent(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[#E9ECEF] bg-white p-5 shadow-2xl sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2">
            <button
              type="button"
              className="absolute right-4 top-4 text-[#6C757D]"
              onClick={() => setSelectedEvent(null)}
            >
              ✕
            </button>
            {selectedEvent.image ? (
              <div className="relative -mx-5 -mt-5 mb-3 h-40 w-[calc(100%+2.5rem)]">
                <Image
                  src={selectedEvent.image}
                  alt=""
                  fill
                  className="rounded-t-3xl object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="mb-3 flex h-24 items-center justify-center text-5xl">
                {selectedEvent.emoji}
              </div>
            )}
            <p className="pr-8 text-lg font-bold text-[#0F3460]">
              {selectedEvent.name}
            </p>
            <p className="mt-1 text-sm text-[#6C757D]">
              {formatDate(selectedEvent.date)} ·{" "}
              {formatTime(selectedEvent.time || "")}
            </p>
            <p className="text-sm text-[#6C757D]">
              {selectedEvent.venue}
              {selectedEvent.city ? ` · ${selectedEvent.city}` : ""}
            </p>
            <span className="mt-2 inline-block rounded-lg bg-[#F8F9FA] px-2 py-1 text-[10px] font-semibold text-[#6C757D]">
              {selectedEvent.source}
            </span>
            <p className="mt-3 text-sm font-semibold" style={{ color: CORAL }}>
              {selectedEvent.price}
            </p>
            {selectedEvent.url ? (
              <a
                href={selectedEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold text-white"
                style={{ background: CORAL }}
              >
                View tickets / details
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
