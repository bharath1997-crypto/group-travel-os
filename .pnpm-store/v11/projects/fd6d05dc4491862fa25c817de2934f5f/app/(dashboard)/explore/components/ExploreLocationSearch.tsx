"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  liveGeocodingSearch,
  SEARCH_DEBOUNCE_MS,
  type LiveGeocodingSearchResult,
} from "@/app/(dashboard)/live/live-geocoding";
import {
  formatGeocodeResultSubtitle,
  formatGeocodeResultTitle,
} from "../explore-hero-location";
import { scopeFromGeocode, type ExploreLocationScope } from "../explore-location-scope";
import styles from "../explore.module.css";

type ExploreLocationSearchProps = {
  onSelect: (scope: ExploreLocationScope) => void;
  activeLabel?: string | null;
};

export function ExploreLocationSearch({ onSelect, activeLabel }: ExploreLocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LiveGeocodingSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      void liveGeocodingSearch(trimmed)
        .then((rows) => setResults(rows.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className={styles.locationSearchBlock}>
      <label htmlFor="explore-refine-location">Country, state, or city</label>
      <div className={styles.citySearchField}>
        <Search size={16} />
        <input
          id="explore-refine-location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. Illinois, Japan, Paris, Austin TX"
          autoComplete="off"
          inputMode="search"
        />
      </div>
      {activeLabel ? (
        <p>
          Showing listings for <strong>{activeLabel}</strong>
        </p>
      ) : (
        <p>Type a country, state/province, city, or city + state — worldwide.</p>
      )}
      {searching ? <p>Searching…</p> : null}
      {results.length > 0 ? (
        <div className={`${styles.cityResults} ${styles.geocodeResults}`}>
          {results.map((result) => (
            <button
              type="button"
              key={`${result.place_id}-${result.lat}-${result.lon}`}
              onClick={() => {
                onSelect(scopeFromGeocode(result));
                setQuery("");
                setResults([]);
              }}
            >
              <span>{formatGeocodeResultTitle(result)}</span>
              <small>{formatGeocodeResultSubtitle(result)}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
