/** FORCE_REFRESH_ID: 998877665544332211 **/
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, MapPin, Play, ChevronRight, ChevronUp, ChevronDown, Newspaper, Compass } from "lucide-react";

import { EventCard } from "@/components/explorer/EventCard";
import { DateFilterBar } from "@/components/explorer/DateFilterBar";
import {
  ExplorerItemDetailDrawer,
  type ExplorerDrawerItem,
} from "@/components/explorer/ExplorerItemDetailDrawer";
import { apiFetch } from "@/lib/api";

type TmEventRow = {
  id?: string;
  title?: string;
  imageUrl?: string;
  url?: string;
  start_date?: string;
  venue?: string;
};

type TicketmasterResponse = { city?: string; events?: TmEventRow[] };

type TrendItem = {
  id: string;
  title: string;
  description: string;
  venue: string;
  meta: string;
  sourceType: string;
  sourceLabel: string;
  priceLabel: string;
  emoji: string;
  imageUrl?: string | null;
  url?: string;
};

function tmRowToTrend(t: TmEventRow, city: string, index: number): TrendItem {
  const id = String(t.id || `tm-${index}`);
  const title = String(t.title || "Event");
  const venue = String(t.venue || city);
  const start = String(t.start_date || "Date TBA");
  return {
    id,
    title,
    description: "",
    venue,
    meta: `${start} · ${venue}`,
    sourceType: "ticketmaster",
    sourceLabel: "TM",
    priceLabel: "See tickets",
    emoji: "🎟️",
    imageUrl: t.imageUrl || null,
    url: t.url || "",
  };
}

function trendToEventCardItem(t: TrendItem, city: string) {
  return {
    id: t.id,
    title: t.title,
    source: t.sourceType,
    sourceShort: t.sourceLabel,
    sourceType: t.sourceType,
    venue: t.venue,
    city,
    dateLabel: t.meta,
    distanceLabel: "Near you",
    priceLabel: t.priceLabel,
    isFree: false,
    emoji: t.emoji,
    imageUrl: t.imageUrl,
  };
}

function trendToDrawerItem(t: TrendItem, city: string): ExplorerDrawerItem {
  return {
    id: t.id,
    title: t.title,
    source: t.sourceLabel,
    venue: t.venue,
    city,
    dateLabel: t.meta,
    priceLabel: t.priceLabel,
    description: t.description,
    emoji: t.emoji,
    imageUrl: t.imageUrl,
    sourceUrl: t.url || null,
  };
}

type GoogleEventApiRow = {
  id?: string;
  title?: string;
  venue?: string;
  city?: string;
  date_str?: string;
  image_url?: string | null;
  source_url?: string;
};

type GoogleEventsApiResponse = { events?: GoogleEventApiRow[] };

type EventbriteApiRow = {
  id?: string;
  title?: string;
  venue?: string;
  date_str?: string;
  imageUrl?: string | null;
  url?: string;
};

type EventbriteApiResponse = { events?: EventbriteApiRow[] };

type SeasonalAiEventRow = {
  id?: string;
  title?: string;
  location?: string;
  time?: string;
  emoji?: string;
  image_url?: string | null;
  url?: string | null;
};

type SeasonalAiResponse = { events?: SeasonalAiEventRow[] };

function googleRowToTrend(ge: GoogleEventApiRow, city: string, index: number): TrendItem {
  return {
    id: String(ge.id ?? `g-${index}`),
    title: String(ge.title ?? "Event"),
    description: "",
    venue: String(ge.venue ?? city),
    meta: String(ge.date_str ?? "See dates"),
    sourceType: "google",
    sourceLabel: "G",
    priceLabel: "Details",
    emoji: "⭐",
    imageUrl: ge.image_url ?? null,
    url: ge.source_url ?? "",
  };
}

function eventbriteRowToTrend(ee: EventbriteApiRow, city: string, index: number): TrendItem {
  return {
    id: String(ee.id ?? `eb-${index}`),
    title: String(ee.title ?? "Event"),
    description: "",
    venue: String(ee.venue ?? city),
    meta: String(ee.date_str ?? "See dates"),
    sourceType: "eventbrite",
    sourceLabel: "EB",
    priceLabel: "Tickets",
    emoji: "🎫",
    imageUrl: ee.imageUrl ?? null,
    url: ee.url ?? "",
  };
}

function seasonalAiRowToTrend(ae: SeasonalAiEventRow, city: string, index: number): TrendItem {
  return {
    id: String(ae.id ?? `ai-${index}`),
    title: String(ae.title ?? "Suggestion"),
    description: "",
    venue: String(ae.location ?? city),
    meta: String(ae.time ?? "Seasonal"),
    sourceType: "ai",
    sourceLabel: "AI",
    priceLabel: "Learn More",
    emoji: String(ae.emoji ?? "✨"),
    imageUrl: ae.image_url ?? null,
    url: ae.url ?? "",
  };
}

function deduplicateEvents(list: TrendItem[]): TrendItem[] {
  const seen = new Set<string>();
  const uniqueList: TrendItem[] = [];

  for (const item of list) {
    if (!item.title) continue;
    const cleanTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!seen.has(cleanTitle)) {
      seen.add(cleanTitle);
      uniqueList.push(item);
    }
  }
  return uniqueList;
}

function formatCityTitleParam(cityParam: string): string {
  const raw = decodeURIComponent(cityParam).replace(/\+/g, " ").trim();
  if (!raw) return "City";
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function CityEventsPage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.city;
  const citySlug = Array.isArray(raw) ? raw[0] : raw;
  const apiCity = citySlug
    ? decodeURIComponent(String(citySlug)).replace(/\+/g, " ").trim()
    : "";
  const displayCity = citySlug ? formatCityTitleParam(String(citySlug)) : "";

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TrendItem[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [drawerItem, setDrawerItem] = useState<ExplorerDrawerItem | null>(null);

  const cityEncoded = encodeURIComponent(apiCity);

  useEffect(() => {
    if (!apiCity) {
      router.replace("/explorer");
      return;
    }
    document.title = `${displayCity} Events`;
  }, [apiCity, displayCity, router]);

  useEffect(() => {
    if (!apiCity) return;
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const [tmRes, gRes, ebRes] = await Promise.all([
          apiFetch<TicketmasterResponse>(
            `/explore/ticketmaster?city=${encodeURIComponent(apiCity)}&start_date=${startDate}&end_date=${endDate}`,
            { signal: ac.signal },
          ),
          apiFetch<GoogleEventsApiResponse>(
            `/explore/google-events?city=${encodeURIComponent(apiCity)}&start_date=${startDate}&end_date=${endDate}`,
            { signal: ac.signal },
          ),
          apiFetch<EventbriteApiResponse>(
            `/explore/eventbrite?city=${encodeURIComponent(apiCity)}`,
            { signal: ac.signal },
          ),
        ]);

        const list = Array.isArray(tmRes.events) ? tmRes.events : [];
        if (!ac.signal.aborted) {
          const tmList = list.map((row, i) => tmRowToTrend(row, apiCity, i));
          const googleList = (Array.isArray(gRes.events) ? gRes.events : []).map((ge, i) =>
            googleRowToTrend(ge, apiCity, i),
          );
          const ebList = (Array.isArray(ebRes.events) ? ebRes.events : []).map((ee, i) =>
            eventbriteRowToTrend(ee, apiCity, i),
          );

          let combined = deduplicateEvents([...tmList, ...googleList, ...ebList]);

          // AI Fallback: If we have very few events, fetch seasonal suggestions
          if (combined.length < 10 && !ac.signal.aborted) {
            try {
              const aiRes = await apiFetch<SeasonalAiResponse>(
                `/explore/seasonal-events-ai?city=${encodeURIComponent(apiCity)}`,
              );
              if (aiRes && Array.isArray(aiRes.events)) {
                const aiList = aiRes.events.map((ae, i) => seasonalAiRowToTrend(ae, apiCity, i));
                combined = deduplicateEvents([...combined, ...aiList]);
              }
            } catch (err) {
              console.warn("AI Fallback failed", err);
            }
          }

          setEvents(combined);
        }
      } catch {
        if (!ac.signal.aborted) {
          setEvents([]);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [apiCity, startDate, endDate]);

  const openDrawer = useCallback(
    (t: TrendItem) => setDrawerItem(trendToDrawerItem(t, apiCity)),
    [apiCity],
  );

  if (!apiCity) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#0B192E] text-gray-300">
        <p className="text-sm">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0B192E] py-8 text-gray-300">
      <style jsx global>{`
        /* Custom Themed Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0B192E;
        }
        ::-webkit-scrollbar-thumb {
          background: #2a4d7d;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #E94560;
        }
        
        /* Edge-to-Edge Smoothness */
        * {
          scrollbar-width: thin;
          scrollbar-color: #2a4d7d #0B192E;
        }
      `}</style>
      <div className="mx-0 max-w-none px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/explore/${cityEncoded}`}
              className="text-sm font-medium text-[#E94560] hover:text-white"
            >
              ← {displayCity} Travel Guide
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Events in {displayCity}
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              Powered by Ticketmaster, Google & Eventbrite Discovery
            </p>
          </div>
        </div>

        <DateFilterBar 
          startDate={startDate} 
          endDate={endDate} 
          onDatesChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }} 
        />

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl border border-[#1e4976] bg-[#162d4a]"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#1e4976] bg-[#162d4a] px-4 py-12 text-center text-sm">
            No events found for the selected dates.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {events.map((t) => (
              <EventCard
                key={`${t.title?.toLowerCase().replace(/[^a-z0-9]/g, "")}-${t.id}`}
                event={trendToEventCardItem(t, apiCity)}
                view="grid"
                onOpen={() => {
                  if (t.sourceType === "google") {
                    window.open(t.url || "#", "_blank");
                  } else {
                    openDrawer(t);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ExplorerItemDetailDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
      />
    </div>
  );
}
