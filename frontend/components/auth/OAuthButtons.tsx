"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";

const btnBase =
  "flex w-full min-h-[48px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1E3A5F] shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#667eea]/30 disabled:pointer-events-none disabled:opacity-60";

type Mode = "login" | "register";

export type OAuthButtonsProps = {
  mode: Mode;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** localStorage travello_google_hint — show “Continue as …” for Google */
  googleHint?: string | null;
  /** localStorage travello_google_photo */
  googlePhotoUrl?: string | null;
  /** localStorage travello_fb_hint */
  facebookHint?: string | null;
  onInstagramClick?: () => void;
};

function PinkPhoneIcon(): ReactNode {
  return (
    <span
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B9D] to-[#FF6B35] shadow-sm"
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="h-3.5 w-3.5"
      >
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </svg>
    </span>
  );
}

export function OAuthButtons({
  mode,
  disabled,
  onBusyChange,
  googleHint,
  googlePhotoUrl,
  facebookHint,
  onInstagramClick,
}: OAuthButtonsProps) {
  const router = useRouter();
  const intent = mode === "register" ? "signup" : "login";
  const googleLabel =
    mode === "register" ? "Continue with Google" : "Continue with Google";
  const facebookLabel =
    mode === "register" ? "Continue with Facebook" : "Continue with Facebook";
  const phoneLabel =
    mode === "register" ? "Continue with Phone" : "Phone OTP";

  function goGoogle() {
    onBusyChange?.(true);
    window.setTimeout(() => startGoogleOAuth(intent), 50);
  }

  function goFacebook() {
    onBusyChange?.(true);
    window.setTimeout(() => startFacebookOAuth(intent), 50);
  }

  const showGoogleHint = Boolean(googleHint?.trim());
  const showFacebookHint =
    Boolean(facebookHint?.trim()) && !showGoogleHint;

  return (
    <div className="flex w-full flex-col gap-3">
      {showGoogleHint ? (
        <button
          type="button"
          className={`${btnBase} justify-between gap-2 border-emerald-200/80 bg-emerald-50/90`}
          disabled={disabled}
          onClick={goGoogle}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {googlePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={googlePhotoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
              />
            ) : (
              <Image
                src="/brands/google.svg"
                alt=""
                width={22}
                height={22}
                className="shrink-0"
              />
            )}
            <span className="min-w-0 truncate text-left font-semibold">
              Continue as {googleHint}
            </span>
          </span>
          <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Auto →
          </span>
        </button>
      ) : showFacebookHint ? (
        <button
          type="button"
          className={`${btnBase} justify-between gap-2 border-emerald-200/80 bg-emerald-50/90`}
          disabled={disabled}
          onClick={goFacebook}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <Image
              src="/brands/facebook.svg"
              alt=""
              width={22}
              height={22}
              className="shrink-0"
            />
            <span className="min-w-0 truncate text-left font-semibold">
              Continue as {facebookHint}
            </span>
          </span>
          <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Auto →
          </span>
        </button>
      ) : null}

      {!showGoogleHint ? (
        <button
          type="button"
          className={btnBase}
          disabled={disabled}
          onClick={goGoogle}
        >
          <Image src="/brands/google.svg" alt="" width={22} height={22} className="shrink-0" />
          <span>{googleLabel}</span>
        </button>
      ) : null}

      {!showFacebookHint ? (
        <button
          type="button"
          className={btnBase}
          disabled={disabled}
          onClick={goFacebook}
        >
          <Image
            src="/brands/facebook.svg"
            alt=""
            width={22}
            height={22}
            className="shrink-0"
          />
          <span>{facebookLabel}</span>
        </button>
      ) : null}

      <Link
        href="/auth/phone"
        className={`${btnBase} text-center no-underline ${disabled ? "pointer-events-none opacity-60" : ""}`}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
      >
        <PinkPhoneIcon />
        <span>{phoneLabel}</span>
      </Link>

      <button
        type="button"
        className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/40 disabled:pointer-events-none disabled:opacity-60"
        style={{ backgroundColor: "#25D366" }}
        disabled={disabled}
        onClick={() => router.push("/phone")}
      >
        <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span>Continue with WhatsApp</span>
      </button>

      <button
        type="button"
        className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#dc2743] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/40 disabled:pointer-events-none disabled:opacity-60"
        disabled={disabled}
        onClick={() => onInstagramClick?.()}
      >
        <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
        <span>Continue with Instagram</span>
      </button>
    </div>
  );
}
