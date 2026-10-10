"use client";

import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  liveGeocodingSearch,
  SEARCH_DEBOUNCE_MS,
  type LiveGeocodingSearchResult,
} from "@/app/(dashboard)/live/live-geocoding";
import { keepIpHeroAfterGeolocationDenied, unknownHero, type HeroResponse } from "@/lib/hero-location";
import {
  cityFromGeocodeAddress,
  formatGeocodeResultSubtitle,
  formatGeocodeResultTitle,
  readBrowserGeolocation,
} from "./explore-hero-location";
import {
  formatExploreHeroListingCountLine,
  type ExploreHeroListingCountState,
} from "./explore-hero-listing-count";
import { exploreLocationScopeFromHero } from "./explore-hero-scope";
import type { ExploreLocationScope } from "./explore-location-scope";
import styles from "./explore.module.css";

type HeroLocationWidgetProps = {
  currentCity: string;
  signedIn: boolean;
  listingCountState: ExploreHeroListingCountState;
  onCityChange: (city: string) => void;
  onLocationScope?: (scope: ExploreLocationScope) => void;
};

const CITY_COLOURS: Record<string, string> = {
  chicago: "#2A3A34",
  "new york": "#263744",
  "los angeles": "#4A3A2E",
  miami: "#24474A",
  austin: "#34422D",
  "new orleans": "#49322F",
  denver: "#344653",
  london: "#384247",
  paris: "#4B3E42",
  tokyo: "#3A3347",
};

function fallbackColour(city: string): string {
  return CITY_COLOURS[city.trim().toLowerCase()] ?? "#2A3A34";
}

async function requestHero(coordinates?: { lat: number; lon: number }, signal?: AbortSignal): Promise<HeroResponse> {
  const query = coordinates ? `?lat=${encodeURIComponent(coordinates.lat)}&lon=${encodeURIComponent(coordinates.lon)}` : "";
  const response = await fetch(`/api/hero${query}`, { signal, cache: "no-store" });
  return (await response.json()) as HeroResponse;
}

export function HeroLocationWidget({
  currentCity,
  signedIn,
  listingCountState,
  onCityChange,
  onLocationScope,
}: HeroLocationWidgetProps) {
  const [hero, setHero] = useState<HeroResponse | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LiveGeocodingSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [autoLocated, setAutoLocated] = useState(false);
  const [searchBias, setSearchBias] = useState<{ lat: number; lng: number } | null>(null);

  const publishScope = useCallback(
    (value: HeroResponse, coords?: { lat: number; lon: number } | null) => {
      if (!onLocationScope) return;
      onLocationScope(exploreLocationScopeFromHero(value, coords ?? lastCoordsRef.current));
    },
    [onLocationScope],
  );

  const applyHero = useCallback(
    (value: HeroResponse, coords?: { lat: number; lon: number } | null) => {
      setHero(value);
      publishScope(value, coords);
    },
    [publishScope],
  );

  const loadHeroAt = useCallback(
    async (coordinates?: { lat: number; lon: number }, signal?: AbortSignal) => {
      if (coordinates) {
        lastCoordsRef.current = coordinates;
        setSearchBias({ lat: coordinates.lat, lng: coordinates.lon });
      }
      const value = await requestHero(coordinates, signal);
      applyHero(value, coordinates ?? null);
      return value;
    },
    [applyHero],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    const loadIpFallback = () => {
      loadHeroAt(undefined, controller.signal)
        .catch(() => undefined)
        .finally(finish);
    };

    void (async () => {
      const coords = await readBrowserGeolocation();
      if (cancelled) return;
      if (coords) {
        setAutoLocated(true);
        try {
          await loadHeroAt(coords, controller.signal);
        } catch {
          loadIpFallback();
          return;
        }
        finish();
        return;
      }
      loadIpFallback();
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadHeroAt]);

  useEffect(() => {
    if (!sheetOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) {
      setLocationQuery("");
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const query = locationQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      void liveGeocodingSearch(query, searchBias)
        .then((results) => {
          setSearchResults(results.slice(0, 6));
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [locationQuery, searchBias, sheetOpen]);

  const useExactLocation = () => {
    setLocating(true);
    void readBrowserGeolocation({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }).then((coords) => {
      if (!coords) {
        setHero((current) => keepIpHeroAfterGeolocationDenied(current));
        setLocating(false);
        return;
      }

      setImageReady(false);
      loadHeroAt(coords)
        .then(() => {
          setAutoLocated(true);
          setSheetOpen(false);
        })
        .catch(() => undefined)
        .finally(() => setLocating(false));
    });
  };

  const pickGeocodeResult = (result: LiveGeocodingSearchResult) => {
    const lat = Number.parseFloat(result.lat);
    const lon = Number.parseFloat(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    setLoading(true);
    setImageReady(false);
    setLocationQuery("");
    setSearchResults([]);

    setSearchBias({ lat, lng: lon });
    requestHero({ lat, lon })
      .then((value) => {
        const city = value.city ?? cityFromGeocodeAddress(result.address) ?? formatGeocodeResultTitle(result);
        lastCoordsRef.current = { lat, lon };
        applyHero(
          {
            ...value,
            city,
            placeLabel: value.placeLabel ?? formatGeocodeResultTitle(result),
          },
          { lat, lon },
        );
        setSheetOpen(false);
      })
      .catch(() =>
        setHero((current) => ({
          ...(current ?? unknownHero()),
          placeLabel: formatGeocodeResultTitle(result),
          city: cityFromGeocodeAddress(result.address) ?? formatGeocodeResultTitle(result),
          precision: null,
          precisionNote: null,
          dominantColor: fallbackColour(formatGeocodeResultTitle(result)),
        })),
      )
      .finally(() => setLoading(false));
  };

  const place = hero?.placeLabel ?? hero?.city ?? currentCity;
  const background = hero?.dominantColor ?? fallbackColour(currentCity);
  const approximate = hero?.precision === "ip";
  const weather = hero?.weather;
  const usingAutoLocation = autoLocated || hero?.precision === "gps";

  return (
    <>
      <div className={styles.heroBackdrop} style={{ backgroundColor: background }} aria-hidden="true">
        {hero?.photo?.url ? (
          // A raw image is required here because the geo-verified source URL is selected at request time.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.photo.url}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className={imageReady ? styles.heroPhotoReady : ""}
            onLoad={() => setImageReady(true)}
          />
        ) : null}
        <div className={styles.heroScrim} />
      </div>

      {hero?.photo?.credit && hero.photo.creditUrl ? (
        <a className={styles.photoCredit} href={hero.photo.creditUrl} target="_blank" rel="noreferrer">
          {hero.photo.credit}
        </a>
      ) : null}

      <button
        type="button"
        className={`${styles.locationCard} ${loading ? styles.locationCardLoading : ""}`}
        onClick={() => setSheetOpen(true)}
        aria-label={`Location: ${place}. Change location`}
      >
        {loading ? (
          <span className={styles.locationSkeleton} aria-label="Finding your location" />
        ) : (
          <>
            <strong>
              <MapPin size={14} />
              {place}{approximate ? " · approximate" : ""}
            </strong>
            {weather ? (
              <span>
                {weather.tempC !== null ? `${Math.round(weather.tempC)}°` : null}
                {weather.tempC !== null && weather.phrase ? " · " : null}
                {weather.phrase}
              </span>
            ) : (
              <span>Weather unavailable</span>
            )}
            {hero?.distanceMiles !== null && hero?.distanceMiles !== undefined && hero.distanceMiles > 10 && hero.precisionNote ? (
              <small>{hero.precisionNote}</small>
            ) : null}
            <small>{formatExploreHeroListingCountLine(listingCountState)}</small>
          </>
        )}
      </button>

      {sheetOpen ? (
        <div
          className={styles.locationSheetBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSheetOpen(false);
          }}
        >
          <section className={styles.locationSheet} role="dialog" aria-modal="true" aria-labelledby="location-sheet-title">
            <header>
              <div>
                <small>YOUR EXPLORE LOCATION</small>
                <h2 id="location-sheet-title">Where should Rovvy look?</h2>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close location options">
                <X size={18} />
              </button>
            </header>

            <p className={styles.locationPromise}>
              {usingAutoLocation
                ? "Using your current location. Search below to pick somewhere else."
                : "We check where you are. We don't keep it."}
            </p>

            <button type="button" className={styles.exactLocationButton} onClick={useExactLocation} disabled={locating}>
              <LocateFixed size={18} />
              <span>
                <b>{locating ? "Checking your location…" : "Use my exact location"}</b>
                <small>No sign-in required</small>
              </span>
            </button>

            <div className={styles.citySearchBlock}>
              <label htmlFor="hero-location-search">Or search another place</label>
              <div className={styles.citySearchField}>
                <Search size={16} />
                <input
                  id="hero-location-search"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Postcode, city, or neighbourhood — anywhere"
                  autoComplete="off"
                  inputMode="search"
                />
              </div>
              <p>
                {searching
                  ? "Searching worldwide…"
                  : signedIn
                    ? "We'll remember your pick on this device."
                    : "Any city or postal code worldwide — no sign-in required."}
              </p>
              {searchResults.length > 0 ? (
                <div className={`${styles.cityResults} ${styles.geocodeResults}`}>
                  {searchResults.map((result) => (
                    <button type="button" key={`${result.place_id}-${result.lat}-${result.lon}`} onClick={() => pickGeocodeResult(result)}>
                      <span>{formatGeocodeResultTitle(result)}</span>
                      <small>{formatGeocodeResultSubtitle(result)}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {!searching && locationQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <p>No matches for that place yet. Try a nearby city or full postal code.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
