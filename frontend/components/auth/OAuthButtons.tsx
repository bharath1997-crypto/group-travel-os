"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";

const btnBase =
  "flex w-full min-h-[48px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1E3A5F] shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#667eea]/30 disabled:pointer-events-none disabled:opacity-60";

type Mode = "login" | "register";

type OAuthButtonsProps = {
  mode: Mode;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
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

export function OAuthButtons({ mode, disabled, onBusyChange }: OAuthButtonsProps) {
  const intent = mode === "register" ? "signup" : "login";
  const googleLabel =
    mode === "register" ? "Continue with Google" : "Google";
  const facebookLabel =
    mode === "register" ? "Continue with Facebook" : "Facebook";
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

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        className={btnBase}
        disabled={disabled}
        onClick={goGoogle}
      >
        <Image src="/brands/google.svg" alt="" width={22} height={22} className="shrink-0" />
        <span>{googleLabel}</span>
      </button>
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
    </div>
  );
}
