"use client";

type EventCardItem = {
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
};

export function EventCard({ event, view, onOpen }: EventCardProps) {
  const list = view === "list";
  const isGooglePlace = event.sourceType === "google_places";
  const isGoogleEvent = event.sourceType === "google_events";
  const sourceLabel = isGoogleEvent
    ? "Google"
    : isGooglePlace
      ? "Google Places"
      : event.sourceShort || event.source;

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={[
        "group overflow-hidden rounded-3xl border border-white/10 bg-[#102f55] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#E94560]/60",
        list ? "grid gap-0 sm:grid-cols-[220px_1fr]" : "",
      ].join(" ")}
    >
      <div
        className={[
          "relative overflow-hidden bg-gradient-to-br from-[#0F3460] via-[#16213E] to-[#E94560]/80",
          list ? "h-44 sm:h-full" : "h-44",
        ].join(" ")}
      >
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            {event.emoji}
          </div>
        )}
        <span
          className={[
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
            isGooglePlace ? "bg-emerald-600" : "bg-blue-600",
          ].join(" ")}
        >
          {sourceLabel}
        </span>
        {event.isFree ? (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
            FREE
          </span>
        ) : null}
      </div>

      <div className="flex min-h-[190px] flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white">
            {event.title}
          </h3>
          <p className="mt-2 truncate text-xs text-white/65">
            {event.venue} · {event.city}
          </p>
          <p className="mt-1 truncate text-xs text-white/55">
            {event.dateLabel} · {event.distanceLabel}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
            {event.priceLabel || "Price TBD"}
          </p>
          <span className="rounded-full bg-[#E94560] px-4 py-2 text-xs font-bold text-white">
            Interested
          </span>
        </div>
      </div>
    </button>
  );
}
