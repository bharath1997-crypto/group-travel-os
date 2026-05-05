"use client";

type HeroEvent = {
  id: string;
  title: string;
  source: string;
  sourceType?: string;
  venue: string;
  city: string;
  dateLabel: string;
  priceLabel: string;
  isFree: boolean;
  emoji: string;
  imageUrl?: string | null;
};

type HeroEventCardProps = {
  event: HeroEvent;
  onOpen: (event: HeroEvent) => void;
};

export function HeroEventCard({ event, onOpen }: HeroEventCardProps) {
  const isGooglePlace = event.sourceType === "google_places";
  const isGoogleEvent = event.sourceType === "google_events";
  const sourceLabel = isGoogleEvent ? "Google" : isGooglePlace ? "Google Places" : event.source;

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="group w-[280px] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-[#102f55] text-left shadow-xl transition hover:-translate-y-0.5 hover:border-[#E94560]/60 sm:w-[320px]"
    >
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#0F3460] via-[#16213E] to-[#E94560]/80">
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
            "absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow",
            isGooglePlace ? "bg-emerald-600" : "bg-blue-600",
          ].join(" ")}
        >
          {sourceLabel}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow">
          {event.priceLabel || (event.isFree ? "Free" : "Price TBD")}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-base font-bold leading-snug text-white">
            {event.title}
          </h3>
          <p className="mt-1 truncate text-xs text-white/65">
            {event.venue} · {event.dateLabel}
          </p>
        </div>
        <div className="rounded-2xl bg-[#E94560] px-4 py-2 text-center text-sm font-bold text-white transition group-hover:bg-[#ff5670]">
          I&apos;m Interested
        </div>
      </div>
    </button>
  );
}
