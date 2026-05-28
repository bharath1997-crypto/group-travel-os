"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Plus,
  Share2,
  Star,
  Ticket,
  Vote,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ExploreEventDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        const data = await apiFetch<EventDetail>(`/explore/events/${id}`);
        if (data) {
          setEvent(data);
        } else {
          setError("Event detail not found.");
        }
      } catch (err) {
        console.error("Failed to load explore event detail:", err);
        setError("Failed to load event details. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    void loadEvent();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-800">
      {/* Toast Notification */}
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

      {/* Hero Header */}
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

        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white active:scale-95"
        >
          <ArrowLeft size={18} className="text-slate-700" />
        </button>

        {/* Share Button */}
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

        {/* Category Pill */}
        <span className="absolute bottom-4 left-4 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
          {event.category}
        </span>
      </div>

      {/* Page Layout */}
      <div className="mx-auto max-w-[800px] px-4 py-6">
        {/* Title & Metadata Card */}
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
            {/* Venue & Location */}
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

            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {event.start_date
                    ? new Date(event.start_date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Dates TBA"}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} />
                  {event.start_time || "Time TBA"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-500 uppercase tracking-wider">
            Ticket pricing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-slate-800">{priceDisplay}</p>
              <p className="mt-1 text-xs text-slate-400">
                {hasPrice ? "Excluding standard ticketing fees" : "Check official ticket link for rates"}
              </p>
            </div>
            <div className="rounded-lg bg-teal-50/50 px-3.5 py-2 text-xs font-semibold text-teal-800">
              via {event.source || "Partner"}
            </div>
          </div>
        </div>

        {/* Description & Recommendations Box */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-500 uppercase tracking-wider">
            Rovvy Recommendation
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            This highly-rated event is currently trending in the {event.city} area! With a premium {event.rating}/5.0 star recommendation rating, it represents a fantastic addition to your group trip plan.
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

      {/* Sticky Bottom Action Rail */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/90 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[800px] gap-2">
          {/* Main Handoff CTA */}
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

          {/* Secondary Actions */}
          <div className="flex gap-2">
            {/* Open in Maps */}
            <button
              type="button"
              onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
              title="Open in Maps"
            >
              <MapPin size={18} />
            </button>

            {/* Save to Trip */}
            <button
              type="button"
              onClick={() => triggerToast("Added experience to group travel itinerary!")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
              title="Save to Trip"
            >
              <Plus size={18} />
            </button>

            {/* Create Poll */}
            <button
              type="button"
              onClick={() => triggerToast("Created group experience coordinate poll!")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
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
