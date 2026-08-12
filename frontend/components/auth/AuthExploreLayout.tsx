"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RovvyLogo } from "@/components/RovvyLogo";
import { BRAND } from "@/lib/brand";
import { rovvy } from "@/lib/design-tokens";

export const AUTH_FORM_MAX_PHONE = "max-w-[380px]";
export const AUTH_FORM_MAX_TAB = "max-w-[440px]";
export const AUTH_FORM_MAX_DESKTOP = "max-w-[480px]";

export const AUTH_TEAL = BRAND.colors.primary;
export const AUTH_TEAL_HOVER = BRAND.colors.primaryHover;

export const authInputClass = rovvy.input.replace("h-11", "h-12");

export const authInputTextClass =
  "min-w-0 flex-1 bg-transparent text-sm font-normal text-text outline-none placeholder:text-xs placeholder:font-normal placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:light]";

export const authLabelClass = rovvy.label;

export const authPrimaryBtnClass = `${rovvy.btnPrimary} h-12 w-full shadow-teal-900/10`;

export const authLinkClass =
  "font-semibold text-primary hover:text-primary-hover underline-offset-2 hover:underline";

export const authSocialBtnClass = `${rovvy.btnSecondary} h-12 w-full hover:shadow-md`;

export const authSocialPrimaryBtnClass = `${rovvy.btnSecondary} h-12 w-full hover:shadow-md`;

export const authAlertInfoClass = rovvy.alertInfo;

export const authAlertErrorClass = rovvy.alertError;

export const authAlertNeutralClass =
  "rounded-control border border-border bg-app px-3.5 py-2.5 text-xs sm:text-sm text-text/80";

/** @deprecated use stone divider inline */
export const authDividerClass = "border-border";

const HERO_IMAGE_SIGNUP =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&auto=format&fit=crop&q=80";

const HERO_IMAGE_LOGIN =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80";

function TravelBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#F0FDFA] via-[#F8FAFC] to-[#ECFEFF]" />
      <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-[#99F6E4]/30 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-soft/40 blur-3xl" />
    </div>
  );
}

type AuthExploreLayoutProps = {
  variant?: "login" | "signup";
  title: string;
  subtitle: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroFooter?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function AuthCard({
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = AUTH_FORM_MAX_TAB,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className={`w-full ${maxWidthClass}`}>
      <div className="rounded-card border border-border bg-card p-6 shadow-panel sm:p-8">
        <div className="mb-6">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-text sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
      {footer ? (
        <p className="mt-5 text-center text-sm text-stone-500">{footer}</p>
      ) : null}
    </div>
  );
}

function CenteredAuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: Omit<AuthExploreLayoutProps, "variant" | "heroTitle" | "heroSubtitle" | "heroFooter"> & {
  wide?: boolean;
}) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 md:py-10">
      <AuthCard
        title={title}
        subtitle={subtitle}
        footer={footer}
        maxWidthClass={wide ? AUTH_FORM_MAX_DESKTOP : AUTH_FORM_MAX_TAB}
      >
        {children}
      </AuthCard>
    </main>
  );
}

function PhoneAuthLayout({
  title,
  subtitle,
  children,
  footer,
}: Omit<AuthExploreLayoutProps, "variant" | "heroTitle" | "heroSubtitle" | "heroFooter">) {
  return (
    <main className="relative flex flex-1 flex-col px-4 py-6">
      <div className={`mx-auto w-full ${AUTH_FORM_MAX_PHONE} flex-1`}>
        <AuthCard title={title} subtitle={subtitle} footer={footer} maxWidthClass="max-w-none">
          {children}
        </AuthCard>
      </div>
    </main>
  );
}

/** Desktop split — hero left, form right (login & signup) */
function DesktopSplitLayout({
  title,
  subtitle,
  heroTitle,
  heroSubtitle,
  heroFooter,
  heroImage,
  children,
  footer,
}: AuthExploreLayoutProps & { heroImage: string }) {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="relative flex w-[46%] flex-col justify-between overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F766E]/90 via-[#0F766E]/55 to-[#0F766E]/35" />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-10 xl:px-14">
          <h2 className="max-w-md text-2xl font-extrabold leading-tight text-white tracking-tight xl:text-3xl">
            {heroTitle}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-teal-50/90 xl:text-base">
            {heroSubtitle}
          </p>
        </div>

        <p className="relative z-10 p-10 text-sm text-teal-100/80 xl:p-14">
          {heroFooter ?? BRAND.tagline}
        </p>
      </aside>

      <main className="flex flex-1 flex-col justify-center bg-app/80 px-8 py-10 xl:px-14">
        <div className={`mx-auto w-full ${AUTH_FORM_MAX_DESKTOP}`}>
          <AuthCard title={title} subtitle={subtitle} footer={footer} maxWidthClass="max-w-none">
            {children}
          </AuthCard>
        </div>
      </main>
    </div>
  );
}

const DEFAULT_HERO = {
  login: {
    title: "Roam together",
    subtitle: "Pick up your trips, explore new places, and stay in sync with your group.",
    footer: "Group travel coordination — built for adventure.",
  },
  signup: {
    title: "Plan trips together",
    subtitle: "Discover places, coordinate live, and explore the world with your group.",
    footer: BRAND.tagline,
  },
} as const;

export function AuthExploreLayout({
  variant = "login",
  title,
  subtitle,
  heroTitle,
  heroSubtitle,
  heroFooter,
  children,
  footer,
}: AuthExploreLayoutProps) {
  const isSignup = variant === "signup";
  const defaults = isSignup ? DEFAULT_HERO.signup : DEFAULT_HERO.login;
  const heroImage = isSignup ? HERO_IMAGE_SIGNUP : HERO_IMAGE_LOGIN;

  return (
    <div className="relative flex min-h-dvh flex-col text-text">
      <TravelBackground />

      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 px-4 backdrop-blur-md sm:px-8">
        <Link href="/explore" className="flex shrink-0 items-center">
          <RovvyLogo variant="primary" size="md" className="sm:hidden" />
          <RovvyLogo variant="primary" size="xl" className="hidden sm:block" />
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Explore
        </Link>
      </header>

      {/* Phone */}
      <div className="relative z-10 flex flex-1 flex-col md:hidden">
        <PhoneAuthLayout title={title} subtitle={subtitle} footer={footer}>
          {children}
        </PhoneAuthLayout>
      </div>

      {/* Tablet — centered card */}
      <div className="relative z-10 hidden flex-1 flex-col md:flex xl:hidden">
        <CenteredAuthLayout title={title} subtitle={subtitle} footer={footer} wide>
          {children}
        </CenteredAuthLayout>
      </div>

      {/* Desktop — split hero + form for login & signup */}
      <div className="relative z-10 hidden flex-1 flex-col xl:flex">
        <DesktopSplitLayout
          variant={variant}
          title={title}
          subtitle={subtitle}
          heroTitle={heroTitle ?? defaults.title}
          heroSubtitle={heroSubtitle ?? defaults.subtitle}
          heroFooter={heroFooter ?? defaults.footer}
          heroImage={heroImage}
          footer={footer}
        >
          {children}
        </DesktopSplitLayout>
      </div>
    </div>
  );
}
