"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";



import { useDashboardUser } from "@/contexts/dashboard-user-context";



import {

  createCollectionItem,

  createNamedCollection,

  deleteCollectionItem,

  extractCollectionLink,

  fetchCollectionItems,

} from "./collection-api";

import {

  COLLECTION_DEMO_HOURS,

  COLLECTION_DEMO_ITEMS,

  COLLECTION_DEMO_RATING,

  COLLECTION_DEMO_UNSORTED,

} from "./collection-fixtures";

import {

  activeFilterCount,

  filterBySearch,

  formatSavedWhen,

  groupItems,

  itemMetaLabel,

} from "./collection-grouping";

import type {

  CollectionItem,

  ExtractLinkResponse,

  GroupMode,

  ViewMode,

} from "./collection-types";

import styles from "./collection.module.css";



const MAP_PIN_POSITIONS: Record<string, { left: string; top: string }> = {

  Chicago: { left: "30%", top: "57%" },

  "New Orleans": { left: "63%", top: "33%" },

  Austin: { left: "82%", top: "70%" },

  Lisbon: { left: "20%", top: "24%" },

};



function StarIcon({ filled, size = 11 }: { filled: boolean; size?: number }) {

  return (

    <svg

      width={size}

      height={size}

      viewBox="0 0 24 24"

      fill={filled ? "#D8A23A" : "rgba(15,22,20,0.16)"}

      stroke={filled ? "#D8A23A" : "rgba(15,22,20,0.16)"}

      strokeWidth="1.5"

      strokeLinejoin="round"

      aria-hidden

    >

      <path d="M12 3.6l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17.5l-5.6 3.1 1.3-6.2L3 10.1l6.3-.7z" />

    </svg>

  );

}



function isDemoId(id: string): boolean {

  return id.startsWith("demo-");

}



export default function CollectionPage() {

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const { user } = useDashboardUser();
  const loginNext = encodeURIComponent(pathname || "/collection");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [apiItems, setApiItems] = useState<CollectionItem[]>([]);

  const [totalCount, setTotalCount] = useState(0);

  const [unsortedCount, setUnsortedCount] = useState(0);

  const [facets, setFacets] = useState({

    countries: [] as string[],

    cities: [] as string[],

    categories: [] as string[],

  });

  const [cityCounts, setCityCounts] = useState<Record<string, number>>({});



  const [view, setView] = useState<ViewMode>("grid");

  const [groupMode, setGroupMode] = useState<GroupMode>("city");

  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);

  const [adVisible, setAdVisible] = useState(true);

  const [filters, setFilters] = useState({

    country: "Any",

    city: "Any",

    category: "Any",

  });

  const [draftFilters, setDraftFilters] = useState(filters);



  const [linkInput, setLinkInput] = useState("");

  const [reading, setReading] = useState(false);

  const [extractResult, setExtractResult] = useState<ExtractLinkResponse | null>(null);



  const isDemo = !user || (!loading && apiItems.length === 0);

  const baseItems = isDemo ? COLLECTION_DEMO_ITEMS : apiItems;

  const items = useMemo(

    () => filterBySearch(baseItems, searchQuery),

    [baseItems, searchQuery],

  );

  const displayTotal = isDemo ? COLLECTION_DEMO_ITEMS.length : totalCount;

  const displayUnsorted = isDemo ? COLLECTION_DEMO_UNSORTED : unsortedCount;

  const displayCityCounts = isDemo

    ? COLLECTION_DEMO_ITEMS.reduce<Record<string, number>>((acc, item) => {

        if (item.city) acc[item.city] = (acc[item.city] ?? 0) + 1;

        return acc;

      }, {})

    : cityCounts;

  const displayFacets = isDemo
    ? {
        countries: [...new Set(COLLECTION_DEMO_ITEMS.map((i) => i.country).filter(Boolean))] as string[],
        cities: [...new Set(COLLECTION_DEMO_ITEMS.map((i) => i.city).filter(Boolean))] as string[],
        categories: [...new Set(COLLECTION_DEMO_ITEMS.map((i) => i.category).filter(Boolean))] as string[],
      }
    : facets;

  const requireLogin = useCallback(() => {
    if (user) return true;
    router.push(`/login?next=${loginNext}`);
    return false;
  }, [user, router, loginNext]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    setError(null);

    try {

      const data = await fetchCollectionItems(filters);

      setApiItems(data.items);

      setTotalCount(data.total_count);

      setUnsortedCount(data.unsorted_count);

      setFacets(data.facets);

      setCityCounts(data.city_counts);

    } catch (e) {

      setError(e instanceof Error ? e.message : "Could not load your collection");

    } finally {

      setLoading(false);

    }

  }, [user, filters]);



  useEffect(() => {

    void load();

  }, [load]);



  const sections = useMemo(() => groupItems(items, groupMode), [items, groupMode]);

  const filterCount = activeFilterCount(filters);

  const savedHeadline =

    filterCount > 0 || searchQuery.trim()

      ? `${items.length} of ${displayTotal} places you kept`

      : `${displayTotal} places you kept`;



  const handleReadLink = async () => {
    if (!requireLogin()) return;

    const url = (linkInput.trim() || searchQuery.trim());

    if (!url || reading) return;

    setReading(true);

    setExtractResult(null);

    try {

      const result = await extractCollectionLink(url);

      setExtractResult(result);

    } catch (e) {

      setError(e instanceof Error ? e.message : "Could not read that link");

    } finally {

      setReading(false);

    }

  };



  const handleSaveCandidate = async (candidate: ExtractLinkResponse["candidates"][number]) => {
    if (!requireLogin()) return;

    try {

      await createCollectionItem({

        name: candidate.name,

        city: candidate.city,

        country: candidate.country,

        category: candidate.category,

        subcategory: candidate.subcategory,

        source: "Link",

        saved_from: candidate.saved_from ?? linkInput.trim(),

        match_status: candidate.match_status ?? "unknown",

        is_unsorted: candidate.match_status === "unsure",

      });

      await load();

    } catch (e) {

      setError(e instanceof Error ? e.message : "Could not save place");

    }

  };



  const handleRemove = async (id: string) => {

    if (isDemoId(id)) return;

    try {

      await deleteCollectionItem(id);

      setOpenCardId(null);

      await load();

    } catch (e) {

      setError(e instanceof Error ? e.message : "Could not remove place");

    }

  };



  const handleNewCollection = async () => {
    if (!requireLogin()) return;

    const name = window.prompt("Collection name");

    if (!name?.trim()) return;

    try {

      await createNamedCollection(name.trim());

    } catch (e) {

      setError(e instanceof Error ? e.message : "Could not create collection");

    }

  };



  return (

    <div className={styles.page}>

      <div className={styles.heroRow}>

        <div>

          <div className={`${styles.eyebrow} ${styles.mono}`}>Collection</div>

          <h1 className={`${styles.title} ${styles.serif}`}>{savedHeadline}</h1>

          <p className={styles.subtitle}>

            Everything you saved, wherever it came from — a search, a pin, a reel someone sent you.

          </p>

        </div>

        <div className={styles.toolbar}>

          <button

            type="button"

            className={`${styles.filterBtn} ${filterCount ? styles.filterBtnActive : ""}`}

            onClick={() => {

              setDraftFilters(filters);

              setFilterOpen(true);

            }}

          >

            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden>

              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />

            </svg>

            {filterCount ? `Filter · ${filterCount}` : "Filter"}

          </button>

          <div className={styles.viewToggleWrap}>

            <button

              type="button"

              aria-label="Grid view"

              className={view === "grid" ? styles.viewToggleActive : undefined}

              onClick={() => setView("grid")}

            >

              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden>

                <rect x="4" y="4" width="7" height="7" rx="1.6" />

                <rect x="13" y="4" width="7" height="7" rx="1.6" />

                <rect x="4" y="13" width="7" height="7" rx="1.6" />

                <rect x="13" y="13" width="7" height="7" rx="1.6" />

              </svg>

            </button>

            <button

              type="button"

              aria-label="Map view"

              className={view === "map" ? styles.viewToggleActive : undefined}

              onClick={() => setView("map")}

            >

              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden>

                <path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 8.5z" />

                <path d="M9 4.5v13M15 8.5v11" />

              </svg>

            </button>

          </div>

        </div>

      </div>



      <div className={styles.pasteCard}>

        <div className={styles.pasteTop}>

          <div style={{ flex: "1 1 260px", minWidth: 0 }}>

            <div className={`${styles.pasteEyebrow} ${styles.mono}`}>

              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>

                <path d="M9.5 14.5l5-5M7.5 12.5L5 15a3.5 3.5 0 005 5l2.5-2.5M16.5 11.5L19 9a3.5 3.5 0 00-5-5l-2.5 2.5" />

              </svg>

              Paste anything

            </div>

            <div className={`${styles.pasteTitle} ${styles.serif}`}>

              A reel, an article, a news link — we find the place in it.

            </div>

          </div>

          <div className={styles.platformTags}>

            {["Instagram", "TikTok", "YouTube", "Any article"].map((tag) => (

              <span key={tag} className={styles.mono}>{tag}</span>

            ))}

          </div>

        </div>

        <div className={styles.pasteInputRow}>

          <input

            type="url"

            value={linkInput}

            onChange={(e) => setLinkInput(e.target.value)}

            placeholder="Paste a link, or type what you remember"

            aria-label="Paste a link to extract a place"

          />

          <button type="button" className={styles.readBtn} disabled={reading} onClick={() => void handleReadLink()}>

            {reading ? "Reading…" : extractResult ? "Read again" : "Read it"}

          </button>

        </div>

        {extractResult ? (

          <div className={`${styles.extractResult} ${styles.cardDetailsPop}`}>

            <p className={styles.extractMessage}>

              “{extractResult.source_title}” — {extractResult.source_label}

              {extractResult.message ? `. ${extractResult.message}` : ""}

            </p>

            {extractResult.candidates.map((candidate) => (

              <div key={candidate.name} style={{ display: "flex", gap: 11, alignItems: "center", marginTop: 10 }}>

                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{candidate.name}</span>

                <button type="button" className={styles.readBtn} onClick={() => void handleSaveCandidate(candidate)}>

                  Save

                </button>

              </div>

            ))}

          </div>

        ) : null}

      </div>



      <div className={styles.groupBar}>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          <span className={`${styles.mono} ${styles.eyebrow}`} style={{ marginBottom: 0 }}>Group by</span>

          <div className={styles.groupToggle}>

            <button

              type="button"

              className={groupMode === "city" ? styles.groupToggleActive : undefined}

              onClick={() => setGroupMode("city")}

            >

              City

            </button>

            <button

              type="button"

              className={groupMode === "category" ? styles.groupToggleActive : undefined}

              onClick={() => setGroupMode("category")}

            >

              Category

            </button>

          </div>

        </div>

        <span className={styles.groupHint}>

          {groupMode === "city"

            ? "Grouped by city — the way you remember a save"

            : "Grouped by category — every city mixed together"}

        </span>

        <button type="button" className={styles.newCollectionBtn} onClick={() => void handleNewCollection()}>

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>

            <path d="M12 6v12M6 12h12" strokeLinecap="round" />

          </svg>

          New collection

        </button>

      </div>



      {adVisible && view === "grid" ? (

        <div className={styles.sponsoredWrap}>

          <div className={styles.sponsoredHead}>

            <span className={`${styles.eyebrow} ${styles.mono}`} style={{ marginBottom: 0 }}>Sponsored</span>

            <button type="button" className={styles.hideAdBtn} onClick={() => setAdVisible(false)}>

              Hide

            </button>

          </div>

          <div className={styles.sponsoredCard}>

            <div className={styles.sponsoredArt} aria-hidden />

            <div className={styles.sponsoredBody}>

              <div style={{ flex: "1 1 240px", minWidth: 0 }}>

                <div className={`${styles.eyebrow} ${styles.mono}`} style={{ marginBottom: 6 }}>

                  Because you saved 4 listening bars

                </div>

                <div className={`${styles.sponsoredTitle} ${styles.serif}`}>Constellation, Avondale</div>

                <div style={{ fontSize: 12.5, color: "#3a423b", lineHeight: 1.5 }}>

                  Free improv sets Tuesdays. 1.8 mi from your saves cluster.

                </div>

              </div>

              <div className={styles.sponsoredActions}>

                <button type="button" className={styles.saveItBtn}>Save it</button>

                <button type="button" className={styles.lookBtn}>Look</button>

              </div>

            </div>

          </div>

        </div>

      ) : null}



      {error ? (

        <p role="alert" style={{ color: "#B4453D", marginBottom: 16, fontSize: 13 }}>{error}</p>

      ) : null}



      {loading ? (

        <p className={styles.subtitle}>Loading your saves…</p>

      ) : view === "map" ? (

        <div className={styles.mapShell}>

          <div className={styles.mapGrid} />

          {Object.entries(displayCityCounts).map(([city, count], index) => {

            const pos = MAP_PIN_POSITIONS[city] ?? {

              left: `${15 + (index * 17) % 70}%`,

              top: `${20 + (index * 13) % 60}%`,

            };

            return (

              <div

                key={city}

                className={`${styles.mapPin} ${index === 0 ? styles.mapPinPrimary : ""}`}

                style={{ left: pos.left, top: pos.top }}

              >

                <span className={styles.mapPinLabel}>

                  <span>{city}</span>

                  <span className={styles.mono} style={{ fontSize: 9.5, background: "#edeae2", padding: "1px 6px", borderRadius: 999 }}>

                    {count}

                  </span>

                </span>

              </div>

            );

          })}

          <div className={styles.mapFooter}>

            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FE0C0" }} />

            {displayTotal} saves across {Object.keys(displayCityCounts).length || 0} cities

          </div>

        </div>

      ) : sections.length === 0 ? (

        <div className={styles.emptyState}>

          <h2 className={styles.serif} style={{ fontSize: 24, marginBottom: 8 }}>Nothing saved yet</h2>

          <p className={styles.subtitle} style={{ margin: "0 auto" }}>

            Paste a link above, or save a place from Live or Explore — it will show up here.

          </p>

        </div>

      ) : (

        <div className={styles.gridPop}>

          {sections.map((section) => (

            <section key={section.title} className={styles.section}>

              <div className={styles.sectionHead}>

                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>

                  <span className={`${styles.sectionTitle} ${styles.serif}`}>{section.title}</span>

                  <span className={`${styles.countPill} ${styles.mono}`}>{section.count}</span>

                </span>

                {section.shared ? (

                  <span className={styles.sharedBadge}>

                    <span className={styles.sharedAvatars} aria-hidden>

                      <span style={{ background: "#f0e5d2", color: "#7a5a22" }}>AR</span>

                      <span style={{ background: "#e4e1f2", color: "#474079" }}>TK</span>

                      <span style={{ background: "#fff", color: "#5a615a" }}>{section.sharedExtra}</span>

                    </span>

                    <span className={`${styles.sharedLabel} ${styles.mono}`}>Shared</span>

                  </span>

                ) : null}

                <span className={`${styles.sectionMeta} ${styles.mono}`}>{section.meta}</span>

              </div>

              <div className={styles.grid}>

                {section.items.map((item) => {

                  const open = openCardId === item.id;

                  const rating = COLLECTION_DEMO_RATING[item.id];

                  const hours = COLLECTION_DEMO_HOURS[item.id];

                  return (

                    <div key={item.id} className={`${styles.card} ${open ? styles.cardOpen : ""}`}>

                      <button

                        type="button"

                        className={styles.cardToggle}

                        onClick={() => setOpenCardId(open ? null : item.id)}

                      >

                        <span className={styles.cardImage}>

                          <span className={`${styles.sourceBadge} ${styles.mono}`}>{item.source.toUpperCase()}</span>

                          {item.stars > 0 ? (

                            <span className={styles.starsBadge}>

                              <StarIcon filled size={9} />

                              <span className={styles.mono}>{item.stars}.0</span>

                            </span>

                          ) : null}

                        </span>

                        <span className={styles.cardBody}>

                          <span className={styles.cardName}>{item.name}</span>

                          <span className={`${styles.cardMeta} ${styles.mono}`}>{itemMetaLabel(item)}</span>

                        </span>

                      </button>

                      {open ? (

                        <div className={`${styles.cardDetails} ${styles.cardDetailsPop}`}>

                          {rating || hours ? (

                            <div className={styles.ratingLine}>

                              {rating ? <span className={`${styles.ratingValue} ${styles.mono}`}>{rating}</span> : null}

                              {hours ? <span className={`${styles.hoursValue} ${styles.mono}`}>{hours}</span> : null}

                            </div>

                          ) : null}

                          <div className={styles.detailRow}>

                            <span className={`${styles.detailLabel} ${styles.mono}`}>Saved</span>

                            <span className={styles.detailValue}>{formatSavedWhen(item.created_at)}</span>

                          </div>

                          {item.saved_from ? (

                            <div className={styles.detailRow}>

                              <span className={`${styles.detailLabel} ${styles.mono}`}>From</span>

                              <span className={styles.detailValue}>{item.saved_from}</span>

                            </div>

                          ) : null}

                          <div style={{ marginTop: 10 }}>

                            <div className={styles.noteHeader}>

                              <span className={`${styles.noteLabel} ${styles.mono}`}>Your note</span>

                              <span style={{ display: "flex", gap: 1.5 }}>

                                {[1, 2, 3, 4, 5].map((n) => (

                                  <StarIcon key={n} filled={item.stars >= n} />

                                ))}

                              </span>

                            </div>

                            <div className={`${styles.noteBox} ${item.note ? "" : styles.noteEmpty}`}>

                              {item.note || "Add a note — what made you save it?"}

                            </div>

                          </div>

                          <div className={styles.cardActions}>

                            <button type="button">

                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>

                                <rect x="4" y="4" width="16" height="16" rx="3" />

                                <path d="M8 12.5l2.8 2.8L16 9.5" strokeLinecap="round" />

                              </svg>

                              To a vote

                            </button>

                            <button type="button">

                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>

                                <path d="M4 7.5h6l2 2.5h8v8.5H4z" strokeLinejoin="round" />

                              </svg>

                              Move

                            </button>

                            <button

                              type="button"

                              onClick={() => void handleRemove(item.id)}

                              className={styles.removeBtn}

                              aria-label="Remove"

                            >

                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>

                                <path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13" strokeLinecap="round" />

                              </svg>

                            </button>

                          </div>

                        </div>

                      ) : null}

                    </div>

                  );

                })}

                <button type="button" className={styles.addCardBtn}>

                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>

                    <path d="M12 6v12M6 12h12" strokeLinecap="round" />

                  </svg>

                  Add a place

                </button>

              </div>

            </section>

          ))}



          {displayUnsorted > 0 ? (

            <div className={styles.unsortedBar}>

              <div style={{ flex: "1 1 280px", minWidth: 0 }}>

                <div className={`${styles.eyebrow} ${styles.mono}`}>Unsorted · {displayUnsorted}</div>

                <div style={{ fontSize: 13, color: "#3A423B", lineHeight: 1.55 }}>

                  {displayUnsorted} places came in from reels and links. We guessed the location — check us before they get filed.

                </div>

              </div>

              <button type="button" className={styles.sortBtn}>Sort them out</button>

            </div>

          ) : null}

        </div>

      )}



      {filterOpen ? (

        <div className={styles.modalBackdrop} onClick={() => setFilterOpen(false)} role="presentation">

          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Filter collection">

            <div style={{ marginBottom: 16 }}>

              <div className={`${styles.eyebrow} ${styles.mono}`}>Filter</div>

              <div className={`${styles.serif}`} style={{ fontSize: 22 }}>Narrow it down</div>

            </div>



            <div className={`${styles.eyebrow} ${styles.mono}`}>Country</div>

            <div className={styles.chipRow}>

              {["Any", ...displayFacets.countries].map((value) => (

                <button

                  key={`country-${value}`}

                  type="button"

                  className={`${styles.chip} ${draftFilters.country === value ? styles.chipActive : ""}`}

                  onClick={() => setDraftFilters((f) => ({ ...f, country: value, city: "Any" }))}

                >

                  {value}

                </button>

              ))}

            </div>



            <div className={`${styles.eyebrow} ${styles.mono}`}>City</div>

            <div className={styles.chipRow}>

              {["Any", ...displayFacets.cities].map((value) => (

                <button

                  key={`city-${value}`}

                  type="button"

                  className={`${styles.chip} ${draftFilters.city === value ? styles.chipActive : ""}`}

                  onClick={() => setDraftFilters((f) => ({ ...f, city: value }))}

                >

                  {value}

                  {value !== "Any" && displayCityCounts[value] ? ` · ${displayCityCounts[value]}` : ""}

                </button>

              ))}

            </div>



            <div className={`${styles.eyebrow} ${styles.mono}`}>Category</div>

            <div className={styles.chipRow}>

              {["Any", ...displayFacets.categories].map((value) => (

                <button

                  key={`cat-${value}`}

                  type="button"

                  className={`${styles.chip} ${draftFilters.category === value ? styles.chipActive : ""}`}

                  onClick={() => setDraftFilters((f) => ({ ...f, category: value }))}

                >

                  {value}

                </button>

              ))}

            </div>



            <div className={styles.modalActions}>

              <button

                type="button"

                className={styles.filterBtn}

                onClick={() => setDraftFilters({ country: "Any", city: "Any", category: "Any" })}

              >

                Clear

              </button>

              <button

                type="button"

                className={styles.applyBtn}

                onClick={() => {

                  setFilters(draftFilters);

                  setFilterOpen(false);

                }}

              >

                {draftFilters.country === "Any" && draftFilters.city === "Any" && draftFilters.category === "Any"

                  ? "Show everything"

                  : "Apply filters"}

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </div>

  );

}


