import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExploreDirectoryWikipedia } from "../../components/ExploreDirectoryWikipedia";
import { ExploreDirectoryCityFeed } from "../../components/ExploreDirectoryCityFeed";
import { fetchDirectoryCity } from "../../explore-directory-api";
import styles from "../../explore.module.css";

export const revalidate = 14400;

type PageProps = { params: Promise<{ state: string; city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state, city } = await params;
  const data = await fetchDirectoryCity(state, city);
  if (!data) return { title: "City · Rovvy Explore" };
  return {
    title: `${data.name}, ${data.state_name} · Rovvy Explore`,
    robots: data.indexable ? undefined : { index: false, follow: true },
  };
}

export default async function ExploreCityDirectoryPage({ params }: PageProps) {
  const { state, city } = await params;
  const data = await fetchDirectoryCity(state, city);
  if (!data) notFound();

  const mapsUrl =
    data.lat != null && data.lng != null
      ? `https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${data.lat},${data.lng}`)}`
      : null;

  return (
    <div className={styles.page}>
      <main className={styles.directoryPage}>
        <header className={styles.directoryHeader}>
          <Link href={`/explore/${data.state_slug}`} className={styles.destinationsBackLink}>
            ← Back to {data.state_name}
          </Link>
          <h1>
            {data.name}, {data.state_name}
          </h1>
          {data.population != null ? (
            <p className={styles.directoryMeta}>Population: {data.population.toLocaleString()}</p>
          ) : null}
        </header>

        <ExploreDirectoryWikipedia block={data.wikipedia} />

        {data.event_count > 0 ? (
          <ExploreDirectoryCityFeed citySlug={data.slug} cityLabel={data.name} />
        ) : (
          <section className={styles.directorySection} role="status">
            <h2>Events</h2>
            <p>No events listed yet for {data.name}.</p>
            {data.nearest_with_events ? (
              <p>
                Nearest city with events:{" "}
                <Link href={`/explore/${data.nearest_with_events.state_slug}/${data.nearest_with_events.slug}`}>
                  {data.nearest_with_events.name}
                </Link>
                {data.nearest_with_events.distance_miles != null
                  ? ` (${data.nearest_with_events.distance_miles} mi away)`
                  : null}
              </p>
            ) : null}
          </section>
        )}

        {data.place_count > 0 ? (
          <section className={styles.directorySection}>
            <h2>Parks & places</h2>
            <p>{data.place_count} places near {data.name} in our Overture/OSM spine.</p>
            <Link href={`/explore?city=${encodeURIComponent(data.name)}`}>Open Explore hub for this city</Link>
          </section>
        ) : null}

        {mapsUrl ? (
          <section className={styles.directorySection}>
            <h2>Directions</h2>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.directoryDirections}>
              Open directions to {data.name}
            </a>
          </section>
        ) : null}

        <footer className={styles.directoryFooter}>
          <small>US Census · Wikidata (CC0) where noted · OpenStreetMap/Overture place credits on listings.</small>
        </footer>
      </main>
    </div>
  );
}
