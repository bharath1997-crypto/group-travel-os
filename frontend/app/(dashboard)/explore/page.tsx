"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { ExploreAskCard } from "./components/ExploreAskCard";
import { ExploreAvatarStack } from "./components/ExploreAvatarStack";
import { ExploreCityReelCard } from "./components/ExploreCityReelCard";
import { ExploreDetailDrawer } from "./components/ExploreDetailDrawer";
import { ExploreFilterChip } from "./components/ExploreFilterChip";
import { ExploreInviteSheet } from "./components/ExploreInviteSheet";
import { ExploreRankingRow } from "./components/ExploreRankingRow";
import { ExploreSavedBar } from "./components/ExploreSavedBar";
import { ExploreSlotCard } from "./components/ExploreSlotCard";
import { ExploreWayraPlanCard } from "./components/ExploreWayraPlanCard";
import { HeroLocationWidget } from "./HeroLocationWidget";
import {
  EXPLORE_CITY,
  EXPLORE_CITY_REEL,
  EXPLORE_FEED,
  EXPLORE_PROMPT_SUGGESTIONS,
  EXPLORE_RANKING,
  EXPLORE_SLOTS_LIVE,
  EXPLORE_STATS,
  EXPLORE_VIBES,
  EXPLORE_WAYRA_PLANS,
  EXPLORE_WHEN_OPTIONS,
  slotDetail,
} from "./explore-fixtures";
import styles from "./explore.module.css";

const FILTER_GROUPS = [
  ["Kind", ["Music", "Food", "Comedy", "Outdoors", "Art"]],
  ["Price, all-in", ["Free", "Under $25", "$25–60", "$60+"]],
  ["Practical", ["Bookable now", "Walk-in OK", "Indoor", "Friends going"]],
] as const;

export default function ExplorePage() {
  const { user } = useDashboardUser();

  const [city, setCity] = useState(EXPLORE_CITY);
  const [pickedCityBanner, setPickedCityBanner] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Saturday night, six of us, under $70");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const syncPromptHeight = useCallback(() => {
    const field = promptRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 116)}px`;
  }, []);

  useEffect(() => {
    syncPromptHeight();
  }, [prompt, syncPromptHeight]);
  const [when, setWhen] = useState("Tonight");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [country, setCountry] = useState("USA");
  const [broadcastLabel, setBroadcastLabel] = useState("I'm free tonight");

  const detail = slotDetail(detailId);
  const chipCount = chips.length;

  const filteredCount = useMemo(() => {
    if (!chipCount) return 41;
    return Math.max(8, 41 - chipCount * 3);
  }, [chipCount]);

  const toggleChip = (label: string) => {
    setChips((all) => (all.includes(label) ? all.filter((x) => x !== label) : [...all, label]));
  };

  const openDetail = (id: string) => setDetailId(id);
  const closeDetail = () => setDetailId(null);
  const openInvite = () => {
    setInviteOpen(true);
    setDetailId(null);
  };

  const saveDetail = (id: string) => {
    setSavedIds((all) => (all.includes(id) ? all : [...all, id]));
    setDetailId(null);
  };

  const ask = (value?: string) => {
    if (value) setPrompt(value);
    setAnswered(true);
  };

  const pickCity = (name: string) => {
    if (name === "anywhere") {
      const pick = EXPLORE_CITY_REEL[Math.floor(Math.random() * EXPLORE_CITY_REEL.length)].name;
      setCity(pick);
      setPickedCityBanner(pick);
      return;
    }
    setCity(name);
    setPickedCityBanner(name);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/explore" className={styles.logoLink}>
            <RovvyLogo variant="primary" size="lg" />
          </Link>
          <nav aria-label="Explorer primary">
            <Link href="/explore" className={styles.active}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />
              </svg>
              Explore
            </Link>
            <Link href="/live">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="2.2" />
                <path d="M7.8 7.8a6 6 0 000 8.4M16.2 16.2a6 6 0 000-8.4M4.9 4.9a10 10 0 000 14.2M19.1 19.1a10 10 0 000-14.2" />
              </svg>
              Live
              <i />
            </Link>
            <Link href="/trips">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
                <path d="M8.5 7.5V5.5a2 2 0 012-2h3a2 2 0 012 2v2M3 13h18" />
              </svg>
              Trips
            </Link>
            <Link href="/split-activities">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 5h11a5 5 0 010 10H8" />
                <path d="M11 12l-3 3 3 3" />
                <circle cx="19" cy="19" r="2" />
              </svg>
              Split Activities
            </Link>
          </nav>
          <aside>
            {user ? (
              <Link href="/profile">Profile</Link>
            ) : (
              <Link href="/login?next=%2Fexplore">Log in</Link>
            )}
            <Link href={user ? "/trips" : "/register"} className={styles.signUp}>
              {user ? "My trips" : "Sign up"}
            </Link>
          </aside>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <HeroLocationWidget
            currentCity={city}
            signedIn={Boolean(user)}
            slotsLive={EXPLORE_SLOTS_LIVE}
            onCityChange={setCity}
          />
          <div className={styles.heroContent}>
            <span className={styles.livePill}>
              <i />
              PRICES FINAL · FEES INCLUDED
            </span>
            <h1>
              What are you doing <em>tonight?</em>
            </h1>
            <p>
              Ask in plain words. Rovvy reads every provider in {city}, checks who&apos;s free and comes back with a plan
              you can book.
            </p>
            <div className={styles.prompt}>
              <label className="sr-only" htmlFor="plan-prompt">
                Describe your plans
              </label>
              <textarea
                id="plan-prompt"
                ref={promptRef}
                rows={1}
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  syncPromptHeight();
                }}
              />
              <div>
                <span>
                  {EXPLORE_PROMPT_SUGGESTIONS.map((x) => (
                    <button type="button" key={x} onClick={() => setPrompt(x)}>
                      {x.replace(", walkable", "")}
                    </button>
                  ))}
                </span>
                <button type="button" className={styles.planItBtn} onClick={() => ask()}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                  </svg>
                  Plan it
                </button>
              </div>
            </div>
            <div className={styles.when}>
              {EXPLORE_WHEN_OPTIONS.map((x) => (
                <button
                  type="button"
                  key={x}
                  className={when === x ? styles.whenSelected : ""}
                  onClick={() => setWhen(x)}
                >
                  {x}
                </button>
              ))}
              <button type="button" className={styles.refineBtn} onClick={() => setFiltersOpen((v) => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h16M7 12h10M10 17h4" />
                </svg>
                Refine{chipCount ? ` · ${chipCount}` : ""}
              </button>
            </div>
          </div>
        </section>

        <section className={styles.pulseBar}>
          <div>
            <span>
              <i />
              Last hour
            </span>
            <p>
              <strong>Tomas</strong> booked the blues night · <strong>Ana</strong> saved two slots ·{" "}
              <strong>9 spots</strong> gone across {city}
            </p>
            <button
              type="button"
              className={styles.broadcastBtn}
              onClick={() => {
                setBroadcasting((v) => !v);
                setBroadcastLabel((v) => (v === "I'm free tonight" ? "You're visible till midnight ✓" : "I'm free tonight"));
              }}
            >
              {broadcastLabel}
            </button>
          </div>
        </section>

        <section className={styles.stats}>
          {EXPLORE_STATS.map(({ count, label, accent }) => (
            <button
              type="button"
              key={label}
              className={`${styles.statChip} ${chips.includes(label) ? styles.statChipOn : ""}`}
              onClick={() => toggleChip(label)}
            >
              <b className={accent ? styles.accentText : undefined}>{count}</b>
              <span>{label}</span>
            </button>
          ))}
        </section>

        <section className={styles.vibes}>
          <small>Vibe</small>
          <div>
            {EXPLORE_VIBES.map((x) => (
              <ExploreFilterChip key={x} label={x} selected={chips.includes(x)} onToggle={() => toggleChip(x)} />
            ))}
          </div>
        </section>

        {broadcasting && (
          <section className={styles.broadcastBanner}>
            <div>
              <ExploreAvatarStack
                people={[
                  { initials: "AR", tone: "gold" },
                  { initials: "TK", tone: "purple" },
                ]}
              />
              <p>
                <strong>Ana and Tomas</strong> are free tonight too. They can see what you&apos;re browsing until midnight.
              </p>
              <button type="button" className={styles.pullThemIn} onClick={openInvite}>
                Pull them in
              </button>
            </div>
          </section>
        )}

        {filtersOpen && (
          <section className={styles.filters}>
            <div>
              <div className={styles.filterGroups}>
                {FILTER_GROUPS.map(([name, items]) => (
                  <div key={name}>
                    <small>{name}</small>
                    <span>
                      {items.map((x) => (
                        <ExploreFilterChip key={x} label={x} selected={chips.includes(x)} onToggle={() => toggleChip(x)} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <footer>
                <button type="button" onClick={() => setChips([])}>
                  Clear all
                </button>
                <button type="button" onClick={() => setFiltersOpen(false)}>
                  Show {filteredCount} slots
                </button>
              </footer>
            </div>
          </section>
        )}

        {answered && (
          <section className={styles.wayraAnswer}>
            <div className={styles.wayraAnswerInner}>
              <header>
                <div>
                  <span className={styles.wayraBadge}>✦ Wayra answered</span>
                  <h2>Three ways to spend it — stitched from 4 providers</h2>
                </div>
                <button type="button" className={styles.wayraClose} onClick={() => setAnswered(false)} aria-label="Close">
                  ×
                </button>
              </header>
              <div className={styles.wayraPlans}>
                {EXPLORE_WAYRA_PLANS.map((plan) => (
                  <ExploreWayraPlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={styles.friendBar}>
          <ExploreAvatarStack
            people={[
              { initials: "AR", tone: "gold" },
              { initials: "TK", tone: "purple" },
              { initials: "SM", tone: "green" },
            ]}
          />
          <p>
            <strong>Ana</strong> saved two slots for Saturday · <strong>Tomas</strong> booked the blues night ·{" "}
            <strong>Sam</strong> is free after 9
          </p>
          <button type="button" className={styles.friendBarBtn} onClick={openInvite}>
            See what friends picked
          </button>
        </section>

        <section className={styles.masonry}>
          {EXPLORE_FEED.map((item) => {
            if (item.kind === "slot") return <ExploreSlotCard key={item.id} slot={item} onOpen={openDetail} />;
            if (item.kind === "ask") return <ExploreAskCard key={item.id} card={item} onClick={ask} />;
            if (item.kind === "live") {
              return (
                <button type="button" key={item.id} className={styles.liveCard} onClick={() => ask("Show me tonight's late events")}>
                  <span className={styles.liveCardLabel}>
                    <i />
                    Live now
                  </span>
                  <b>
                    Late events,
                    <br />
                    starting soon
                  </b>
                  <small>Nine doors open after 10 PM tonight — walk-in space still showing.</small>
                  <span>See what&apos;s open →</span>
                </button>
              );
            }
            return (
              <button type="button" key={item.id} className={styles.inviteCard} onClick={openInvite}>
                <ExploreAvatarStack
                  size="lg"
                  people={[
                    { initials: "AR", tone: "gold" },
                    { initials: "TK", tone: "purple" },
                    { initials: "SM", tone: "green" },
                  ]}
                />
                <b>Book one thing for six people</b>
                <small>One tap, they vote, cost splits →</small>
              </button>
            );
          })}
        </section>

        <p className={styles.note}>
          Thin night? Rovvy falls back to open venues from OpenStreetMap and editorial picks — the feed never comes back
          empty. Prices are final, fees included, refreshed every 5 minutes.
        </p>

        <section className={styles.ranking}>
          <header>
            <div>
              <small>Ranked by Rovvy · 4,180 verified check-ins this month</small>
              <h2>Highest rated in {city} right now</h2>
            </div>
            <span>updated 4 min ago</span>
          </header>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>#</span>
              <span>Place</span>
              <span>Rating</span>
              <span>Distance</span>
              <span>All-in</span>
              <span>Availability</span>
            </div>
            {EXPLORE_RANKING.map((row) => (
              <ExploreRankingRow key={row.id} row={row} onOpen={openDetail} />
            ))}
          </div>
        </section>

        <section className={styles.destinations}>
          <header>
            <div>
              <small>Popular in {country === "USA" ? "the USA" : country}</small>
              <h2>Where people are going</h2>
            </div>
            <span>
              {(["USA", "Canada", "Mexico"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`${styles.regionTab} ${country === c ? styles.regionTabActive : ""}`}
                  onClick={() => setCountry(c)}
                >
                  {c}
                </button>
              ))}
              <Link href="/explore">All countries →</Link>
            </span>
          </header>
          <div className={styles.reel}>
            {EXPLORE_CITY_REEL.map((c) => (
              <ExploreCityReelCard key={c.id} city={c} onPick={pickCity} />
            ))}
            <button type="button" className={styles.surpriseCard} onClick={() => pickCity("anywhere")}>
              <b>
                Surprise
                <br />
                me
              </b>
              <small>Wayra picks a city →</small>
            </button>
          </div>
          {pickedCityBanner && pickedCityBanner !== EXPLORE_CITY ? (
            <div className={styles.cityPickedBanner}>
              <p>
                Showing <strong>{pickedCityBanner}</strong> — the feed and every filter now follow that city.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCity(EXPLORE_CITY);
                  setPickedCityBanner(null);
                }}
              >
                Back to Chicago
              </button>
            </div>
          ) : null}
        </section>
      </main>

      <ExploreSavedBar savedIds={savedIds} onClear={() => setSavedIds([])} onInvite={openInvite} />
      <ExploreDetailDrawer detail={detail} onClose={closeDetail} onSave={saveDetail} onInvite={openInvite} />
      <ExploreInviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
