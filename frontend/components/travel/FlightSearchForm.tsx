"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search, Calendar, Users, Plus, Trash2, Clock, SlidersHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { labelForFlightIata, resolveFlightIataFromText } from "@/lib/flight-place-suggestions";
import { buildFlightResultsPath } from "@/lib/flight-search-params";
import type { FlightCabin, FlightSearchParams, MultiCityLeg } from "@/lib/flight-types";
import {
  countAdvancedOptions,
  MAX_MULTI_CITY_LEGS,
  todayIso,
  validateMultiCityLegs,
  validateRoundTripDates,
} from "@/lib/flight-search-validation";
import FlightPlaceInput, { type FlightPlaceValue } from "@/components/travel/FlightPlaceInput";
import FlightDateField from "@/components/travel/FlightDateField";
import TravelerCabinPicker from "@/components/travel/TravelerCabinPicker";
import type { TravelHandoffContext } from "@/lib/travel-handoff";
import { useDashboardUser } from "@/contexts/dashboard-user-context";

const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

const inputClass = `${fieldBase} py-3`;

/** Fixed height so depart / return / travelers align on one row. */
const rowFieldClass = `${fieldBase} h-11`;

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function placeFromHandoff(iata: string | null | undefined, fallbackLabel?: string): FlightPlaceValue {
  const code = (iata || "").trim().toUpperCase();
  if (!code) return { label: fallbackLabel || "", iata: code };
  return { label: labelForFlightIata(code), iata: code };
}

type Props = {
  handoff?: TravelHandoffContext | null;
  initial?: Partial<FlightSearchParams> | null;
  compact?: boolean;
};

const TRIP_TYPES = [
  { id: "roundtrip" as const, label: "Round trip" },
  { id: "oneway" as const, label: "One way" },
  { id: "multicity" as const, label: "Multi-city" },
];

export default function FlightSearchForm({ handoff = null, initial = null, compact = false }: Props) {
  const router = useRouter();
  const { user } = useDashboardUser();
  const userId = user?.id ? String(user.id) : null;
  const minDate = todayIso();
  const [submitting, setSubmitting] = useState(false);
  const [tripType, setTripType] = useState<"oneway" | "roundtrip" | "multicity">(
    initial?.tripType || (initial?.return ? "roundtrip" : "roundtrip"),
  );

  const [from, setFrom] = useState<FlightPlaceValue>(() =>
    initial?.from
      ? { label: initial.fromLabel || labelForFlightIata(initial.from), iata: initial.from }
      : placeFromHandoff(handoff?.originIata, handoff?.origin?.name),
  );
  const [to, setTo] = useState<FlightPlaceValue>(() =>
    initial?.to
      ? { label: initial.toLabel || labelForFlightIata(initial.to), iata: initial.to }
      : placeFromHandoff(handoff?.destinationIata, handoff?.destination?.name),
  );

  const [departDate, setDepartDate] = useState(initial?.depart || todayPlus(14));
  const [returnDate, setReturnDate] = useState(initial?.return || "");
  const [departureTimeFrom, setDepartureTimeFrom] = useState(initial?.departureTimeFrom || "");
  const [departureTimeTo, setDepartureTimeTo] = useState(initial?.departureTimeTo || "12:00");

  const [extraLegs, setExtraLegs] = useState<
    Array<{ from: FlightPlaceValue; to: FlightPlaceValue; date: string }>
  >(() => {
    if (initial?.multiCityLegs && initial.multiCityLegs.length > 0) {
      return initial.multiCityLegs.map((leg) => ({
        from: { label: leg.fromLabel || labelForFlightIata(leg.from), iata: leg.from },
        to: { label: leg.toLabel || labelForFlightIata(leg.to), iata: leg.to },
        date: leg.depart,
      }));
    }
    return [{ from: { label: "", iata: "" }, to: { label: "", iata: "" }, date: todayPlus(20) }];
  });

  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [infants, setInfants] = useState(initial?.infants ?? 0);
  const [cabin, setCabin] = useState<FlightCabin>(initial?.cabin ?? "M");
  const [nonstop, setNonstop] = useState(initial?.nonstop ?? false);
  const [maximumConnections, setMaximumConnections] = useState(initial?.maximumConnections ?? 1);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initial?.departureTimeFrom || initial?.departureTimeTo || initial?.nonstop || initial?.maximumConnections !== undefined),
  );

  const advancedCount = useMemo(
    () =>
      countAdvancedOptions({
        departureTimeFrom,
        departureTimeTo,
        nonstop,
        maximumConnections,
      }),
    [departureTimeFrom, departureTimeTo, nonstop, maximumConnections],
  );

  useEffect(() => {
    if (!handoff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync handoff context into controlled place inputs
    if (handoff.originIata) setFrom(placeFromHandoff(handoff.originIata, handoff.origin.name));
    if (handoff.destinationIata) setTo(placeFromHandoff(handoff.destinationIata, handoff.destination.name));
  }, [handoff]);

  const handleDepartChange = (value: string) => {
    setDepartDate(value);
    if (returnDate && value > returnDate) setReturnDate("");
  };

  const submit = useCallback(() => {
    if (submitting) return;
    setErrorBanner(null);

    const origin = (from.iata || resolveFlightIataFromText(from.label) || "").toUpperCase();
    const dest = (to.iata || resolveFlightIataFromText(to.label) || "").toUpperCase();

    if (!origin) {
      setErrorBanner("Choose an origin city or airport.");
      return;
    }
    if (!dest || dest === "ANYWHERE") {
      setErrorBanner("Choose a specific destination airport or city.");
      return;
    }
    if (origin === dest) {
      setErrorBanner("Origin and destination must be different.");
      return;
    }

    if (tripType === "roundtrip") {
      const dateError = validateRoundTripDates(departDate, returnDate);
      if (dateError) {
        setErrorBanner(dateError);
        return;
      }
    } else if (departDate < minDate) {
      setErrorBanner("Departure date cannot be in the past.");
      return;
    }

    let parsedLegs: MultiCityLeg[] | undefined;
    if (tripType === "multicity") {
      parsedLegs = extraLegs.map((leg) => ({
        from: (leg.from.iata || resolveFlightIataFromText(leg.from.label) || "").toUpperCase(),
        to: (leg.to.iata || resolveFlightIataFromText(leg.to.label) || "").toUpperCase(),
        depart: leg.date,
        fromLabel: leg.from.label,
        toLabel: leg.to.label,
      }));
      const multiCityError = validateMultiCityLegs(
        { from: origin, to: dest, depart: departDate },
        parsedLegs,
      );
      if (multiCityError) {
        setErrorBanner(multiCityError);
        return;
      }
    }

    const params: FlightSearchParams = {
      from: origin,
      to: dest,
      fromLabel: from.label,
      toLabel: to.label,
      depart: departDate,
      return: tripType === "roundtrip" ? returnDate : undefined,
      adults,
      children,
      infants,
      cabin,
      nonstop: nonstop || undefined,
      tripType,
      multiCityLegs: parsedLegs,
      maximumConnections: nonstop ? 0 : maximumConnections,
      departureTimeFrom: departureTimeFrom || undefined,
      departureTimeTo: departureTimeTo || undefined,
    };

    setSubmitting(true);
    router.push(buildFlightResultsPath(params));
  }, [
    submitting,
    from,
    to,
    departDate,
    returnDate,
    tripType,
    extraLegs,
    adults,
    children,
    infants,
    cabin,
    nonstop,
    maximumConnections,
    departureTimeFrom,
    departureTimeTo,
    minDate,
    router,
  ]);

  const swapPlaces = () => {
    setFrom(to);
    setTo(from);
  };

  const addLeg = () => {
    const totalLegs = 1 + extraLegs.length;
    if (totalLegs >= MAX_MULTI_CITY_LEGS) {
      setErrorBanner(`Multi-city searches support up to ${MAX_MULTI_CITY_LEGS} flights.`);
      return;
    }
    const lastLegDate = extraLegs.length > 0 ? extraLegs[extraLegs.length - 1].date : departDate;
    const nextDate = new Date(lastLegDate || departDate);
    nextDate.setDate(nextDate.getDate() + 5);
    const prevTo = extraLegs.length > 0 ? extraLegs[extraLegs.length - 1].to : to;
    setExtraLegs([
      ...extraLegs,
      {
        from: prevTo.iata ? prevTo : { label: "", iata: "" },
        to: { label: "", iata: "" },
        date: nextDate.toISOString().slice(0, 10),
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border border-slate-200 bg-white ${compact ? "p-4" : "p-5 md:p-6"}`}>
        <div className="mb-5 inline-flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
          {TRIP_TYPES.map((type) => {
            const active = tripType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setTripType(type.id);
                  if (type.id === "oneway") setReturnDate("");
                }}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        <div className="relative grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div>
            <label htmlFor="flight-from" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              From
            </label>
            <FlightPlaceInput value={from} onChange={setFrom} placeholder="City or airport" inputClassName={inputClass} userId={userId} />
          </div>
          <button
            type="button"
            onClick={swapPlaces}
            aria-label="Swap origin and destination"
            className="absolute right-3 top-[calc(50%+0.75rem)] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-teal-300 hover:text-teal-700 md:static md:h-11 md:w-11 md:translate-y-0 md:rounded-xl md:shadow-none"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <div>
            <label htmlFor="flight-to" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              To
            </label>
            <FlightPlaceInput value={to} onChange={setTo} placeholder="City or airport" inputClassName={inputClass} userId={userId} />
          </div>
        </div>

        {tripType === "multicity" ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional flights</p>
            {extraLegs.map((leg, idx) => (
              <div
                key={idx}
                className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 md:grid-cols-[1fr_1fr_180px_auto] md:items-end"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Flight {idx + 2} from</label>
                  <FlightPlaceInput
                    value={leg.from}
                    onChange={(val) => {
                      const updated = [...extraLegs];
                      updated[idx].from = val;
                      setExtraLegs(updated);
                    }}
                    placeholder="City or airport"
                    inputClassName={inputClass}
                    userId={userId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Flight {idx + 2} to</label>
                  <FlightPlaceInput
                    value={leg.to}
                    onChange={(val) => {
                      const updated = [...extraLegs];
                      updated[idx].to = val;
                      setExtraLegs(updated);
                    }}
                    placeholder="City or airport"
                    inputClassName={inputClass}
                    userId={userId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
                  <FlightDateField
                    value={leg.date}
                    min={departDate || minDate}
                    onChange={(next) => {
                      const updated = [...extraLegs];
                      updated[idx].date = next;
                      setExtraLegs(updated);
                    }}
                    triggerClassName={inputClass}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setExtraLegs(extraLegs.filter((_, legIndex) => legIndex !== idx))}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50"
                    aria-label={`Remove flight ${idx + 2}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addLeg}
              disabled={1 + extraLegs.length >= MAX_MULTI_CITY_LEGS}
              className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-bold text-teal-700 hover:text-teal-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add flight
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end lg:flex-nowrap">
          <div className="min-w-0 md:flex-1 md:basis-[140px] lg:max-w-[200px]">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              {tripType === "multicity" ? "Flight 1 depart" : "Depart"}
            </label>
            <FlightDateField
              id="flight-depart-date"
              value={departDate}
              min={minDate}
              onChange={handleDepartChange}
              menuPlacement="above"
              triggerClassName={rowFieldClass}
            />
          </div>

          {tripType === "roundtrip" ? (
            <div className="min-w-0 md:flex-1 md:basis-[140px] lg:max-w-[200px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Return
              </label>
              <FlightDateField
                id="flight-return-date"
                value={returnDate}
                min={departDate || minDate}
                onChange={setReturnDate}
                placeholder="mm/dd/yyyy"
                allowClear
                menuPlacement="above"
                triggerClassName={rowFieldClass}
              />
            </div>
          ) : null}

          <div className="min-w-0 md:flex-1 md:basis-[160px] lg:max-w-[240px]">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Travelers and cabin
            </label>
            <TravelerCabinPicker
              adults={adults}
              childCount={children}
              infants={infants}
              cabin={cabin}
              triggerClassName={rowFieldClass}
              menuPlacement="above"
              onChange={({ adults: a, children: c, infants: i, cabin: cb }) => {
                setAdults(a);
                setChildren(c);
                setInfants(i);
                setCabin(cb);
              }}
            />
          </div>

          <div className="md:shrink-0">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400 md:w-auto md:min-w-[160px]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search flights
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            aria-expanded={showAdvanced}
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-teal-600" />
              Advanced options
              {advancedCount > 0 ? (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                  {advancedCount} selected
                </span>
              ) : null}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced ? (
            <div className="mt-3 grid gap-3 rounded-xl bg-slate-50/80 p-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Outbound departure window
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={departureTimeFrom}
                    onChange={(e) => setDepartureTimeFrom(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="time"
                    value={departureTimeTo}
                    onChange={(e) => setDepartureTimeTo(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3 text-xs font-medium text-slate-600">
                <label className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={nonstop}
                    onChange={(e) => {
                      setNonstop(e.target.checked);
                      if (e.target.checked) setMaximumConnections(0);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Direct flights only</span>
                </label>
                {!nonstop ? (
                  <label className="flex min-h-11 items-center gap-2">
                    <span className="shrink-0">Maximum connections</span>
                    <select
                      value={maximumConnections}
                      onChange={(e) => setMaximumConnections(Number.parseInt(e.target.value, 10))}
                      className={inputClass}
                    >
                      <option value={0}>0 (direct)</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {errorBanner ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {errorBanner}
        </div>
      ) : null}
    </div>
  );
}
