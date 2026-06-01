"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Share2,
  Star,
  Ticket,
  Vote,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";
import {
  findCachedExploreEvent,
  EXPLORE_FETCH_TIMEOUT_MS,
  loadExploreHubState,
} from "@/lib/explore-events";

type EventDetail = {
  id: string;
  title: string;
  category: string;
  venue: string;
  city: string;
  state: string;
  start_date: string;
  start_time: string;
  price_min: number | null;
  price_max: number | null;
  image_url: string | null;
  ticket_url: string;
  source: string;
  distance_miles: number;
  rating: number;
};

type TripListItem = {
  id: string;
  group_id: string;
  group_name: string | null;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

function buildShareUrl(eventId: string): string {
  return `https://rovvy.app/explore/event/${encodeURIComponent(eventId)}`;
}

function formatSimilarDate(startDate: string): string {
  if (!startDate) return "Date TBA";
  const parts = startDate.split("-");
  if (parts.length !== 3) return startDate;
  const d = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
  );
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type SimilarEvent = {
  id: string;
  title: string;
  category: string;
  venue: string;
  city: string;
  start_date: string;
  image_url: string | null;
  rating: number;
  price_min: number | null;
  price_max: number | null;
};

type SimilarEventsResponse = {
  events: SimilarEvent[];
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatEventDate(startDate: string): string {
  if (!startDate) return "Dates TBA";
  const parts = startDate.split("-");
  if (parts.length === 3) {
    const d = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return startDate;
}

function formatICSDate(startDate: string, startTime: string): string {
  const datePart = (startDate || "").replace(/-/g, "");
  if (datePart.length !== 8) {
    return "20260101T090000";
  }

  const timeRaw = (startTime || "").trim();
  const timeMatch = timeRaw.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch && timeRaw !== "Time TBA") {
    const hours = timeMatch[1].padStart(2, "0");
    const minutes = timeMatch[2];
    return `${datePart}T${hours}${minutes}00`;
  }

  return `${datePart}T090000`;
}

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function sanitizeICSFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "event";
}

export default function ExploreEventDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<SimilarEvent[]>([]);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleBackToExplore = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const hub = loadExploreHubState();
    const qs =
      hub?.activeCategory && hub.activeCategory !== "All"
        ? `?category=${encodeURIComponent(hub.activeCategory)}`
        : "";
    router.push(`/explore${qs}`);
  }, [router]);

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<EventDetail>(
          `/explore/events/${encodeURIComponent(id)}`,
          {},
          EXPLORE_FETCH_TIMEOUT_MS,
        );
        if (data) {
          setEvent(data);
          return;
        }
        setError("Event detail not found.");
      } catch (err) {
        const snapshot = findCachedExploreEvent(id);
        if (snapshot) {
          setEvent({
            id: snapshot.id,
            title: snapshot.name,
            category: snapshot.category,
            venue: snapshot.venue,
            city: snapshot.city,
            state: "",
            start_date: snapshot.date,
            start_time: snapshot.time,
            price_min: snapshot.price_min,
            price_max: snapshot.price_max,
            image_url: snapshot.image_url,
            ticket_url: snapshot.ticket_url,
            source: snapshot.source,
            distance_miles: snapshot.distance_miles ?? 0,
            rating: 4.5,
          });
          return;
        }
        console.warn("Failed to load explore event detail:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load event details.",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadEvent();
  }, [id]);

  useEffect(() => {
    if (!event?.id) {
      setSimilarEvents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<SimilarEventsResponse>(
          `/explore/events/similar/${encodeURIComponent(event.id)}?limit=4`,
          {},
          EXPLORE_FETCH_TIMEOUT_MS,
        );
        if (!cancelled) {
          setSimilarEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch {
        if (!cancelled) setSimilarEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.id]);

  const handleShare = useCallback(async () => {
    if (!event) return;
    const url = buildShareUrl(event.id);
    const sharePayload = {
      title: event.title,
      text: "Check out this event on Rovvy",
      url,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(sharePayload);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      triggerToast("Link copied!");
    } catch {
      triggerToast("Could not copy link");
    }
  }, [event, triggerToast]);

  const handleAddToCalendar = useCallback(() => {
    if (!event) return;

    const location = [event.venue, event.city].filter(Boolean).join(", ");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Rovvy//Explore Event//EN",
      "BEGIN:VEVENT",
      `DTSTART:${formatICSDate(event.start_date, event.start_time)}`,
      `SUMMARY:${escapeICSText(event.title)}`,
      `LOCATION:${escapeICSText(location)}`,
      `URL:${escapeICSText(event.ticket_url || buildShareUrl(event.id))}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${sanitizeICSFilename(event.title)}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    triggerToast("Added to calendar");
  }, [event, triggerToast]);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    setTripsError(null);
    try {
      const data = await apiFetch<TripListItem[]>("/trips");
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      setTrips([]);
      setTripsError(
        err instanceof Error ? err.message : "Could not load your trips.",
      );
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const openSaveModal = () => {
    setSelectedTripId("");
    setSaveModalOpen(true);
    void loadTrips();
  };

  const openPollModal = () => {
    setSelectedTripId("");
    setPollModalOpen(true);
    void loadTrips();
  };

  const handleSaveToTrip = async () => {
    if (!event || !selectedTripId) return;
    setSaveBusy(true);
    try {
      await apiFetch(`/trips/${selectedTripId}/items`, {
        method: "POST",
        body: JSON.stringify({
          event_id: event.id,
          title: event.title,
          category: event.category,
          venue: event.venue,
          city: event.city,
          state: event.state,
          start_date: event.start_date,
          start_time: event.start_time,
          price_min: event.price_min,
          price_max: event.price_max,
          image_url: event.image_url,
          ticket_url: event.ticket_url,
        }),
      });
      const trip = trips.find((t) => t.id === selectedTripId);
      triggerToast(`Saved to ${trip?.title ?? "trip"}`);
      setSaveModalOpen(false);
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : "Could not save to trip.",
      );
    } finally {
      setSaveBusy(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!event || !selectedTripId) return;
    setPollBusy(true);
    try {
      await apiFetch("/polls", {
        method: "POST",
        body: JSON.stringify({
          trip_id: selectedTripId,
          question: `Should we go to ${event.title}?`,
          poll_type: "activity",
          options: [{ label: "Yes, let's go!" }, { label: "Not this time" }],
        }),
      });
      triggerToast("Poll sent to group");
      setPollModalOpen(false);
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : "Could not create poll.",
      );
    } finally {
      setPollBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-slate-600 animate-pulse">
            Loading experience details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <MapPin size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Unable to load event</h2>
          <p className="mt-2 text-sm text-slate-500">{error || "Event not found"}</p>
          <button
            type="button"
            onClick={handleBackToExplore}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-800"
          >
            <ArrowLeft size={16} />
            Back to Explore
          </button>
        </div>
      </div>
    );
  }

  const hasPrice = event.price_min != null || event.price_max != null;
  const priceDisplay =
    event.price_min != null && event.price_max != null
      ? event.price_min === event.price_max
        ? `$${Math.round(event.price_min)}`
        : `$${Math.round(event.price_min)} - $${Math.round(event.price_max)}`
      : event.price_min != null
        ? `From $${Math.round(event.price_min)}`
        : "See pricing";

  const mapQuery = encodeURIComponent(`${event.venue} ${event.city}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const pollQuestion = `Should we go to ${event.title}?`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-800">
      {toastMessage && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 transform rounded-2xl border border-slate-200 bg-white/95 px-6 py-3 shadow-xl backdrop-blur-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Plus size={14} className="animate-bounce" />
            </div>
            <span className="text-sm font-semibold text-slate-800">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Save to Trip modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={() => !saveBusy && setSaveModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Save to Trip</h3>
              <button
                type="button"
                onClick={() => !saveBusy && setSaveModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {tripsLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="ml-2 text-sm">Loading trips...</span>
              </div>
            ) : tripsError ? (
              <p className="py-6 text-center text-sm text-red-600">{tripsError}</p>
            ) : trips.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-600">Create a trip first</p>
                <Link
                  href="/plan"
                  className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Plan a trip
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">
                  Choose a trip to save this event to:
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {trips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setSelectedTripId(trip.id)}
                      className={`flex w-full flex-col rounded-xl border px-4 py-3 text-left transition ${
                        selectedTripId === trip.id
                          ? "border-teal-600 bg-teal-50"
                          : "border-slate-200 hover:border-teal-300"
                      }`}
                    >
                      <span className="font-semibold text-slate-800">{trip.title}</span>
                      {trip.group_name && (
                        <span className="text-xs text-slate-500">{trip.group_name}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedTripId || saveBusy}
                  onClick={() => void handleSaveToTrip()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-teal-800"
                >
                  {saveBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save to trip
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Poll modal */}
      {pollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={() => !pollBusy && setPollModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Create Poll</h3>
              <button
                type="button"
                onClick={() => !pollBusy && setPollModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Poll question
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">{pollQuestion}</p>
            </div>

            {tripsLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="ml-2 text-sm">Loading trips...</span>
              </div>
            ) : tripsError ? (
              <p className="py-4 text-center text-sm text-red-600">{tripsError}</p>
            ) : trips.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-600">Create a trip first</p>
                <Link
                  href="/plan"
                  className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Plan a trip
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">
                  Send poll to which group trip?
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {trips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setSelectedTripId(trip.id)}
                      className={`flex w-full flex-col rounded-xl border px-4 py-3 text-left transition ${
                        selectedTripId === trip.id
                          ? "border-teal-600 bg-teal-50"
                          : "border-slate-200 hover:border-teal-300"
                      }`}
                    >
                      <span className="font-semibold text-slate-800">{trip.title}</span>
                      {trip.group_name && (
                        <span className="text-xs text-slate-500">{trip.group_name}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedTripId || pollBusy}
                  onClick={() => void handleCreatePoll()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-teal-800"
                >
                  {pollBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Send poll
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="relative h-64 w-full md:h-80 lg:h-96">
        <ExploreCardImage
          imageUrl={event.image_url}
          alt={event.title}
          category={event.category}
          className="relative h-full w-full overflow-hidden"
          imgClassName="h-full w-full object-cover"
          overlay
        />

        <button
          type="button"
          onClick={handleBackToExplore}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white active:scale-95"
        >
          <ArrowLeft size={18} className="text-slate-700" />
        </button>

        <button
          type="button"
          onClick={() => void handleShare()}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white active:scale-95"
        >
          <Share2 size={18} className="text-slate-700" />
        </button>

        <span className="absolute bottom-4 left-4 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
          {event.category}
        </span>
      </div>

      <div className="mx-auto max-w-[800px] px-4 py-6">
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star size={16} className="fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-bold text-slate-700">{event.rating} Rating</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Navigation size={12} className="text-teal-600" />
              <span>{event.distance_miles} mi away</span>
            </div>
          </div>

          <h1 className="text-xl font-bold leading-tight text-slate-800 md:text-2xl">
            {event.title}
          </h1>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{event.venue}</p>
                <p className="text-xs text-slate-500">
                  {event.city}
                  {event.state ? `, ${event.state}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {formatEventDate(event.start_date)}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  {event.start_time || "Time TBA"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
            Ticket pricing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-slate-800">{priceDisplay}</p>
              <p className="mt-1 text-xs text-slate-400">
                {hasPrice
                  ? "Excluding standard ticketing fees"
                  : "Check official ticket link for rates"}
              </p>
            </div>
            <div className="rounded-lg bg-teal-50/50 px-3.5 py-2 text-xs font-semibold text-teal-800">
              via {event.source || "Partner"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
            Rovvy Recommendation
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            This highly-rated event is currently trending in the {event.city} area! With a
            premium {event.rating}/5.0 star recommendation rating, it represents a fantastic
            addition to your group trip plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              🎟️ Fast Pass Eligible
            </span>
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              👥 Great for groups
            </span>
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              📸 Photo-friendly
            </span>
          </div>
        </div>

        {similarEvents.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              You Might Also Like
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {similarEvents.map((item) => {
                const price =
                  item.price_min != null && item.price_max != null
                    ? item.price_min === item.price_max
                      ? `$${Math.round(item.price_min)}`
                      : `$${Math.round(item.price_min)}+`
                    : item.price_min != null
                      ? `From $${Math.round(item.price_min)}`
                      : "See pricing";
                return (
                  <Link
                    key={item.id}
                    href={`/explore/event/${encodeURIComponent(item.id)}`}
                    className="w-56 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <ExploreCardImage
                        imageUrl={item.image_url}
                        alt={item.title}
                        category={item.category}
                        className="relative h-full w-full overflow-hidden"
                        imgClassName="h-full w-full object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                        {item.category}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                        {item.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {formatSimilarDate(item.start_date)} · {item.city}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Star size={12} className="fill-yellow-400 text-yellow-400" />
                          {item.rating}
                        </span>
                        <span className="font-semibold text-teal-700">{price}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/90 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[800px] gap-2">
          <button
            type="button"
            onClick={() => {
              if (event.ticket_url) {
                window.open(event.ticket_url, "_blank", "noopener,noreferrer");
              } else {
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(`${event.title} tickets`)}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 py-3.5 text-sm font-bold text-white transition-all hover:bg-teal-800 hover:shadow-md active:scale-95"
          >
            <Ticket size={16} />
            Book Tickets
            <ExternalLink size={12} className="opacity-80" />
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
              title="Open in Maps"
            >
              <MapPin size={18} />
            </button>

            <button
              type="button"
              onClick={handleAddToCalendar}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
              title="Add to Calendar"
            >
              <Calendar size={18} />
            </button>

            <button
              type="button"
              onClick={openSaveModal}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
              title="Save to Trip"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={openPollModal}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
              title="Create Poll"
            >
              <Vote size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
