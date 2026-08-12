"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FlightCabin } from "@/lib/flight-types";
import { CABIN_LABELS } from "@/lib/flight-types";

type TravelerState = {
  adults: number;
  children: number;
  infants: number;
  cabin: FlightCabin;
};

type Props = {
  adults: number;
  childCount: number;
  infants: number;
  cabin: FlightCabin;
  onChange: (next: TravelerState) => void;
  triggerClassName?: string;
  menuPlacement?: "above" | "below";
};

export default function TravelerCabinPicker({
  adults,
  childCount,
  infants,
  cabin,
  onChange,
  triggerClassName,
  menuPlacement = "below",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const total = adults + childCount + infants;
  const label = `${total} · ${CABIN_LABELS[cabin]}`;

  const patch = (partial: Partial<TravelerState>) =>
    onChange({ adults, children: childCount, infants, cabin, ...partial });

  const stepper = (
    key: "adults" | "children" | "infants",
    value: number,
    min: number,
    max: number,
    title: string,
    hint: string,
  ) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => patch({ [key]: value - 1 } as Partial<TravelerState>)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold">{value}</span>
        <button
          type="button"
          disabled={total >= 9 || value >= max}
          onClick={() => patch({ [key]: value + 1 } as Partial<TravelerState>)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName
            ? `flex w-full items-center justify-between text-left ${triggerClassName}`
            : "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 z-30 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ${
            menuPlacement === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {stepper("adults", adults, 1, 9, "Adults", "12+ years")}
          {stepper("children", childCount, 0, 8, "Children", "2–11 years")}
          {stepper("infants", infants, 0, 4, "Infants", "Under 2, on lap")}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cabin</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CABIN_LABELS) as FlightCabin[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChange({ adults, children: childCount, infants, cabin: code })}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    cabin === code ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {CABIN_LABELS[code]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 w-full rounded-xl bg-teal-600 py-2 text-sm font-bold text-white"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
