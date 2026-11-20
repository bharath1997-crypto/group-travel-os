"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useDashboardUser } from "@/contexts/dashboard-user-context";

import {
  createCollectionItem,
  createNamedCollection,
  deleteCollectionItem,
  extractCollectionLink,
  fetchCollectionItems,
  fetchCollections,
  fetchFriends,
  shareCollectionItem,
  updateCollectionItem,
} from "./collection-api";
import CollectionCardEditor from "./CollectionCardEditor";
import CollectionLinkResult from "./CollectionLinkResult";
import { canonicalLink, extractSharedUrl, linkName, linkOnlyBody, MAX_LINK_LENGTH, sourceLink } from "./collection-link";
import { restoreBody } from "./collection-edit";
import {
  COLLECTION_DEMO_HOURS,
  COLLECTION_DEMO_ITEMS,
  COLLECTION_DEMO_RATING,
} from "./collection-fixtures";
import {
  activeFilterCount,
  filterByFacets,
  filterBySearch,
  formatSavedFrom,
  formatSavedWhen,
  groupItems,
  itemMetaLabel,
  looksLikeUrl,
} from "./collection-grouping";
import type {
  CollectionItem,
  CollectionItemPatch,
  CollectionSummary,
  ExtractLinkResponse,
  Friend,
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

const NO_FILTERS = { country: "Any", city: "Any", category: "Any" };

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

function countBy(items: CollectionItem[], key: "city" | "country" | "category"): string[] {
  return [...new Set(items.map((i) => i[key]).filter(Boolean))] as string[];
}

export default function CollectionPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const { user, loading: userLoading } = useDashboardUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiItems, setApiItems] = useState<CollectionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState({
    countries: [] as string[],
    cities: [] as string[],
    categories: [] as string[],
    tags: [] as string[],
  });

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [newCollOpen, setNewCollOpen] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  // Removed saves that can still be put back, newest last. Each lives 8 s (deleting two in a row used to lose the first).
  const [undoStack, setUndoStack] = useState<Array<{ item: CollectionItem; until: number }>>([]);
  const undo = undoStack.length > 0 ? undoStack[undoStack.length - 1].item : null;

  const [view, setView] = useState<ViewMode>("grid");
  const [groupMode, setGroupMode] = useState<GroupMode>("city");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [draftFilters, setDraftFilters] = useState(filters);

  const [linkInput, setLinkInput] = useState(() => (looksLikeUrl(searchQuery) ? searchQuery.trim() : ""));
  const [reading, setReading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsFailed, setFriendsFailed] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [clipNote, setClipNote] = useState<string | null>(null);
  const [savedLink, setSavedLink] = useState<CollectionItem | null>(null);
  const autoRead = useRef(false);
  const loadSeq = useRef(0);
  const [extractResult, setExtractResult] = useState<ExtractLinkResponse | null>(null);

  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Sample places are for signed-out visitors only. Signed-in users never see them.
  const isGuest = !user && !userLoading;
  const textSearch = looksLikeUrl(searchQuery) ? "" : searchQuery;

  const cityToCountry = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of apiItems) if (i.city && i.country) m.set(i.city, i.country);
    return m;
  }, [apiItems]);

  const baseItems = useMemo(
    () => (isGuest ? filterByFacets(COLLECTION_DEMO_ITEMS, filters) : apiItems),
    [isGuest, apiItems, filters],
  );
  const items = useMemo(
    () =>
      filterBySearch(baseItems, textSearch).filter(
        (i) => !activeCollection || i.collection_id === activeCollection,
      ).filter((i) => !activeTag || (i.tags ?? []).includes(activeTag)),
    [baseItems, textSearch, activeCollection, activeTag],
  );

  const displayTotal = isGuest ? COLLECTION_DEMO_ITEMS.length : totalCount;
  const displayFacets = isGuest
    ? {
        countries: countBy(COLLECTION_DEMO_ITEMS, "country"),
        cities: countBy(COLLECTION_DEMO_ITEMS, "city"),
        categories: countBy(COLLECTION_DEMO_ITEMS, "category"),
      }
    : facets;

  // Map pins and counts follow what is actually shown.
  const shownCityCounts = useMemo(
    () =>
      items.reduce<Record<string, number>>((acc, item) => {
        if (item.city) acc[item.city] = (acc[item.city] ?? 0) + 1;
        return acc;
      }, {}),
    [items],
  );

  const loginNext = (extra?: string) => {
    const base = pathname || "/collection";
    const shared = searchParams.get("shared") === "1" ? "&shared=1" : "";
    const target = extra ? `${base}?q=${encodeURIComponent(extra)}${shared}` : base;
    return `/login?next=${encodeURIComponent(target)}`;
  };

  const requireLogin = useCallback(
    (keepLink?: string) => {
      if (user) return true;
      router.push(loginNext(keepLink));
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, router, pathname],
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!user) {
        if (!userLoading) setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      setError(null);
      const seq = ++loadSeq.current;
      try {
        const data = await fetchCollectionItems(filters);
        if (seq !== loadSeq.current) return; // a newer load is already on its way; this answer is stale
        setApiItems(data.items);
        setTotalCount(data.total_count);
        setFacets({ ...data.facets, tags: data.facets.tags ?? [] });
        // Named collections are secondary: a failure here must not hide the saves.
        fetchCollections()
          .then(setCollections)
          .catch(() => setCollections([]));
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setApiItems([]);
        setError(e instanceof Error ? e.message : "Could not load your collection");
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [user, userLoading, filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Friends you can send saves to. A failure only hides the picker, never the saves.
  useEffect(() => {
    if (!user) return;
    fetchFriends()
      .then((list) => {
        setFriends(list);
        setFriendsFailed(false);
      })
      .catch(() => {
        setFriends([]);
        setFriendsFailed(true);
      });
  }, [user]);

  // Filter dialog: focus it on open, close on Escape, give focus back on close.
  useEffect(() => {
    if (!filterOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
      if (event.key === "Tab" && dialogRef.current) {
        // aria-modal promises focus stays inside: wrap at both ends.
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === dialogRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const opener = filterBtnRef.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [filterOpen]);

  // A tag or collection that no longer exists (last item untagged, removed) must not stay applied.
  useEffect(() => {
    if (activeTag && !(facets.tags ?? []).includes(activeTag)) setActiveTag(null);
  }, [facets.tags, activeTag]);
  useEffect(() => {
    if (activeCollection && collections.length > 0 && !collections.some((c) => c.id === activeCollection)) setActiveCollection(null);
  }, [collections, activeCollection]);

  const sections = useMemo(() => groupItems(items, groupMode), [items, groupMode]);
  const unsortedItems = useMemo(() => items.filter((i) => i.is_unsorted), [items]);

  const filterCount = activeFilterCount(filters);
  const narrowed = filterCount > 0 || Boolean(textSearch.trim()) || Boolean(activeTag) || Boolean(activeCollection);
  // Links and unsorted saves are counted too, so these are "saves", not "places".
  const noun = (n: number) => (n === 1 ? "save" : "saves");

  const savedHeadline = isGuest
    ? "A sample collection"
    : narrowed
      ? `${items.length} of ${displayTotal} ${noun(displayTotal)} you kept`
      : `${displayTotal} ${noun(displayTotal)} you kept`;

  const clearNarrowing = () => {
    setActiveTag(null);
    setActiveCollection(null);
    setFilters(NO_FILTERS);
    setDraftFilters(NO_FILTERS);
    if (searchParams.get("q")) router.replace(pathname || "/collection");
  };

  const handleReadLink = async (explicit?: string) => {
    const raw = (explicit ?? linkInput).trim() || (looksLikeUrl(searchQuery) ? searchQuery.trim() : "");
    if (!raw || reading) return;
    // "Look at this https://..." (a whole share message) works as well as a bare link.
    const typed = looksLikeUrl(raw) ? raw : extractSharedUrl({ text: raw });
    if (!typed) {
      setError("That does not look like a link. Paste a full address starting with http.");
      return;
    }
    if (!requireLogin(typed)) return;
    // Same reel, different share tracking (?igsh=, ?si=) must save once.
    const url = canonicalLink(typed);
    if (url.length > MAX_LINK_LENGTH) {
      setError(`That link is longer than ${MAX_LINK_LENGTH} characters, so Rovvy cannot keep it. Open it and copy its short link instead.`);
      return;
    }
    setReading(true);
    setExtractResult(null);
    setSavedLink(null);
    setError(null);

    // Every link is kept first, whatever happens next (unreadable site, Instagram, a slow
    // read, a rate limit). The user never loses a link they pasted or shared.
    let kept: CollectionItem | null = null;
    try {
      kept = await createCollectionItem(linkOnlyBody(url, ""));
      setSavedLink(kept);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that link");
    }

    try {
      const result = await extractCollectionLink(url);
      setExtractResult({ ...result, link_saved: kept !== null || Boolean(result.link_saved) });
      // Give the saved link a real name once we know the title (only if it still has the URL name).
      const better = linkName(url, result.source_title);
      if (kept && better !== kept.name && kept.name === linkName(url, "")) {
        try {
          const renamed = await updateCollectionItem(kept.id, { name: better });
          setSavedLink(renamed);
          await load(true);
        } catch {
          /* the link is saved; a nicer name is optional */
        }
      }
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Could not read that link") +
          (kept ? " Your link is saved in Unsorted." : ""),
      );
    } finally {
      setReading(false);
    }
  };

  /** Tags and friends picked after the link was already saved. */
  const handleApplyToLink = async (tags: string[], friendIds: string[]): Promise<boolean> => {
    if (!savedLink) return false;
    try {
      if (tags.length > 0) await updateCollectionItem(savedLink.id, { tags });
      if (friendIds.length > 0) await shareCollectionItem(savedLink.id, friendIds);
      await load(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your saved link");
      return false;
    }
  };

  /** Save a candidate or a link-only entry. Returns the saved row (or the one already saved). */
  const handleSaveLinkItem = async (body: Parameters<typeof createCollectionItem>[0]): Promise<CollectionItem | null> => {
    if (!requireLogin()) return null;
    try {
      const saved = await createCollectionItem(body);
      await load(true);
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save place");
      return null;
    }
  };

  const handleShare = async (itemId: string, friendIds: string[]): Promise<boolean> => {
    try {
      await shareCollectionItem(itemId, friendIds);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send to your friends");
      return false;
    }
  };

  /** Phone share sheet opens /collection?q=<link>&shared=1: read it once, signed in. */
  useEffect(() => {
    if (autoRead.current || !user || searchParams.get("shared") !== "1") return;
    if (!looksLikeUrl(searchQuery)) return;
    autoRead.current = true;
    const link = searchQuery.trim();
    router.replace(pathname || "/collection");
    void handleReadLink(link);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchQuery]);

  /** iPhone has no share-sheet entry for web apps: copy the link, then tap this. */
  const handlePasteFromClipboard = async () => {
    setClipNote(null);
    try {
      const text = await navigator.clipboard.readText();
      const link = extractSharedUrl({ text });
      if (!link) {
        setClipNote("There is no link on your clipboard. Copy a link first.");
        return;
      }
      setLinkInput(link);
      await handleReadLink(link);
    } catch {
      setClipNote("Your browser did not let Rovvy read the clipboard. Press and hold in the box and choose Paste.");
    }
  };

  const handlePatch = async (id: string, patch: CollectionItemPatch): Promise<boolean> => {
    if (isDemoId(id)) return false;
    try {
      const saved = await updateCollectionItem(id, patch);
      setApiItems((list) => list.map((i) => (i.id === id ? saved : i)));
      await load(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your change");
      return false;
    }
  };

  const handleRemove = async (item: CollectionItem): Promise<void> => {
    if (isDemoId(item.id)) return;
    try {
      await deleteCollectionItem(item.id);
      setOpenCardId(null);
      setUndoStack((s) => [...s.filter((e) => e.until > Date.now()), { item, until: Date.now() + 8000 }]);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove place");
    }
  };

  const handleUndo = async () => {
    const item = undo;
    if (!item) return;
    setUndoStack((s) => s.slice(0, -1));
    try {
      await createCollectionItem(restoreBody(item));
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not put it back");
    }
  };

  const handleCreateCollection = async () => {
    const name = newCollName.trim();
    if (!name) return;
    try {
      const created = await createNamedCollection(name);
      setNewCollName("");
      setNewCollOpen(false);
      await load(true);
      setActiveCollection(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create collection");
    }
  };

  // Drop each removed save from the undo list when its 8 seconds are up.
  useEffect(() => {
    if (undoStack.length === 0) return;
    const wait = Math.max(0, Math.min(...undoStack.map((e) => e.until)) - Date.now());
    const t = setTimeout(() => setUndoStack((s) => s.filter((e) => e.until > Date.now())), wait + 20);
    return () => clearTimeout(t);
  }, [undoStack]);

  // A share that carried no web link is explained instead of silently dropped.
  useEffect(() => {
    if (searchParams.get("shared") === "none") {
      setClipNote("That share had no web link. Paste the link into the box, or type the place name.");
      router.replace(pathname || "/collection");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMap = view === "map";

  const renderCard = (item: CollectionItem) => {
                    const open = openCardId === item.id;
                    const demo = isDemoId(item.id);
                    const rating = demo ? COLLECTION_DEMO_RATING[item.id] : undefined;
                    const hours = demo ? COLLECTION_DEMO_HOURS[item.id] : undefined;
                    const from = formatSavedFrom(item.saved_from);
                    const link = sourceLink(item.saved_from);
                    return (
                      <div key={item.id} className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
                        <button
                          type="button"
                          className={styles.cardToggle}
                          aria-expanded={open}
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
                            {item.tags && item.tags.length > 0 ? (
                              <span className={styles.tagLine}>{item.tags.map((t) => `#${t}`).join(" ")}</span>
                            ) : null}
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
                            {demo ? null : (
                              <div className={styles.detailRow}>
                                <span className={`${styles.detailLabel} ${styles.mono}`}>Saved</span>
                                <span className={styles.detailValue}>{formatSavedWhen(item.created_at)}</span>
                              </div>
                            )}
                            {item.shared_by_name ? (
                              <div className={styles.detailRow}>
                                <span className={`${styles.detailLabel} ${styles.mono}`}>From</span>
                                <span className={styles.detailValue}>Shared by {item.shared_by_name}</span>
                              </div>
                            ) : null}
                            {from ? (
                              <div className={styles.detailRow}>
                                <span className={`${styles.detailLabel} ${styles.mono}`}>From</span>
                                <span className={styles.detailValue}>
                                  {link ? (
                                    <a className={styles.sourceLink} href={link.href} target="_blank" rel="noopener noreferrer">
                                      {link.label}
                                    </a>
                                  ) : (
                                    from
                                  )}
                                </span>
                              </div>
                            ) : null}
                            {demo ? (
                              item.note ? (
                                <div style={{ marginTop: 10 }}>
                                  <div className={styles.noteHeader}>
                                    <span className={`${styles.noteLabel} ${styles.mono}`}>Note</span>
                                  </div>
                                  <div className={styles.noteBox}>{item.note}</div>
                                </div>
                              ) : null
                            ) : (
                              <CollectionCardEditor
                                key={item.id}
                                item={item}
                                collections={collections}
                                friends={friends}
                                friendsUnavailable={friendsFailed}
                                onShare={handleShare}
                                onPatch={handlePatch}
                                onRemove={handleRemove}
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
  };


  return (
    <div className={styles.page}>
      <div className={styles.heroRow}>
        <div>
          <div className={`${styles.eyebrow} ${styles.mono}`}>Collection</div>
          <h1 className={`${styles.title} ${styles.serif}`}>{savedHeadline}</h1>
          <p className={styles.subtitle}>
            {isGuest
              ? "These are sample places so you can see how it works. Sign in to keep your own."
              : "Places you saved from Explore, Live and links."}
          </p>
        </div>
        <div className={styles.toolbar}>
          <button
            type="button"
            ref={filterBtnRef}
            className={`${styles.filterBtn} ${filterCount ? styles.filterBtnActive : ""}`}
            aria-haspopup="dialog"
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
              aria-pressed={view === "grid"}
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
              aria-pressed={view === "map"}
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
              Paste a link
            </div>
            <div className={`${styles.pasteTitle} ${styles.serif}`}>
              A YouTube video or a web article. We find the places in it.
            </div>
            <p className={styles.pasteNote}>
              Rovvy reads the public page or video description to find places. Instagram and TikTok posts are not read; you can keep their link in Unsorted.
            </p>
          </div>
        </div>
        <div className={styles.pasteInputRow}>
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleReadLink();
            }}
            placeholder="Paste a link"
            aria-label="Paste a link to extract a place"
          />
          <button type="button" className={styles.readBtn} disabled={reading} onClick={() => void handleReadLink()}>
            {reading ? "Reading…" : extractResult ? "Read again" : "Read it"}
          </button>
          <button type="button" className={styles.filterBtn} disabled={reading} onClick={() => void handlePasteFromClipboard()}>
            Paste copied link
          </button>
        </div>
        {clipNote ? (
          <p className={styles.candidateHint} role="status">
            {clipNote}
          </p>
        ) : null}
        {extractResult ? (
          <CollectionLinkResult
            key={extractResult.source_url ?? extractResult.source_title}
            result={extractResult}
            url={linkInput.trim() || searchQuery.trim()}
            friends={friends}
            friendsUnavailable={friendsFailed}
            onSave={handleSaveLinkItem}
            onShare={handleShare}
            onApplyToLink={handleApplyToLink}
          />
        ) : null}
      </div>

      <div className={styles.groupBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`${styles.mono} ${styles.eyebrow}`} style={{ marginBottom: 0 }}>Group by</span>
          <div className={styles.groupToggle}>
            <button
              type="button"
              aria-pressed={groupMode === "city"}
              className={groupMode === "city" ? styles.groupToggleActive : undefined}
              onClick={() => setGroupMode("city")}
            >
              City
            </button>
            <button
              type="button"
              aria-pressed={groupMode === "category"}
              className={groupMode === "category" ? styles.groupToggleActive : undefined}
              onClick={() => setGroupMode("category")}
            >
              Category
            </button>
          </div>
        </div>
        <span className={styles.groupHint}>
          {groupMode === "city" ? "Grouped by city" : "Grouped by category, every city mixed together"}
        </span>
      </div>

      {!isGuest ? (
        <>
          <div className={styles.collectionBar} role="group" aria-label="Collections">
            <button
              type="button"
              aria-pressed={activeCollection === null}
              className={`${styles.chip} ${activeCollection === null ? styles.chipActive : ""}`}
              onClick={() => setActiveCollection(null)}
            >
              All saves
            </button>
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={activeCollection === c.id}
                className={`${styles.chip} ${activeCollection === c.id ? styles.chipActive : ""}`}
                onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}
              >
                {c.name}
              </button>
            ))}
            <button type="button" className={styles.newCollectionBtn} onClick={() => setNewCollOpen((v) => !v)}>
              New collection
            </button>
          </div>
          {(facets.tags ?? []).length > 0 ? (
            <div className={styles.collectionBar} role="group" aria-label="Tags">
              {(facets.tags ?? []).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={activeTag === t}
                  className={`${styles.chip} ${activeTag === t ? styles.chipActive : ""}`}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          ) : null}
          {newCollOpen ? (
            <form
              className={styles.newCollForm}
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateCollection();
              }}
            >
              <input
                autoFocus
                value={newCollName}
                maxLength={120}
                placeholder="Collection name"
                aria-label="Collection name"
                onChange={(e) => setNewCollName(e.target.value)}
              />
              <button type="submit" className={styles.readBtn} disabled={!newCollName.trim()}>
                Create
              </button>
              <button type="button" className={styles.filterBtn} onClick={() => setNewCollOpen(false)}>
                Cancel
              </button>
            </form>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div role="alert" className={styles.errorBox}>
          <span>{error}</span>
          {user ? (
            <button type="button" className={styles.readBtn} onClick={() => void load()}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {(!isGuest && loading) || (!user && userLoading) ? (
        <p className={styles.subtitle}>Loading your saves…</p>
      ) : !isGuest && error && apiItems.length === 0 ? null : showMap ? (
        <div className={styles.mapShell}>
          <div className={styles.mapGrid} />
          {Object.entries(shownCityCounts).map(([city, count], index) => {
            const pos = MAP_PIN_POSITIONS[city] ?? {
              left: `${15 + ((index * 17) % 70)}%`,
              top: `${20 + ((index * 13) % 60)}%`,
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
            {items.length} {items.length === 1 ? "save" : "saves"} across {Object.keys(shownCityCounts).length} cities. Pin positions are
            illustrative.
          </div>
        </div>
      ) : (
        <div className={styles.gridPop}>
          {isGuest ? (
            <div className={styles.sampleBanner}>
              <span className={styles.mono}>Sample</span>
              <span>Example places, not yours.</span>
              <button type="button" className={styles.readBtn} onClick={() => router.push(loginNext())}>
                Sign in to save your own
              </button>
            </div>
          ) : null}

          {unsortedItems.length > 0 ? (
            <section className={styles.section} aria-label="Unsorted saves">
              <div className={styles.sectionHead}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`${styles.sectionTitle} ${styles.serif}`}>Unsorted</span>
                  <span className={`${styles.countPill} ${styles.mono}`}>{unsortedItems.length}</span>
                </span>
                <span className={`${styles.sectionMeta} ${styles.mono}`}>Needs a look</span>
              </div>
              <p className={styles.unsortedHint}>
                Saved links, places friends sent you and places we could not confirm wait here. Open one to file it or remove it.
              </p>
              <div className={styles.grid}>{unsortedItems.map((item) => renderCard(item))}</div>
            </section>
          ) : null}

          {sections.length === 0 ? (
            narrowed ? (
              <div className={styles.emptyState}>
                <h2 className={styles.serif} style={{ fontSize: 24, marginBottom: 8 }}>No saves match</h2>
                <p className={styles.subtitle} style={{ margin: "0 auto 14px" }}>
                  Nothing you kept fits the current filter, search, tag or collection.
                </p>
                <button type="button" className={styles.readBtn} onClick={clearNarrowing}>
                  Clear filters
                </button>
              </div>
            ) : activeCollection ? (
              <div className={styles.emptyState}>
                <h2 className={styles.serif} style={{ fontSize: 24, marginBottom: 8 }}>This collection is empty</h2>
                <p className={styles.subtitle} style={{ margin: "0 auto" }}>
                  Open any save and pick this collection in its Collection menu.
                </p>
              </div>
            ) : unsortedItems.length > 0 ? null : (
              <div className={styles.emptyState}>
                <h2 className={styles.serif} style={{ fontSize: 24, marginBottom: 8 }}>Nothing saved yet</h2>
                <p className={styles.subtitle} style={{ margin: "0 auto" }}>
                  Save a place from Live or Explore and it will show up here.
                </p>
              </div>
            )
          ) : (
            sections.map((section) => (
              <section key={section.title} className={styles.section}>
                <div className={styles.sectionHead}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`${styles.sectionTitle} ${styles.serif}`}>{section.title}</span>
                    <span className={`${styles.countPill} ${styles.mono}`}>{section.count}</span>
                  </span>
                  <span className={`${styles.sectionMeta} ${styles.mono}`}>{section.meta}</span>
                </div>
                <div className={styles.grid}>
                  {section.items.map((item) => renderCard(item))}
                </div>
              </section>
            ))
          )}

        </div>
      )}

      {undo ? (
        <div className={styles.undoToast} role="status">
          <span>Removed {undo.name}.</span>
          <button type="button" onClick={() => void handleUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {filterOpen ? (
        <div className={styles.modalBackdrop} onClick={() => setFilterOpen(false)} role="presentation">
          <div
            ref={dialogRef}
            tabIndex={-1}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-filter-title"
          >
            <div style={{ marginBottom: 16 }}>
              <div className={`${styles.eyebrow} ${styles.mono}`}>Filter</div>
              <div id="collection-filter-title" className={styles.serif} style={{ fontSize: 22 }}>
                Narrow it down
              </div>
            </div>

            <div className={`${styles.eyebrow} ${styles.mono}`}>Country</div>
            <div className={styles.chipRow}>
              {["Any", ...displayFacets.countries].map((value) => (
                <button
                  key={`country-${value}`}
                  type="button"
                  aria-pressed={draftFilters.country === value}
                  className={`${styles.chip} ${draftFilters.country === value ? styles.chipActive : ""}`}
                  onClick={() => setDraftFilters((f) => ({ ...f, country: value, city: "Any" }))}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className={`${styles.eyebrow} ${styles.mono}`}>City</div>
            <div className={styles.chipRow}>
              {[
                "Any",
                ...displayFacets.cities.filter(
                  (c) => draftFilters.country === "Any" || isGuest || cityToCountry.get(c) === draftFilters.country,
                ),
              ].map((value) => (
                <button
                  key={`city-${value}`}
                  type="button"
                  aria-pressed={draftFilters.city === value}
                  className={`${styles.chip} ${draftFilters.city === value ? styles.chipActive : ""}`}
                  onClick={() => setDraftFilters((f) => ({ ...f, city: value }))}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className={`${styles.eyebrow} ${styles.mono}`}>Category</div>
            <div className={styles.chipRow}>
              {["Any", ...displayFacets.categories].map((value) => (
                <button
                  key={`cat-${value}`}
                  type="button"
                  aria-pressed={draftFilters.category === value}
                  className={`${styles.chip} ${draftFilters.category === value ? styles.chipActive : ""}`}
                  onClick={() => setDraftFilters((f) => ({ ...f, category: value }))}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.filterBtn} onClick={() => setDraftFilters(NO_FILTERS)}>
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
                {activeFilterCount(draftFilters) === 0 ? "Show everything" : "Apply filters"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
