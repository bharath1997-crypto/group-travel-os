"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { searchDirectory, type DirectorySearchHit } from "../explore-directory-api";
import styles from "../explore.module.css";

export function ExploreDirectorySearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DirectorySearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchDirectory(q)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className={styles.locationSearchBlock}>
      <label htmlFor="explore-directory-search">Search a US state or city</label>
      <div className={styles.citySearchField}>
        <Search size={16} />
        <input
          id="explore-directory-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Illinois, Chicago, Springfield…"
          autoComplete="off"
        />
      </div>
      {loading ? <p>Searching directory…</p> : null}
      {hits.length > 0 ? (
        <div className={`${styles.cityResults} ${styles.geocodeResults}`}>
          {hits.map((hit) => {
            const href =
              hit.kind === "state"
                ? `/explore/${hit.slug}`
                : `/explore/${hit.state_slug}/${hit.slug}`;
            return (
              <Link key={`${hit.kind}-${hit.state_slug}-${hit.slug}`} href={href}>
                <span>{hit.name}</span>
                <small>
                  {hit.kind === "city" ? hit.state_name : "State"}
                  {hit.event_count > 0 ? ` · ${hit.event_count} events` : " · No events yet"}
                </small>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
