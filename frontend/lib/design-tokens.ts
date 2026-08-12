/**
 * Rovvy semantic design tokens — single source for UI consistency.
 * Prefer Tailwind utilities mapped in globals.css (@theme) or these exports.
 */

export const ROVVY_COLORS = {
  primary: "#0F766E",
  primaryHover: "#0D635C",
  primarySoft: "#CCFBF1",
  navy: "#0F172A",
  surface: "#1E293B",
  appBg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textOnDark: "#F8FAFC",
  muted: "#94A3B8",
  border: "#E2E8F0",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#0F766E",
  overlay: "rgba(15, 23, 42, 0.45)",
} as const;

export const ROVVY_RADIUS = {
  control: "0.75rem",
  card: "1.25rem",
  modal: "1rem",
  pill: "9999px",
} as const;

export const ROVVY_SHADOW = {
  card: "0 18px 45px -30px rgba(15, 23, 42, 0.32)",
  panel: "0 12px 32px rgba(15, 23, 42, 0.12)",
  float: "0 8px 24px rgba(15, 23, 42, 0.10)",
} as const;

export const ROVVY_LAYOUT = {
  pageMaxWidth: "72rem",
  headerHeight: "4rem",
  mobileNavHeight: "4rem",
  touchTargetMin: "2.75rem",
} as const;

/** Tailwind class bundles for shared UI patterns */
export const rovvy = {
  pageShell:
    "mx-auto w-full max-w-6xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8",
  pageShellWide: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8",
  pageBg: "min-h-[100dvh] bg-app text-text",
  card: "rounded-card border border-border bg-card shadow-card",
  cardPadding: "p-4 sm:p-5",
  cardInteractive:
    "rounded-card border border-border bg-card shadow-card transition hover:border-primary/25 hover:shadow-panel",
  title: "font-display text-2xl font-bold tracking-tight text-text sm:text-3xl",
  subtitle: "mt-1 text-sm text-muted",
  sectionTitle: "font-display text-lg font-semibold text-text",
  label: "mb-1.5 block text-xs font-medium text-text/80",
  input:
    "flex h-11 w-full items-center rounded-control border border-border bg-card px-3.5 text-sm text-text shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
  btnPrimary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
  btnSecondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-text shadow-sm transition hover:bg-app focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
  btnGhost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-text transition hover:bg-app focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  badge:
    "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold",
  badgePrimary: "bg-primary-soft text-primary",
  badgeMuted: "bg-app text-muted border border-border",
  divider: "border-border",
  focusRing: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  navActiveLight: "text-primary bg-primary-soft ring-1 ring-primary/15",
  navIdleLight: "text-muted hover:text-text hover:bg-app",
  navActiveDark:
    "bg-primary/10 text-text-on-dark shadow-[inset_0_0_0_1px_rgba(15,118,110,0.35)]",
  navIdleDark: "text-muted hover:bg-white/5 hover:text-text-on-dark",
  emptyState:
    "flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card px-6 py-12 text-center",
  skeleton: "animate-pulse rounded-md bg-border/80",
  alertError: "rounded-control border border-error/25 bg-error/10 px-3.5 py-2.5 text-sm text-error",
  alertSuccess:
    "rounded-control border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success",
  alertInfo:
    "rounded-control border border-primary/20 bg-primary-soft px-3.5 py-2.5 text-sm text-primary",
} as const;
