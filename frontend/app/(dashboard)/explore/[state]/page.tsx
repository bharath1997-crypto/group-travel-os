import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExploreDirectorySearch } from "../components/ExploreDirectorySearch";
import { ExploreDirectoryWikipedia } from "../components/ExploreDirectoryWikipedia";
import { fetchDirectoryState } from "../explore-directory-api";
import styles from "../explore.module.css";

export const revalidate = 14400;

type PageProps = { params: Promise<{ state: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state } = await params;
  const data = await fetchDirectoryState(state);
  if (!data) return { title: "State · Rovvy Explore" };
  return {
    title: `${data.name} · Rovvy Explore`,
    robots: data.indexable ? undefined : { index: false, follow: true },
  };
}

export default async function ExploreStateDirectoryPage({ params }: PageProps) {
  const { state } = await params;
  const data = await fetchDirectoryState(state);
  if (!data) notFound();

  return (
    <div className={styles.page}>
      <main className={styles.directoryPage}>
        <header className={styles.directoryHeader}>
          <Link href="/explore" className={styles.destinationsBackLink}>
            ← Explore hub
          </Link>
          <h1>{data.name}</h1>
          {data.population != null ? (
            <p className={styles.directoryMeta}>Population (Census places): {data.population.toLocaleString()}</p>
          ) : null}
          <p className={styles.directoryMeta}>
            {data.event_count > 0
              ? `${data.event_count} upcoming events in indexed cities`
              : "No statewide events indexed yet"}
          </p>
        </header>

        <ExploreDirectorySearch />

        <ExploreDirectoryWikipedia block={data.wikipedia} />

        <section className={styles.directorySection}>
          <h2>Cities</h2>
          <ul className={styles.directoryCityList}>
            {data.cities.map((city) => (
              <li key={city.slug}>
                <Link href={`/explore/${data.slug}/${city.slug}`}>
                  <strong>{city.name}</strong>
                  <span>
                    {city.event_count > 0 ? `${city.event_count} events` : "No events yet"}
                    {city.population != null ? ` · pop. ${city.population.toLocaleString()}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className={styles.directoryFooter}>
          <small>City list: US Census places (population ≥ 10,000). Event counts from live Scaper inventory.</small>
        </footer>
      </main>
    </div>
  );
}
