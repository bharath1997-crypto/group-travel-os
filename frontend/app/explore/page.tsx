"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  Map,
  DollarSign,
} from "lucide-react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { HeaderProfileMenu } from "@/components/HeaderProfileMenu";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatPrice,
  sourceLabel,
  type ExploreEvent,
  type ExploreSections,
  hydrateSectionsFromResponse,
  EXPLORE_FETCH_TIMEOUT_MS,
} from "@/lib/explore-events";
import { ExplorerItemDetailDrawer, type ExplorerDrawerItem } from "@/components/explorer/ExplorerItemDetailDrawer";

import { ExplorerHero } from "@/components/explorer/ExplorerHero";
import { ExplorerCategoryGrid } from "@/components/explorer/ExplorerCategoryGrid";
import { ExplorerCarousel } from "@/components/explorer/ExplorerCarousel";
import { ExplorerDestinationCard } from "@/components/explorer/ExplorerDestinationCard";
import {
  ExplorerExperienceCard,
  ExplorerExperienceCardSkeleton,
  type ExplorerItem,
} from "@/components/explorer/ExplorerExperienceCard";
import { WayraDiscoveryCard } from "@/components/explorer/WayraDiscoveryCard";
import { MoreToExploreGrid } from "@/components/explorer/MoreToExploreGrid";
import { WhyChooseRovvy } from "@/components/explorer/WhyChooseRovvy";
import { ExploreTags } from "@/components/explorer/ExploreTags";

// ─── Constants ──────────────────────────────────────────────────────────────

const CITIES = [
  { name: "Chicago", count: "120+ Activities", image: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=400&fit=crop&q=60" },
  { name: "New York", count: "350+ Activities", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&fit=crop&q=60" },
  { name: "Los Angeles", count: "210+ Activities", image: "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=400&fit=crop&q=60" },
  { name: "Miami", count: "95+ Activities", image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&fit=crop&q=60" },
  { name: "Las Vegas", count: "180+ Activities", image: "https://images.unsplash.com/photo-1522083165195-3427502977a1?w=400&fit=crop&q=60" },
  { name: "San Francisco", count: "140+ Activities", image: "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=400&fit=crop&q=60" },
  { name: "Orlando", count: "80+ Activities", image: "https://images.unsplash.com/photo-1597466765990-64ad1c35dafc?w=400&fit=crop&q=60" },
  { name: "Seattle", count: "110+ Activities", image: "https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=400&fit=crop&q=60" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  google_picture?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eventToExplorerItem(event: ExploreEvent): ExplorerItem {
  const isFree = event.price_min === 0 && event.price_max === 0;
  let emoji = "🎟️";
  const cat = (event.category || "").toLowerCase();
  if (cat.includes("music") || cat.includes("concert")) emoji = "🎵";
  else if (cat.includes("sport")) emoji = "⚽";
  else if (cat.includes("food") || cat.includes("dine")) emoji = "🍔";
  else if (cat.includes("night")) emoji = "🍸";
  else if (cat.includes("park") || cat.includes("outdoor")) emoji = "🌲";
  else if (cat.includes("comedy")) emoji = "🎭";
  else if (cat.includes("art") || cat.includes("theater")) emoji = "🎨";

  return {
    id: event.id,
    title: event.name,
    category: event.category,
    city: event.city,
    venue: event.venue,
    dateLabel: formatDateTime(event),
    imageUrl: event.image_url,
    priceLabel: formatPrice(event),
    isFree,
    source: event.source,
    sourceType: event.source,
    emoji,
    ticketUrl: event.ticket_url,
  };
}

function itemToDrawerItem(item: ExplorerItem): ExplorerDrawerItem {
  return {
    id: item.id,
    title: item.title,
    source: sourceLabel(item.source),
    venue: item.venue ?? "",
    city: item.city ?? "",
    dateLabel: item.dateLabel ?? "",
    priceLabel: item.priceLabel ?? "",
    description: item.venue ?? "A curated experience selected for your trip.",
    emoji: item.emoji ?? "🎟️",
    imageUrl: item.imageUrl,
    sourceUrl: item.ticketUrl ?? null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const router = useRouter();
  const wayraRef = useRef<HTMLDivElement>(null);

  const [selectedCity, setSelectedCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [sections, setSections] = useState<ExploreSections | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<ExplorerDrawerItem | null>(null);

  // Auth
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);
    apiFetch<UserProfile>("/auth/me").then(setUserProfile).catch(() => {});
    apiFetch<{ count: number }>("/notifications/unread-count")
      .then((r) => setUnreadNotifCount(r.count))
      .catch(() => {});
    apiFetch<{ count: number }>("/cart/count")
      .then((r) => setCartCount(Math.max(0, Math.floor(r.count))))
      .catch(() => {});
  }, []);

  // Events
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{
      trending?: ExploreEvent[];
      events?: ExploreEvent[];
      weekend?: ExploreEvent[];
      popular?: ExploreEvent[];
      national?: ExploreEvent[];
    }>(
      `/explore/events?city=${encodeURIComponent(selectedCity)}&view=hub`,
      {},
      EXPLORE_FETCH_TIMEOUT_MS,
    )
      .then((data) => {
        if (!active) return;
        const { sections: s } = hydrateSectionsFromResponse(data);
        setSections(s);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setSections({ trending: [], weekend: [], popular: [], national: [] });
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [selectedCity]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const triggerAuthGuard = (message: string, targetPath: string) => {
    if (!isLoggedIn) {
      showToast(message);
      setTimeout(() => router.push(`/login?redirect=${encodeURIComponent(targetPath)}`), 2000);
    } else {
      router.push(targetPath);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleLogout = () => {
    router.push("/logout");
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/explore/events?q=${encodeURIComponent(searchQuery)}&city=${encodeURIComponent(selectedCity)}`);
    }
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.");
      return;
    }
    showToast("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      () => showToast("Location detected! Showing nearby results."),
      () => showToast("Location access denied. Enable it in your browser settings."),
    );
  };

  const handleAskWayra = (prompt?: string) => {
    if (prompt) {
      wayraRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      triggerAuthGuard("Sign in to chat with Wayra AI", "/trips");
    }
  };

  const handleItemOpen = (item: ExplorerItem) => {
    setSelectedDrawerItem(itemToDrawerItem(item));
  };

  const handleSave = () => triggerAuthGuard("Sign in to save places", "/trips");
  const handleAddToTrip = () => triggerAuthGuard("Sign in to add to a trip", "/trips");
  const handleVote = () => triggerAuthGuard("Sign in to vote", "/trips");

  // ─── Derived Data ──────────────────────────────────────────────────────────

  const trending = useMemo(() => {
    if (!sections?.trending.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections.trending.slice(0, 10);
    return sections.trending.filter(
      (ev) =>
        ev.name?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.category?.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [sections?.trending, searchQuery]);

  const weekend = useMemo(() => (sections?.weekend ?? []).slice(0, 10), [sections?.weekend]);
  const popular = useMemo(() => (sections?.popular ?? []).slice(0, 10), [sections?.popular]);

  const SKELETON_COUNT = 5;

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans pb-16">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 overflow-visible bg-white border-b border-stone-200 shadow-sm select-none">
        <div className="flex h-16 items-center gap-3 overflow-visible px-3 md:gap-4 md:px-6">
          <Link
            href="/explore"
            className="flex shrink-0 items-center overflow-visible focus-visible:outline-none"
          >
            <RovvyLogo variant="primary" height={76} className="md:hidden" />
            <RovvyLogo variant="primary" height={96} className="hidden md:block" />
          </Link>

          <div className="min-w-0 flex-1" />

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <nav
              className="hidden md:flex items-center gap-0.5 lg:gap-1"
              aria-label="Primary"
            >
              <Link
                href="/explore"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 lg:px-3 text-xs lg:text-[13px] font-semibold whitespace-nowrap text-[#0F766E] bg-[#F0FDF9] ring-1 ring-[#CCFBF1]"
              >
                <Compass size={15} strokeWidth={2} />
                <span>Explore</span>
              </Link>
              <Link
                href="/trips"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 lg:px-3 text-xs lg:text-[13px] font-semibold whitespace-nowrap text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-all"
              >
                <Map size={15} strokeWidth={2} />
                <span>Trips</span>
              </Link>
              <Link
                href="/live"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 lg:px-3 text-xs lg:text-[13px] font-semibold whitespace-nowrap text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-all"
              >
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span>LIVE</span>
              </Link>
              <Link
                href="/split-activities"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 lg:px-3 text-xs lg:text-[13px] font-semibold whitespace-nowrap text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-all"
              >
                <DollarSign size={15} strokeWidth={2} />
                <span>Split Activities</span>
              </Link>
            </nav>

            {isLoggedIn ? (
              <>
                <div className="hidden md:block h-6 w-px bg-stone-200" />
                <HeaderProfileMenu
                  displayName={userProfile?.full_name}
                  avatarUrl={userProfile?.avatar_url || userProfile?.google_picture}
                  cartCount={cartCount}
                  notifCount={unreadNotifCount}
                  onLogout={handleLogout}
                />
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/login"
                  className="text-stone-600 hover:text-[#0F766E] text-sm font-semibold px-2 sm:px-3 py-2"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="bg-[#0F766E] hover:bg-[#0D635C] text-white text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pt-16" />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <ExplorerHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        onSearch={handleSearch}
        onNearMe={handleNearMe}
        onAskWayra={() => handleAskWayra()}
      />

      {/* ── 2. CATEGORY GRID ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <ExplorerCategoryGrid />
      </section>

      {/* ── 3. RECOMMENDED FOR YOU ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <ExplorerCarousel
          title="Recommended for you"
          subtitle={`Trending events and experiences in ${selectedCity} this week.`}
          seeAllHref="/explore/events"
        >
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <ExplorerExperienceCardSkeleton key={i} />
              ))
            : trending.length === 0
            ? (
              <div className="w-full py-12 px-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 text-sm font-medium text-center">
                No trending events found in {selectedCity}. Try a different city.
              </div>
            )
            : trending.map((ev) => {
                const item = eventToExplorerItem(ev);
                return (
                  <ExplorerExperienceCard
                    key={item.id}
                    item={item}
                    onOpen={handleItemOpen}
                    onSave={handleSave}
                    onAddToTrip={handleAddToTrip}
                    onVote={handleVote}
                  />
                );
              })}
        </ExplorerCarousel>
      </section>

      {/* ── 4. WHERE TO NEXT ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <ExplorerCarousel
          title="Where to next?"
          subtitle="Explore activities in our most popular group destinations."
          rightSlot={
            <span className="text-xs text-slate-400 font-medium">
              {CITIES.length} cities
            </span>
          }
        >
          {CITIES.map((city) => (
            <ExplorerDestinationCard
              key={city.name}
              name={city.name}
              count={city.count}
              image={city.image}
              onClick={() => setSelectedCity(city.name)}
            />
          ))}
        </ExplorerCarousel>
      </section>

      {/* ── 5. THIS WEEKEND ─────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <ExplorerCarousel
          title="This weekend"
          subtitle="Upcoming events and activities happening soon."
          seeAllHref="/explore/events"
          seeAllLabel="See all events"
        >
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <ExplorerExperienceCardSkeleton key={i} />
              ))
            : weekend.length === 0
            ? (
              <div className="flex flex-col items-center justify-center w-full py-12 px-8 border-2 border-dashed border-slate-200 rounded-3xl text-center gap-3">
                <span className="text-4xl">📅</span>
                <p className="text-slate-500 font-semibold text-sm">No weekend events loaded yet</p>
                <p className="text-slate-400 text-xs font-medium max-w-xs">
                  Check back soon — events are refreshed daily from Ticketmaster and Eventbrite.
                </p>
                <Link
                  href="/explore/events"
                  className="mt-1 text-[#0F766E] font-bold text-xs hover:text-[#0D635C] underline underline-offset-2"
                >
                  Browse all events →
                </Link>
              </div>
            )
            : weekend.map((ev) => {
                const item = eventToExplorerItem(ev);
                return (
                  <ExplorerExperienceCard
                    key={item.id}
                    item={item}
                    onOpen={handleItemOpen}
                    onSave={handleSave}
                    onAddToTrip={handleAddToTrip}
                    onVote={handleVote}
                  />
                );
              })}
        </ExplorerCarousel>
      </section>

      {/* ── 6. POPULAR ACTIVITIES ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <ExplorerCarousel
          title="Popular activities"
          subtitle="Top-rated places and experiences picked for your group."
          seeAllHref="/explore/activities"
        >
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <ExplorerExperienceCardSkeleton key={i} />
              ))
            : popular.length === 0
            ? (
              <div className="flex flex-col items-center justify-center w-full py-12 px-8 border-2 border-dashed border-slate-200 rounded-3xl text-center gap-3">
                <span className="text-4xl">🎯</span>
                <p className="text-slate-500 font-semibold text-sm">Activities loading soon</p>
                <p className="text-slate-400 text-xs font-medium max-w-xs">
                  OSM places and cached activities refresh periodically. Try again shortly.
                </p>
                <Link
                  href="/explore/activities"
                  className="mt-1 text-[#0F766E] font-bold text-xs hover:text-[#0D635C] underline underline-offset-2"
                >
                  Browse activities →
                </Link>
              </div>
            )
            : popular.map((ev) => {
                const item = eventToExplorerItem(ev);
                return (
                  <ExplorerExperienceCard
                    key={item.id}
                    item={item}
                    onOpen={handleItemOpen}
                    onSave={handleSave}
                    onAddToTrip={handleAddToTrip}
                    onVote={handleVote}
                  />
                );
              })}
        </ExplorerCarousel>
      </section>

      {/* ── 7. WAYRA AI DISCOVERY ───────────────────────────────────────────── */}
      <section ref={wayraRef} className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <WayraDiscoveryCard onAskWayra={handleAskWayra} />
      </section>

      {/* ── 8. MORE TO EXPLORE ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-100">
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            More to explore on Rovvy
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Everything you need for seamless group travel.
          </p>
        </div>
        <MoreToExploreGrid
          onCreateTrip={() => triggerAuthGuard("Sign in to create a trip", "/trips")}
          onOpenMap={() => triggerAuthGuard("Sign in to open the map", "/map")}
          onSplitCosts={() => triggerAuthGuard("Sign in to split costs", "/splits")}
        />
      </section>

      {/* ── 9. WHY CHOOSE ROVVY ─────────────────────────────────────────────── */}
      <WhyChooseRovvy />

      {/* ── 10. EXPLORE TAGS ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <ExploreTags />
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="max-w-7xl mx-auto px-6 pt-12 pb-8 border-t border-slate-100 text-slate-500 text-xs">
        <div className="grid gap-8 sm:grid-cols-4 mb-12 select-none">
          <div className="space-y-4">
            <RovvyLogo variant="primary" size="md" />
            <p className="text-slate-400 leading-relaxed font-medium">
              Roam together. Keep groups synced, itineraries simple, and memories beautiful.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3 text-sm">Destinations</h4>
            <ul className="space-y-2 font-medium">
              {["Chicago", "New York", "Los Angeles", "Miami"].map((city) => (
                <li key={city}>
                  <button onClick={() => setSelectedCity(city)} className="hover:text-[#0F766E] transition-colors">
                    {city}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3 text-sm">Products</h4>
            <ul className="space-y-2 font-medium">
              <li><Link href="/trips" className="hover:text-[#0F766E] transition-colors">Trip Planner</Link></li>
              <li><Link href="/map" className="hover:text-[#0F766E] transition-colors">Shared Map</Link></li>
              <li><Link href="/splits" className="hover:text-[#0F766E] transition-colors">Cost Splitter</Link></li>
              <li><Link href="/explore" className="hover:text-[#0F766E] transition-colors">Explorer Hub</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3 text-sm">Company</h4>
            <ul className="space-y-2 font-medium">
              <li><span className="hover:text-[#0F766E] cursor-pointer">About Us</span></li>
              <li><span className="hover:text-[#0F766E] cursor-pointer">Careers</span></li>
              <li><span className="hover:text-[#0F766E] cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-[#0F766E] cursor-pointer">Terms of Service</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-medium text-slate-400">
          <span>&copy; {new Date().getFullYear()} Rovvy Inc. All rights reserved.</span>
          <span>Made with love for group adventurers.</span>
        </div>
      </footer>

      {/* ── ITEM DETAIL DRAWER ──────────────────────────────────────────────── */}
      <ExplorerItemDetailDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        onToast={(msg) => {
          showToast(msg);
          if (!isLoggedIn && (msg.includes("Failed") || msg.includes("not available"))) {
            triggerAuthGuard("Sign in to save places", "/login");
          }
        }}
      />

      {/* ── FLOATING TOAST ──────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
