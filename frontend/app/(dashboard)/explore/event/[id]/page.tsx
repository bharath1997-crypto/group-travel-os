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
import { loadEventSnapshot } from "@/lib/explore-events";

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

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<EventDetail>(
          `/explore/events/${encodeURIComponent(id)}`,
        );
        if (data) {
          setEvent(data);
          return;
        }
        setError("Event detail not found.");
      } catch (err) {
        const snapshot = loadEventSnapshot(id);
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
        console.error("Failed to load explore event detail:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load event details.",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadEvent();
  }, [id]);

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
            onClick={() => router.push("/explore")}
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
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-200">
            <span className="text-slate-400">No event image available</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white active:scale-95"
        >
          <ArrowLeft size={18} className="text-slate-700" />
        </button>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            triggerToast("Link copied to clipboard!");
          }}
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
