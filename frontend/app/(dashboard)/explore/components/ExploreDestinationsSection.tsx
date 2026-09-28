"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { EXPLORE_CITY } from "../explore-fixtures";
import {
  citiesForCountrySelection,
  continentHeadline,
  countriesForContinent,
  EXPLORE_CONTINENT_TABS,
  findCountry,
  type CatalogCountry,
  type ExploreContinentId,
} from "../explore-location-catalog";
import { scopeFromCatalogSelection, type ExploreLocationScope } from "../explore-location-scope";
import styles from "../explore.module.css";
import { ExploreFilterChip } from "./ExploreFilterChip";
import { ExploreReelPlaceCard } from "./ExploreReelPlaceCard";

type BrowseMode = "countries" | "cities";

type ExploreDestinationsSectionProps = {
  onApplyScope: (scope: ExploreLocationScope) => void;
  activeScopeLabel: string | null;
  onResetCity: () => void;
};

export function ExploreDestinationsSection({
  onApplyScope,
  activeScopeLabel,
  onResetCity,
}: ExploreDestinationsSectionProps) {
  const [continentId, setContinentId] = useState<ExploreContinentId>("americas");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("countries");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  const countries = useMemo(() => countriesForContinent(continentId), [continentId]);
  const country = findCountry(countryId);

  const scrollReel = useCallback((direction: -1 | 1) => {
    const node = reelRef.current;
    if (!node) return;
    const step = Math.min(420, node.clientWidth * 0.85);
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  const applyCountry = (next: CatalogCountry) => {
    setCountryId(next.id);
    setStateId(null);
    setBrowseMode("cities");
    onApplyScope(
      scopeFromCatalogSelection({
        countryName: next.name,
        fetchCity: next.hubCity,
        lat: next.lat,
        lon: next.lon,
      }),
    );
  };

  const applyState = (stateIdValue: string) => {
    if (!country?.states) return;
    const state = country.states.find((s) => s.id === stateIdValue);
    if (!state) return;
    setStateId(stateIdValue);
    onApplyScope(
      scopeFromCatalogSelection({
        countryName: country.name,
        stateName: state.name,
        fetchCity: state.hubCity,
        lat: state.lat,
        lon: state.lon,
      }),
    );
  };

  const applyCity = (cityName: string) => {
    if (!country) return;
    const state = country.states?.find((s) => s.id === stateId);
    onApplyScope(
      scopeFromCatalogSelection({
        countryName: country.name,
        stateName: state?.name,
        cityName,
        fetchCity: cityName,
        lat: state?.lat ?? country.lat,
        lon: state?.lon ?? country.lon,
      }),
    );
  };

  const cityCards = useMemo(() => {
    if (!countryId) return [];
    return citiesForCountrySelection(countryId, stateId);
  }, [countryId, stateId]);

  const surprise = () => {
    if (browseMode === "countries") {
      const pick = countries[Math.floor(Math.random() * countries.length)];
      if (pick) applyCountry(pick);
      return;
    }
    if (!cityCards.length) return;
    applyCity(cityCards[Math.floor(Math.random() * cityCards.length)].name);
  };

  return (
    <section className={styles.destinations}>
      <header>
        <div>
          <small>Popular in {continentHeadline(continentId)}</small>
          <h2>Where people are going</h2>
        </div>
        <span className={styles.regionTabRow}>
          {EXPLORE_CONTINENT_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`${styles.regionTab} ${continentId === tab.id ? styles.regionTabActive : ""}`}
              onClick={() => {
                setContinentId(tab.id);
                setCountryId(null);
                setStateId(null);
                setBrowseMode("countries");
              }}
            >
              {tab.label}
            </button>
          ))}
          <Link href="/explore/destinations" className={styles.allCountriesLink}>
            All countries →
          </Link>
        </span>
      </header>

      <div className={styles.destinationsModeRow}>
        <ExploreFilterChip
          label="Countries"
          selected={browseMode === "countries"}
          onToggle={() => setBrowseMode("countries")}
        />
        <ExploreFilterChip
          label="Cities"
          selected={browseMode === "cities"}
          onToggle={() => {
            if (!countryId && countries[0]) applyCountry(countries[0]);
            setBrowseMode("cities");
          }}
        />
        {country && browseMode === "cities" ? (
          <button type="button" className={styles.destinationsBackChip} onClick={() => setBrowseMode("countries")}>
            ← {country.name}
          </button>
        ) : null}
      </div>

      {browseMode === "cities" && country?.states && country.states.length > 0 ? (
        <div className={styles.destinationsStateRow}>
          <small>State / province</small>
          <span>
            <ExploreFilterChip
              label={`All ${country.name}`}
              selected={!stateId}
              onToggle={() => {
                setStateId(null);
                onApplyScope(
                  scopeFromCatalogSelection({
                    countryName: country.name,
                    fetchCity: country.hubCity,
                    lat: country.lat,
                    lon: country.lon,
                  }),
                );
              }}
            />
            {country.states.map((state) => (
              <ExploreFilterChip
                key={state.id}
                label={state.code ? `${state.name} (${state.code})` : state.name}
                selected={stateId === state.id}
                onToggle={() => applyState(state.id)}
              />
            ))}
          </span>
        </div>
      ) : null}

      <div className={styles.reelWrap}>
        <div className={styles.reel} ref={reelRef}>
          {browseMode === "countries"
            ? countries.map((entry) => (
                <ExploreReelPlaceCard
                  key={entry.id}
                  place={{
                    id: entry.id,
                    name: entry.name,
                    meta: entry.states ? `${entry.states.length} states · cities` : `${entry.cities?.length ?? 0} cities`,
                    social: entry.social,
                    badge: entry.id === "us" ? "You're here" : undefined,
                    badgeVariant: entry.id === "us" ? "here" : undefined,
                  }}
                  onPick={() => applyCountry(entry)}
                />
              ))
            : cityCards.map((city) => (
                <ExploreReelPlaceCard
                  key={city.id}
                  place={{
                    id: city.id,
                    name: city.name,
                    meta: city.subtitle,
                    social: "Tap to load listings",
                  }}
                  onPick={() => applyCity(city.name)}
                />
              ))}
          <button type="button" className={styles.surpriseCard} onClick={surprise}>
            <b>
              Surprise
              <br />
              me
            </b>
            <small>Wayra picks a place →</small>
          </button>
        </div>
        <div className={styles.reelControls} aria-label="Scroll destinations">
          <button type="button" className={styles.reelScrollBtn} onClick={() => scrollReel(-1)} aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className={styles.reelScrollBtn} onClick={() => scrollReel(1)} aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {activeScopeLabel && activeScopeLabel !== EXPLORE_CITY ? (
        <div className={styles.cityPickedBanner}>
          <p>
            Showing <strong>{activeScopeLabel}</strong> — feed and filters follow this location.
          </p>
          <button type="button" onClick={onResetCity}>
            Back to Chicago
          </button>
        </div>
      ) : null}
    </section>
  );
}
