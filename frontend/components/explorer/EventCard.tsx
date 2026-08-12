"use client";

import { BarChart2, Bookmark, Share2, Users } from "lucide-react";

export type EventCardItem = {
  id: string;
  title: string;
  source: string;
  sourceShort: string;
  sourceType?: string;
  venue: string;
  city: string;
  dateLabel: string;
  distanceLabel: string;
  priceLabel: string;
  isFree: boolean;
  emoji: string;
  imageUrl?: string | null;
};

type EventCardProps = {
  event: EventCardItem;
  view: "grid" | "list";
  onOpen: (event: EventCardItem) => void;
  explorerMode?: boolean;
  compact?: boolean;
  onSave?: () => void;
  onAddToTrip?: () => void;
  onPoll?: () => void;
  onShare?: () => void;
};

function sourcePillClass(event: EventCardItem): string {
  const t = (event.sourceType || "").toLowerCase();
  const sh = (event.sourceShort || "").toLowerCase();
  if (t.includes("ticketmaster") || sh === "tm") return "bg-red-600 ring-red-500/40";
  if (t.includes("eventbrite") || sh === "eb") return "bg-orange-500 ring-orange-400/35";
  if (t.includes("google")) return "bg-blue-600 ring-blue-500/40";
  if (t.includes("ai")) return "bg-violet-600 ring-violet-500/35";
  return "bg-[#1E293B] ring-[#1E293B]/60";
}

function EventImagePanel({
  event,
  sourceLabel,
  className,
}: {
  event: EventCardItem;
  sourceLabel: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative w-full overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0d1f33]",
        className ?? "",
      ].join(" ")}
    >
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-5xl">{event.emoji}</div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d1f33]" />
      <span
        className={[
          "absolute left-3 top-3 z-[1] rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1",
          sourcePillClass(event),
        ].join(" ")}
      >
        {sourceLabel}
      </span>
      <span
        className={[
          "absolute right-3 top-3 z-[1] max-w-[45%] truncate rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md",
          event.isFree ? "bg-emerald-500 ring-1 ring-emerald-400/50" : "bg-primary ring-1 ring-primary/60",
        ].join(" ")}
      >
        {event.isFree ? "Free" : event.priceLabel ? event.priceLabel.slice(0, 18) : "Paid"}
      </span>
    </div>
  );
}

function EventBody({
  event,
  titleClass,
  showFooterCta,
}: {
  event: EventCardItem;
  titleClass: string;
  showFooterCta: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-2 p-3">
      <div className="min-w-0 space-y-1">
        <h3 className={["line-clamp-2 font-bold leading-snug text-white", titleClass].join(" ")}>{event.title}</h3>
        <p className="truncate text-xs text-gray-300">
          {event.venue}
          {event.city ? ` · ${event.city}` : ""}
        </p>
        <p className="truncate text-xs text-gray-500">
          {event.dateLabel}
          {event.distanceLabel ? ` · ${event.distanceLabel}` : ""}
        </p>
      </div>
      {showFooterCta ? (
        <div className="flex items-center gap-2 pt-1">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-400">{event.priceLabel || "Price TBD"}</p>
          <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            View
          </span>
        </div>
      ) : (
        <p className="truncate pt-1 text-xs font-semibold text-gray-400">{event.priceLabel || "Price TBD"}</p>
      )}
    </div>
  );
}

export function EventCard({
  event,
  view,
  onOpen,
  explorerMode = false,
  compact = false,
  onSave,
  onAddToTrip,
  onPoll,
  onShare,
}: EventCardProps) {
  const list = view === "list";
  const isGooglePlace = event.sourceType === "google_places";
  const isGoogleEvent = event.sourceType === "google_events";
  const sourceLabel = isGoogleEvent
    ? "Google"
    : isGooglePlace
      ? "Google Places"
      : event.sourceShort || event.source;

  const minH = compact ? "min-h-[220px]" : "min-h-[280px]";
  const titleClass = compact ? "text-sm" : "text-[15px]";

  const explorerActions = (
    <div className="flex items-center justify-center gap-2 border-t border-[#1E293B]/60 bg-[#071221]/90 px-2 py-2">
      <button
        type="button"
        title="Save"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSave?.();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1E293B] bg-[#0d1f33] text-gray-300 transition hover:border-primary/50 hover:text-white"
      >
        <Bookmark className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Add to trip"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddToTrip?.();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1E293B] bg-[#0d1f33] text-gray-300 transition hover:border-primary/50 hover:text-white"
      >
        <Users className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Poll group"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPoll?.();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1E293B] bg-[#0d1f33] text-gray-300 transition hover:border-primary/50 hover:text-white"
      >
        <BarChart2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Share"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onShare?.();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1E293B] bg-[#0d1f33] text-gray-300 transition hover:border-primary/50 hover:text-white"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );

  if (!explorerMode) {
    if (list) {
      return (
        <button
          type="button"
          onClick={() => onOpen(event)}
          className="group/img grid w-full overflow-hidden rounded-xl border border-[#1E293B] bg-[#0d1f33] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-primary/45 sm:min-h-[200px] sm:grid-cols-[minmax(0,220px)_1fr]"
        >
          <EventImagePanel event={event} sourceLabel={sourceLabel} className="h-44 sm:h-full sm:min-h-[200px]" />
          <EventBody event={event} titleClass="text-[15px]" showFooterCta />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        className={[
          "group/img flex w-full flex-col overflow-hidden rounded-xl border border-[#1E293B] bg-[#0d1f33] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-primary/45",
          minH,
        ].join(" ")}
      >
        <EventImagePanel event={event} sourceLabel={sourceLabel} className="flex-[0_0_55%] min-h-[120px]" />
        <EventBody event={event} titleClass={titleClass} showFooterCta />
      </button>
    );
  }

  const widthCls = compact ? "w-[min(280px,85vw)] shrink-0" : "w-[min(320px,90vw)] shrink-0";

  if (list) {
    return (
      <div className="group/img grid overflow-hidden rounded-xl border border-[#1E293B] bg-[#0d1f33] shadow-lg transition hover:border-primary/45 sm:min-h-[200px] sm:grid-cols-[220px_1fr]">
        <EventImagePanel event={event} sourceLabel={sourceLabel} className="h-44 sm:h-full sm:min-h-[200px]" />
        <div className="flex min-h-0 flex-col">
          <button
            type="button"
            onClick={() => onOpen(event)}
            className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <EventBody event={event} titleClass="text-[15px]" showFooterCta={false} />
          </button>
          {explorerActions}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "group/img flex flex-col overflow-hidden rounded-xl border border-[#1E293B] bg-[#0d1f33] shadow-lg transition hover:border-primary/45",
        widthCls,
        minH,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onOpen(event)}
        className="flex min-h-0 flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <EventImagePanel event={event} sourceLabel={sourceLabel} className="flex-[0_0_55%] min-h-[120px]" />
        <EventBody event={event} titleClass={titleClass} showFooterCta={false} />
      </button>
      {explorerActions}
    </div>
  );
}
