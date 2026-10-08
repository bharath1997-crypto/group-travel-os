"use client";

import { useRef } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";
import { SettingsBreadcrumb, legalCrumbs } from "@/components/settings/SettingsBreadcrumb";
import { CONTACT_EMAIL } from "@/lib/contact-config";

export default function LegalDataPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-screen bg-white" style={{ color: "#0F1614" }}>
      <header className="shrink-0 border-b border-slate-100 bg-white px-6 py-4 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 outline-none">
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E6E5C" }}>
            Data &amp; attribution
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <SettingsBreadcrumb crumbs={legalCrumbs("Data sources & attribution")} />
        <main className="mx-auto max-w-[800px] px-10 pt-10 pb-12">
          <div className="mb-12">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#F0FDFA", color: "#0E6E5C", border: "1px solid #99F6E4" }}
            >
              Last updated: October 2026
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#0F1614" }}>
              Data sources &amp; attribution
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              Where Rovvy gets place and event information, how we credit third parties, and how to request
              removal of an event listing.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>
            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Independence
              </h2>
              <p>
                Rovvy is an independent travel coordination platform. Rovvy is not owned by, affiliated with,
                or endorsed by Eventbrite, Ticketmaster, or their parent companies. Event names, dates, venues,
                and ticket links shown in Explore come from those providers&apos; public APIs or pages when
                available; Rovvy does not sell tickets on their behalf.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Overture Maps Foundation
              </h2>
              <p>
                Place names, categories, and map geometry for many Explore listings are derived from{" "}
                <a
                  href="https://overturemaps.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                  style={{ color: "#0E6E5C" }}
                >
                  Overture Maps
                </a>{" "}
                open map data, combined with Rovvy&apos;s own indexing and display rules. We do not claim
                ownership of underlying map features.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Wikimedia Commons
              </h2>
              <p>
                Some place photos are loaded from{" "}
                <a
                  href="https://commons.wikimedia.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                  style={{ color: "#0E6E5C" }}
                >
                  Wikimedia Commons
                </a>{" "}
                under their respective free licenses. Where a Commons image is shown, Rovvy displays author
                and license credit on the listing when that metadata is available.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Ticketmaster
              </h2>
              <p>
                Event listings sourced from Ticketmaster include titles, schedules, venues, and ticket URLs as
                returned by Ticketmaster&apos;s Discovery API. Images may be hot-linked from Ticketmaster
                URLs; we do not copy those assets to Rovvy storage. Ticket purchases happen on Ticketmaster
                sites, not inside Rovvy.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Eventbrite
              </h2>
              <p>
                Event listings sourced from Eventbrite reflect organizer-provided fields from Eventbrite&apos;s
                API. Links labeled &quot;View on Eventbrite&quot; open Eventbrite&apos;s site for registration
                or tickets. Rovvy does not process Eventbrite payments.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section id="removal">
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#0E6E5C" }}>
                Event removal requests
              </h2>
              <p className="mb-4">
                If you are an event organizer or rights holder and want an event removed from Rovvy Explore,
                email us with the event title, date, city, and a link to the listing or provider page if you
                have one. We aim to process verified removal requests within 24 hours and block re-ingest of
                that provider event id.
              </p>
              <p>
                Contact:{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Event%20removal%20request`}
                  className="font-medium underline underline-offset-2"
                  style={{ color: "#0E6E5C" }}
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
