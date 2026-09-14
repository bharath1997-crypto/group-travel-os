"use client";

import { ExternalLink, Luggage, RefreshCw, ShieldCheck } from "lucide-react";
import FlightJourneyTimeline, { JourneyDisclosureSummary } from "@/components/travel/FlightJourneyTimeline";
import type { RovvyItineraryGroup, RovvySellerOption, FlightJourney } from "@/lib/flight-types";
import { formatDuration, formatExpiresIn, formatPrice } from "@/lib/flight-format";
import { journeyConnectionCount, journeySegmentCount } from "@/lib/flight-disclosure-ui";
import { isOfferExpired } from "@/lib/flight-journey-ui";

type Props = {
  group: RovvyItineraryGroup | null;
  loading?: boolean;
  onClose: () => void;
};

function providerDisplayName(providerId: string): string {
  if (providerId === "duffel") return "Duffel";
  if (providerId === "amadeus") return "Amadeus";
  return providerId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function testOfferCopy(option: RovvySellerOption): { title: string; body: string } {
  const name = providerDisplayName(option.provider_id);
  if (option.provider_id === "amadeus") {
    return {
      title: "Test airline offers",
      body: "Test offer supplied through Amadeus",
    };
  }
  if (option.provider_id === "duffel") {
    return {
      title: "Test airline offers",
      body: "Powered by Duffel sandbox · No real booking will be created",
    };
  }
  return {
    title: "Test airline offers",
    body: `Test offer supplied through ${name}`,
  };
}

function actionLabel(option: RovvySellerOption): string {
  return `Continue to ${option.seller_name}`;
}

function canContinue(option: RovvySellerOption, expired: boolean): boolean {
  if (expired) return false;
  return option.action_type === "external_redirect" && Boolean(option.redirect_url);
}

export default function FlightOptionsDrawer({ group, loading = false, onClose }: Props) {
  if (!group && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Booking options">
      <button type="button" aria-label="Close booking options" className="absolute inset-0" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">View options</h2>
              <p className="mt-1 text-sm text-slate-600">
                Compare provider offers for {group?.origin} → {group?.destination}.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-slate-500">Loading options…</p> : null}

          {!loading && group ? (
            <div className="space-y-4">
              {group.seller_options.map((option) => {
                const expired = isOfferExpired(option.expires_at || undefined);
                const testMode = option.environment === "test";
                const pseudoJourney = {
                  slices: group.slices,
                  stops: group.stops,
                  total_duration_minutes: group.total_duration_minutes,
                } as FlightJourney;

                return (
                  <article key={option.provider_offer_id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{option.seller_name}</p>
                        <p className="text-xs text-slate-500">Provider: {option.provider_id}</p>
                      </div>
                      <p className="text-lg font-extrabold text-slate-900">
                        {formatPrice(option.currency, option.total_price)}
                      </p>
                    </div>

                    {testMode ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p className="font-semibold">{testOfferCopy(option).title}</p>
                        <p>{testOfferCopy(option).body}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-2 text-xs text-slate-600">
                      <p>
                        {journeySegmentCount(pseudoJourney)} segment
                        {journeySegmentCount(pseudoJourney) === 1 ? "" : "s"} ·{" "}
                        {journeyConnectionCount(pseudoJourney)} connection
                        {journeyConnectionCount(pseudoJourney) === 1 ? "" : "s"} ·{" "}
                        {formatDuration(group.total_duration_minutes)}
                      </p>
                      <JourneyDisclosureSummary
                        ticketType={option.ticket_type}
                        connectionProtection={option.connection_protection}
                        baggageTransfer={option.baggage_transfer}
                        providerName={option.seller_name}
                      />
                    </div>

                    <div className="mt-3">
                      <FlightJourneyTimeline slices={group.slices} compact providerName={option.seller_name} />
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <p className="inline-flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Price checked {new Date(option.checked_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                      {option.expires_at ? <p>{formatExpiresIn(option.expires_at)}</p> : null}
                      {option.last_ticketing_date ? (
                        <p>Last ticketing date: {option.last_ticketing_date}</p>
                      ) : null}
                      <p className="inline-flex items-start gap-1">
                        <Luggage className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{option.baggage.summary || "Not confirmed"}</span>
                      </p>
                      <p>{option.fare_conditions.summary || "Not confirmed"}</p>
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                      Payment, ticketing, flight changes, cancellations, refunds, and customer support are handled by {option.seller_name}. Rovvy does not issue or service tickets.
                    </p>

                    {canContinue(option, expired) ? (
                      <a
                        href={option.redirect_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover"
                      >
                        {actionLabel(option)}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-slate-600">
                          {expired
                            ? "This offer has expired. Search again for current fares."
                            : option.action_type === "unavailable"
                              ? "An external provider link is not available for this offer."
                              : "This offer cannot be continued right now."}
                        </p>
                        <button
                          type="button"
                          disabled
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 text-sm font-bold text-slate-500"
                        >
                          {actionLabel(option)}
                        </button>
                      </div>
                    )}

                    {expired ? (
                      <p className="mt-2 text-xs font-semibold text-rose-700">This offer has expired. Search again for current fares.</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Compare available airline offers · Redirect to provider for booking
          </p>
        </div>
      </aside>
    </div>
  );
}
