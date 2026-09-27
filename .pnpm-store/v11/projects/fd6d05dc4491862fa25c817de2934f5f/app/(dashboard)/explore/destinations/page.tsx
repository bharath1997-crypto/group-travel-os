"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ExploreReelPlaceCard } from "../components/ExploreReelPlaceCard";
import {
  citiesForCountrySelection,
  countriesForContinent,
  EXPLORE_CONTINENT_TABS,
} from "../explore-location-catalog";
import styles from "../explore.module.css";

export default function ExploreDestinationsPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <main className={styles.destinationsDirectory}>
        <header className={styles.destinationsDirectoryHeader}>
          <div>
            <small>Worldwide</small>
            <h1>All countries & regions</h1>
            <p>
              Browse by country first, then state or city. Pick any row to load Explore listings for that place.
            </p>
          </div>
          <Link href="/explore" className={styles.destinationsBackLink}>
            ← Back to Explore
          </Link>
        </header>

        {EXPLORE_CONTINENT_TABS.map((continent) => (
          <section key={continent.id} className={styles.destinationsDirectorySection}>
            <header>
              <h2>{continent.label}</h2>
              <span>{countriesForContinent(continent.id).length} countries</span>
            </header>
            <div className={styles.destinationsDirectoryGrid}>
              {countriesForContinent(continent.id).map((country) => (
                <ExploreReelPlaceCard
                  key={country.id}
                  place={{
                    id: country.id,
                    name: country.name,
                    meta: country.states
                      ? `${country.states.length} states · drill down to cities`
                      : `${country.cities?.length ?? 0} cities`,
                    social: country.social,
                  }}
                  onPick={() =>
                    router.push(
                      `/explore?city=${encodeURIComponent(country.hubCity)}&country=${encodeURIComponent(country.name)}`,
                    )
                  }
                />
              ))}
            </div>
            <div className={styles.destinationsDirectorySubgrid}>
              {countriesForContinent(continent.id).flatMap((country) =>
                citiesForCountrySelection(country.id, null).map((city) => (
                  <button
                    type="button"
                    key={`${country.id}-${city.id}`}
                    className={styles.destinationsCityLink}
                    onClick={() => router.push(`/explore?city=${encodeURIComponent(city.name)}`)}
                  >
                    {city.name} · {country.name}
                  </button>
                )),
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
