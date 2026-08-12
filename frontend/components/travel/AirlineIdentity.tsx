"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import { airlineLogoUrl } from "@/lib/flight-journey-ui";

type Props = {
  airlineCodes: string[];
  primaryName?: string;
  operatingName?: string;
  flightNumber?: string;
  cabinLabel?: string;
  compact?: boolean;
};

export default function AirlineIdentity({
  airlineCodes,
  primaryName,
  operatingName,
  flightNumber,
  cabinLabel,
  compact = false,
}: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const code = airlineCodes[0] || "";
  const logoUrl = logoFailed ? null : airlineLogoUrl(code);
  const label = primaryName || airlineCodes.slice(0, 2).join(", ") || "Airline";
  // Airhex logos are optional third-party artwork; fallback to IATA code is production-safe.

  return (
    <div className={`flex min-w-0 items-center gap-3 ${compact ? "" : "sm:w-52 shrink-0"}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external airline logo with explicit fallback
          <img
            src={logoUrl}
            alt=""
            className="h-full w-full object-contain p-1"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-teal-50 text-xs font-black tracking-tight text-teal-700">
            {code ? code.slice(0, 2) : <Plane className="h-5 w-5" />}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{label}</p>
        <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
          {flightNumber ? <p className="truncate">{flightNumber}</p> : null}
          {operatingName && operatingName !== label ? (
            <p className="truncate">Operated by {operatingName}</p>
          ) : null}
          {cabinLabel ? <p className="truncate capitalize">{cabinLabel.replaceAll("_", " ")}</p> : null}
        </div>
      </div>
    </div>
  );
}
