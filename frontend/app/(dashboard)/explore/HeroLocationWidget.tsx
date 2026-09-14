"use client";

import Link from "next/link";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { keepIpHeroAfterGeolocationDenied, unknownHero, type HeroResponse } from "@/lib/hero-location";
import styles from "./explore.module.css";

type HeroLocationWidgetProps = {
  currentCity: string;
  signedIn: boolean;
  slotsLive: number | null;
  onCityChange: (city: string) => void;
};

const CITY_OPTIONS = [
  { city: "Chicago", region: "IL", lat: 41.8781, lon: -87.6298 },
  { city: "New York", region: "NY", lat: 40.7128, lon: -74.006 },
  { city: "Los Angeles", region: "CA", lat: 34.0522, lon: -118.2437 },
  { city: "Miami", region: "FL", lat: 25.7617, lon: -80.1918 },
  { city: "Austin", region: "TX", lat: 30.2672, lon: -97.7431 },
  { city: "New Orleans", region: "LA", lat: 29.9511, lon: -90.0715 },
  { city: "Denver", region: "CO", lat: 39.7392, lon: -104.9903 },
  { city: "London", region: "UK", lat: 51.5072, lon: -0.1276 },
  { city: "Paris", region: "FR", lat: 48.8566, lon: 2.3522 },
  { city: "Tokyo", region: "JP", lat: 35.6762, lon: 139.6503 },
] as const;

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

export function HeroLocationWidget({ currentCity, signedIn, slotsLive, onCityChange }: HeroLocationWidgetProps) {
  const [hero, setHero] = useState<HeroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requestHero(undefined, controller.signal)
      .then((value) => {
        setHero(value);
        if (value.city) onCityChange(value.city);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [onCityChange]);

  useEffect(() => {
    if (!sheetOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sheetOpen]);

  const visibleCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    return CITY_OPTIONS.filter((option) => !query || `${option.city} ${option.region}`.toLowerCase().includes(query)).slice(0, 5);
  }, [citySearch]);

  const useExactLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        requestHero({ lat: coords.latitude, lon: coords.longitude })
          .then((value) => {
            setImageReady(false);
            setHero(value);
            if (value.city) onCityChange(value.city);
            setSheetOpen(false);
          })
          .catch(() => undefined)
          .finally(() => setLocating(false));
      },
      () => {
        setHero((current) => keepIpHeroAfterGeolocationDenied(current));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  };

  const browseCity = (option: (typeof CITY_OPTIONS)[number]) => {
    onCityChange(option.city);
    setCitySearch("");
    setLoading(true);
    setImageReady(false);
    requestHero({ lat: option.lat, lon: option.lon })
      .then((value) =>
        setHero({
          ...value,
          placeLabel: option.city,
          city: option.city,
          region: option.region,
          precision: null,
          precisionNote: null,
        }),
      )
      .catch(() =>
        setHero((current) => ({
          ...(current ?? unknownHero()),
          placeLabel: option.city,
          city: option.city,
          region: option.region,
          precision: null,
          precisionNote: null,
          weather: null,
          photo: null,
          dominantColor: fallbackColour(option.city),
        })),
      )
      .finally(() => {
        setLoading(false);
        setSheetOpen(false);
      });
  };

  const place = hero?.placeLabel ?? hero?.city ?? currentCity;
  const background = hero?.dominantColor ?? fallbackColour(currentCity);
  const approximate = hero?.precision === "ip";
  const weather = hero?.weather;

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
          <span className={styles.locationSkeleton} aria-label="Finding your approximate location" />
        ) : (
          <>
            <strong>
              <MapPin size={14} />
              {place}{approximate ? " · approximate" : ""}
            </strong>
            {weather ? (
              <span>{weather.tempC !== null ? `${Math.round(weather.tempC)}°` : null}{weather.tempC !== null && weather.phrase ? " · " : null}{weather.phrase}</span>
            ) : (
              <span>Weather unavailable</span>
            )}
            {hero?.distanceMiles !== null && hero?.distanceMiles !== undefined && hero.distanceMiles > 10 && hero.precisionNote ? (
              <small>{hero.precisionNote}</small>
            ) : null}
            <small>{slotsLive === null ? "Checking live inventory" : `${slotsLive} slots live`}</small>
          </>
        )}
      </button>

      {sheetOpen ? (
        <div className={styles.locationSheetBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSheetOpen(false);
        }}>
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

            <p className={styles.locationPromise}>We check where you are. We don&apos;t keep it.</p>

            <button type="button" className={styles.exactLocationButton} onClick={useExactLocation} disabled={locating}>
              <LocateFixed size={18} />
              <span>
                <b>{locating ? "Checking your location…" : "Use my exact location"}</b>
                <small>No sign-in required</small>
              </span>
            </button>

            <div className={styles.citySearchBlock}>
              <label htmlFor="hero-city-search">Browse another city</label>
              <div className={styles.citySearchField} aria-disabled={!signedIn}>
                <Search size={16} />
                <input
                  id="hero-city-search"
                  value={citySearch}
                  onChange={(event) => setCitySearch(event.target.value)}
                  placeholder="Search cities"
                  disabled={!signedIn}
                />
              </div>
              {!signedIn ? (
                <p>
                  <Link href="/login?next=%2Fexplore">Sign in</Link> to browse another city — we&apos;ll remember it.
                </p>
              ) : (
                <div className={styles.cityResults}>
                  {visibleCities.map((option) => (
                    <button type="button" key={option.city} onClick={() => browseCity(option)}>
                      <span>{option.city}</span>
                      <small>{option.region}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
