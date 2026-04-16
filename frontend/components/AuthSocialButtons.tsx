"use client";

import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";

const btnBase =
  "flex aspect-square h-14 w-full max-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out hover:z-[1] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_6px_16px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60";

type Intent = "login" | "signup";

type Props = {
  intent: Intent;
  disabled?: boolean;
  /** Shows spinner in the active button while redirecting. */
  loadingProvider?: "google" | "facebook" | null;
  /** If set, called instead of default OAuth redirect (e.g. to show loading first). */
  onGoogleClick?: () => void;
  onFacebookClick?: () => void;
};

export function AuthSocialButtons({
  intent,
  disabled = false,
  loadingProvider = null,
  onGoogleClick,
  onFacebookClick,
}: Props) {
  const ig = intent === "signup" ? "signup" : "login";
  const busy = Boolean(loadingProvider);

  function goGoogle() {
    if (disabled || busy) return;
    if (onGoogleClick) onGoogleClick();
    else startGoogleOAuth(ig);
  }

  function goFacebook() {
    if (disabled || busy) return;
    if (onFacebookClick) onFacebookClick();
    else startFacebookOAuth(ig);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={goGoogle}
        disabled={disabled || busy}
        className={btnBase}
        aria-label="Sign in with Google"
        aria-busy={loadingProvider === "google"}
      >
        {loadingProvider === "google" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brands/google.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
            />
          </>
        )}
      </button>
      <button
        type="button"
        onClick={goFacebook}
        disabled={disabled || busy}
        className={btnBase}
        aria-label="Sign in with Facebook"
        aria-busy={loadingProvider === "facebook"}
      >
        {loadingProvider === "facebook" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brands/facebook.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
            />
          </>
        )}
      </button>
    </div>
  );
}
