"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/safe-fetch";
import styles from "../explore.module.css";

type EventRow = {
  id: string;
  title: string;
  date?: string;
  venue?: string;
  ticket_url?: string | null;
  source?: string;
};

export function ExploreDirectoryCityFeed({
  citySlug,
  cityLabel,
}: {
  citySlug: string;
  cityLabel: string;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ city: citySlug.replace(/-/g, " "), per_page: "24" });
    void apiFetch<{ events: EventRow[] }>(`/explore/events?${params.toString()}`)
      .then((body) => setEvents(body.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [citySlug]);

  if (loading) return <p className={styles.directoryMeta}>Loading events for {cityLabel}…</p>;
  if (!events.length) return <p>No events returned for {cityLabel}.</p>;

  return (
    <section className={styles.directorySection}>
      <h2>Events</h2>
      <ul className={styles.directoryEventList}>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong>
            {event.date ? <span>{event.date}</span> : null}
            {event.venue ? <small>{event.venue}</small> : null}
            {event.ticket_url ? (
              <a href={event.ticket_url} target="_blank" rel="noreferrer">
                {event.source === "eventbrite" ? "Tickets via Eventbrite" : "Tickets via Ticketmaster"}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
