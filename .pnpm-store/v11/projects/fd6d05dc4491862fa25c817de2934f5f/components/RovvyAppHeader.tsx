"use client";



import Link from "next/link";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CarFront } from "lucide-react";
import { SeatsNotifyBell } from "@/app/(dashboard)/seats/SeatsNotifyBell";
import { useCallback, useEffect, useState, type ReactNode } from "react";



import { RovvyLogo } from "@/components/RovvyLogo";

import { useDashboardUser } from "@/contexts/dashboard-user-context";

import styles from "./RovvyAppHeader.module.css";



type MainTabDef = {
  id: string;
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: ReactNode;
  liveDot?: boolean;
};

const TABS: MainTabDef[] = [

  {

    id: "explore",

    href: "/explore",

    label: "Explore",

    match: (path: string) => path === "/explore" || path.startsWith("/explore/"),

    icon: (

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

        <circle cx="12" cy="12" r="9" />

        <path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />

      </svg>

    ),

  },

  {

    id: "live",

    href: "/live",

    label: "Live",

    match: (path: string) => path === "/live" || path.startsWith("/live/"),

    liveDot: true,

    icon: (

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

        <circle cx="12" cy="12" r="2.2" />

        <path d="M7.8 7.8a6 6 0 000 8.4M16.2 16.2a6 6 0 000-8.4M4.9 4.9a10 10 0 000 14.2M19.1 19.1a10 10 0 000-14.2" />

      </svg>

    ),

  },

  {

    id: "seatShare",

    href: "/seats",

    label: "SeatShare",

    match: (path: string) => path === "/seats" || path.startsWith("/seats/"),

    icon: (

      <CarFront width={17} height={17} strokeWidth={1.7} aria-hidden />

    ),

  },

  {

    id: "collection",

    href: "/collection",

    label: "Collection",

    match: (path: string) =>

      path === "/collection" ||

      path.startsWith("/collection/"),

    icon: (

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

        <path d="M6 3.5h12v17l-6-3.4-6 3.4z" />

      </svg>

    ),

  },

  {

    id: "splits",

    href: "/split-activities",

    label: "Splits",

    match: (path: string) => path.startsWith("/split-activities"),

    icon: (

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

        <path d="M4 5h11a5 5 0 010 10H8" />

        <path d="M11 12l-3 3 3 3" />

        <circle cx="19" cy="19" r="2" />

      </svg>

    ),

  },

];



function profileInitials(name: string | undefined): string {

  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();

}



/** Global Explore-style top bar — same type, pill tabs, and actions on every dashboard page. */

export function RovvyAppHeader() {

  const pathname = usePathname() ?? "/explore";

  const router = useRouter();

  const searchParams = useSearchParams();

  const { user } = useDashboardUser();

  const next = encodeURIComponent(pathname || "/explore");

  const isCollection =

    pathname === "/collection" || pathname.startsWith("/collection/");

  const isSeatShare = pathname === "/seats" || pathname.startsWith("/seats/");

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");



  useEffect(() => {

    setSearchQuery(searchParams.get("q") ?? "");

  }, [searchParams]);



  const pushSearch = useCallback(

    (value: string) => {

      const params = new URLSearchParams(searchParams.toString());

      const trimmed = value.trim();

      if (trimmed) params.set("q", trimmed);

      else params.delete("q");

      const qs = params.toString();

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    },

    [pathname, router, searchParams],

  );



  return (

    <div className={styles.bar}>

      <Link href="/explore" className={styles.logoLink}>

        <RovvyLogo variant="primary" size="lg" />

      </Link>



      {isCollection ? (

        <div className={styles.searchWrap}>

          <input

            type="search"

            value={searchQuery}

            onChange={(e) => setSearchQuery(e.target.value)}

            onKeyDown={(e) => {

              if (e.key === "Enter") pushSearch(searchQuery);

            }}

            placeholder="Search your saves, or paste a reel link"

            aria-label="Search your collection"

          />

          <button

            type="button"

            className={styles.searchBtn}

            aria-label="Search"

            onClick={() => pushSearch(searchQuery)}

          >

            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>

              <circle cx="11" cy="11" r="6.5" />

              <path d="M16 16l4 4" />

            </svg>

          </button>

        </div>

      ) : null}



      <nav aria-label="Primary">

        {TABS.map((tab) => {

          const active = tab.match(pathname);

          return (

            <Link key={tab.id} href={tab.href} className={active ? styles.active : undefined}>

              {tab.icon}

              {tab.label}

              {tab.liveDot ? <i /> : null}

            </Link>

          );

        })}

      </nav>

      <aside>

        {isSeatShare ? <SeatsNotifyBell /> : null}

        {user ? (

          <Link href="/profile" className={styles.profileAvatar} title="Profile">

            {profileInitials(user.full_name)}

          </Link>

        ) : (

          <Link href={`/login?next=${next}`}>Log in</Link>

        )}

        {!user ? (

          <Link href={`/register?next=${next}`} className={styles.signUp}>

            Sign up

          </Link>

        ) : null}

      </aside>

    </div>

  );

}


