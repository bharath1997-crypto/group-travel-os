"use client";

import dynamic from "next/dynamic";
import { LocateFixed, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  liveGeocodingSearch,
  SEARCH_DEBOUNCE_MS,
  type LiveGeocodingSearchResult,
} from "@/app/(dashboard)/live/live-geocoding";
import {
  formatGeocodeResultSubtitle,
  formatGeocodeResultTitle,
  readBrowserGeolocation,
} from "@/app/(dashboard)/explore/explore-hero-location";
import { loadSeatsMapPickModalModule } from "./seats-page-loader";
import { readCountryCodeFromAddress } from "./seats-currency";
import {
  locationPointDraft,
  PROMPT_FROM,
  PROMPT_TO,
  withResolvedCountryCode,
  type LocationPoint,
} from "./seats-location";
import styles from "./seats.module.css";

const SeatsMapPickModal = dynamic(
  () => loadSeatsMapPickModalModule().then((m) => m.SeatsMapPickModal),
  { ssr: false },
);

type FieldTarget = "from" | "to";

function locationFromSearchResult(r: LiveGeocodingSearchResult): LocationPoint {
  return withResolvedCountryCode({
    address: formatGeocodeResultTitle(r),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    isConfirmed: true,
    source: "autocomplete",
    countryCode: readCountryCodeFromAddress(r.address),
    osmClass: r.class ?? null,
    osmType: r.type ?? null,
  });
}

function LocationField({
  id,
  label,
  place,
  onChange,
  onPickMap,
  onGpsClick,
  bias,
  fieldClassName,
}: {
  id: FieldTarget;
  label: string;
  place: LocationPoint;
  onChange: (p: LocationPoint) => void;
  onPickMap: () => void;
  onGpsClick?: () => void;
  bias?: { lat: number; lng: number };
  fieldClassName?: string;
}) {
  const [query, setQuery] = useState(place.address);
  const [hits, setHits] = useState<LiveGeocodingSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(place.address);
  }, [place.address]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const rows = await liveGeocodingSearch(query.trim(), bias ? { lat: bias.lat, lng: bias.lng } : null);
        setHits(rows.slice(0, 6));
      } catch {
        setHits([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query, open, bias]);

  async function handleGpsClick() {
    if (!onGpsClick) return;
    setLocating(true);
    try {
      await onGpsClick();
    } finally {
      setLocating(false);
    }
  }

  const fieldClass = fieldClassName ?? styles.searchField;

  return (
    <div className={fieldClass}>
      <span className={`${styles.searchLabel} ${styles.mono}`}>{label}</span>
      <div className={styles.locationInputWrap}>
        <input
          className={styles.searchValue}
          value={query}
          placeholder={id === "from" ? "Choose starting point" : "Destination"}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            onChange(
              locationPointDraft({
                address: value,
                lat: place.lat,
                lng: place.lng,
                isConfirmed: false,
                source: "default",
              }),
            );
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          autoComplete="off"
        />
        <div className={styles.locationActions}>
          {onGpsClick ? (
            <button
              type="button"
              className={styles.iconBtn}
              title="Use my live location"
              aria-label="Use my live location"
              disabled={locating}
              onClick={() => void handleGpsClick()}
            >
              <LocateFixed size={16} strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconBtn}
            title="Pick on map"
            aria-label="Pick on map"
            onClick={onPickMap}
          >
            <MapPin size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      {open && hits.length > 0 ? (
        <ul className={styles.suggestList}>
          {hits.map((h) => (
            <li key={h.place_id}>
              <button
                type="button"
                className={styles.suggestItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const p = locationFromSearchResult(h);
                  onChange(p);
                  setQuery(p.address);
                  setOpen(false);
                }}
              >
                <strong>{formatGeocodeResultTitle(h)}</strong>
                <span>{formatGeocodeResultSubtitle(h)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Props = {
  from: LocationPoint;
  to: LocationPoint;
  onFromChange: (p: LocationPoint) => void;
  onToChange: (p: LocationPoint) => void;
  layout?: "search" | "wizard";
};

export function SeatsLocationPicker({ from, to, onFromChange, onToChange, layout = "search" }: Props) {
  const [mapTarget, setMapTarget] = useState<FieldTarget | null>(null);
  const [gpsSeed, setGpsSeed] = useState<{ lat: number; lng: number } | null>(null);
  const [mapConfirmSource, setMapConfirmSource] = useState<"map_pin" | "gps_confirmed">("map_pin");

  const openMapFor = useCallback((target: FieldTarget, source: "map_pin" | "gps_confirmed") => {
    setGpsSeed(null);
    setMapConfirmSource(source);
    setMapTarget(target);
  }, []);

  const openGpsConfirm = useCallback(async (target: FieldTarget) => {
    const coords = await readBrowserGeolocation();
    if (!coords) return;
    setGpsSeed({ lat: coords.lat, lng: coords.lon });
    setMapConfirmSource("gps_confirmed");
    setMapTarget(target);
  }, []);

  const closeMap = useCallback(() => {
    setMapTarget(null);
    setGpsSeed(null);
  }, []);

  const fieldClass = layout === "wizard" ? styles.field : styles.searchField;

  return (
    <>
      <LocationField
        id="from"
        label="From"
        place={from}
        onChange={onFromChange}
        onPickMap={() => openMapFor("from", "map_pin")}
        onGpsClick={() => void openGpsConfirm("from")}
        bias={{ lat: from.lat, lng: from.lng }}
        fieldClassName={fieldClass}
      />
      <LocationField
        id="to"
        label="To"
        place={to}
        onChange={onToChange}
        onPickMap={() => openMapFor("to", "map_pin")}
        onGpsClick={() => void openGpsConfirm("to")}
        bias={{ lat: from.lat, lng: from.lng }}
        fieldClassName={fieldClass}
      />

      <SeatsMapPickModal
        open={mapTarget !== null}
        pickTarget={mapTarget ?? "from"}
        radiusAnchor={from}
        otherEndpoint={mapTarget === "from" ? to : from}
        title={
          mapTarget === "from" && mapConfirmSource === "gps_confirmed"
            ? "Confirm your pickup point"
            : mapTarget === "to" && mapConfirmSource === "gps_confirmed"
              ? "Confirm your drop-off point"
              : mapTarget === "from"
                ? "Pick starting point"
                : "Pick destination"
        }
        initial={mapTarget === "from" ? from : mapTarget === "to" ? to : null}
        gpsSeed={gpsSeed}
        confirmSource={mapConfirmSource}
        confirmLabel={
          mapTarget === "from" && mapConfirmSource === "gps_confirmed"
            ? "Confirm this pickup point"
            : mapTarget === "to" && mapConfirmSource === "gps_confirmed"
              ? "Confirm this drop-off point"
              : "Use this location"
        }
        onClose={closeMap}
        onConfirm={(p) => {
          if (mapTarget === "from") onFromChange(p);
          if (mapTarget === "to") onToChange(p);
        }}
      />
    </>
  );
}

export { PROMPT_FROM, PROMPT_TO };
