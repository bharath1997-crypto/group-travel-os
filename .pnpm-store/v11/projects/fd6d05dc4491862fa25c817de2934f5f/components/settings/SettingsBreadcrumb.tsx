"use client";

/**
 * SettingsBreadcrumb
 *
 * Reusable breadcrumb for all Rovvy Settings subpages and global legal pages.
 *
 * Usage:
 *   <SettingsBreadcrumb crumbs={[
 *     { label: "Profile", href: "/profile" },
 *     { label: "Settings", href: "/settings" },
 *     { label: "Support & Legal", href: "/settings/support-legal" },
 *     { label: "Cookie Policy" },   // last item: no href → aria-current="page"
 *   ]} />
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  /** Visible label for this crumb. */
  label: string;
  /**
   * If provided the crumb is rendered as a link.
   * The last crumb in the array should omit href — it is treated as the
   * current page and rendered with aria-current="page".
   */
  href?: string;
}

interface SettingsBreadcrumbProps {
  crumbs: BreadcrumbItem[];
  /** Extra className for the wrapping <nav>. */
  className?: string;
}

export function SettingsBreadcrumb({ crumbs, className = "" }: SettingsBreadcrumbProps) {
  if (!crumbs || crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`px-4 py-2.5 ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[11px] leading-none">
        {crumbs.map((crumb, index) => {
          const isFirst = index === 0;
          const isLast  = index === crumbs.length - 1;

          return (
            <li key={index} className="flex items-center gap-x-0.5">
              {/* Separator chevron — not before the first item */}
              {!isFirst && (
                <ChevronRight
                  size={9}
                  strokeWidth={2.5}
                  className="shrink-0 text-border"
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                <span
                  aria-current="page"
                  className="font-semibold text-text"
                >
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-muted transition-colors hover:text-text focus:outline-none focus-visible:underline focus-visible:decoration-primary"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Preset crumb builders ─────────────────────────────────────────────────────
// Call these helpers from page files to keep the crumb arrays DRY.

const PROFILE: BreadcrumbItem = { label: "Profile", href: "/profile" };
const SETTINGS: BreadcrumbItem = { label: "Settings", href: "/settings" };

const HUB: Record<string, BreadcrumbItem> = {
  "account-security":       { label: "Account & Security",       href: "/settings/account-security" },
  "privacy-safety":         { label: "Privacy & Safety",         href: "/settings/privacy-safety" },
  "trips-travel":           { label: "Trips & Travel",           href: "/settings/trips-travel" },
  "maps-trip-live":         { label: "Maps & Trip LIVE",         href: "/settings/maps-trip-live" },
  "content-discovery":      { label: "Content & Discovery",      href: "/settings/content-discovery" },
  "wayra-ai":               { label: "Wayra AI",                 href: "/settings/wayra-ai" },
  "messages-notifications": { label: "Messages & Notifications", href: "/settings/messages-notifications" },
  "data-integrations":      { label: "Data & Integrations",      href: "/settings/data-integrations" },
  "app-preferences":        { label: "App Preferences",          href: "/settings/app-preferences" },
  "support-legal":          { label: "Support & Legal",          href: "/settings/support-legal" },
  "account":                { label: "Accounts Center",          href: "/settings/account" },
};

/** Profile > Settings */
export const CRUMBS_SETTINGS = [PROFILE, { label: "Settings" }];

/** Profile > Settings > [Hub] */
export function hubCrumbs(hubKey: keyof typeof HUB): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, { label: HUB[hubKey].label }];
}

/** Profile > Settings > [Hub] > [Current Page] */
export function nestedCrumbs(hubKey: keyof typeof HUB, pageLabel: string): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, HUB[hubKey], { label: pageLabel }];
}

/** Profile > Settings > Data & Integrations > [Current Page] */
export function dataCrumbs(pageLabel: string): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, HUB["data-integrations"], { label: pageLabel }];
}

/**
 * Profile > Settings > Data & Integrations > [Mid Hub] > [Current Page]
 * Used when there's a sub-hub inside Data & Integrations (e.g. Google hub).
 */
export function dataSubCrumbs(midHub: BreadcrumbItem, pageLabel: string): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, HUB["data-integrations"], midHub, { label: pageLabel }];
}

/** Profile > Settings > Support & Legal > [Legal Page] — for global legal routes */
export function legalCrumbs(pageLabel: string): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, HUB["support-legal"], { label: pageLabel }];
}

/** Profile > Settings > [Current Page] — direct Settings subpage with no hub in nav chain */
export function settingsSubCrumbs(pageLabel: string): BreadcrumbItem[] {
  return [PROFILE, SETTINGS, { label: pageLabel }];
}
