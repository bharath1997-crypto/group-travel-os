"use client";

import type { ReactNode } from "react";
import {
  authSocialBtnClass,
  authSocialPrimaryBtnClass,
} from "@/components/auth/AuthExploreLayout";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="shrink-0">
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-1 6.7-2.6l-3.2-2.4c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.5C4.6 19.9 8.1 22 12 22z" fill="#34A853" />
      <path d="M6.2 13.7c-.2-.6-.3-1.2-.3-1.7s.1-1.2.3-1.7V7.8H2.9C2.3 9 2 10.5 2 12s.3 3 .9 4.2l3.3-2.5z" fill="#FBBC05" />
      <path d="M12 6.6c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 3.6 14.7 2.6 12 2.6c-3.9 0-7.4 2.1-9.1 5.2l3.3 2.5C7 8.4 9.3 6.6 12 6.6z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="shrink-0">
      <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z" fill="#1877F2" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden className="shrink-0 text-stone-800">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.15.8(1.2-.24 2.35-.93 3.64-.84 1.54.12 2.7.72 3.46 1.83-3.16 1.9-2.41 6.06.52 7.23-.61 1.62-1.43 3.22-2.77 4.86zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function SocialButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={authSocialBtnClass}
    >
      {children}
    </button>
  );
}

type AuthSocialButtonsProps = {
  mode: "login" | "signup";
  disabled?: boolean;
  googleBusy?: boolean;
  onGoogle: () => void;
  onFacebook: () => void;
  onApple?: () => void;
};

export function AuthSocialButtons({
  mode,
  disabled,
  googleBusy,
  onGoogle,
  onFacebook,
  onApple,
}: AuthSocialButtonsProps) {
  const googleLabel = mode === "login" ? "Continue with Google" : "Sign up with Google";
  const dividerLabel = mode === "login" ? "or continue with" : "or sign up with";

  return (
    <>
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-0 border-t border-stone-200" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          {dividerLabel}
        </span>
        <hr className="flex-1 border-0 border-t border-stone-200" />
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onGoogle}
          disabled={disabled}
          className={authSocialPrimaryBtnClass}
        >
          {googleBusy ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-[#0F766E]" aria-hidden />
              Connecting…
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>{googleLabel}</span>
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <SocialButton
            label={mode === "login" ? "Continue with Facebook" : "Sign up with Facebook"}
            onClick={onFacebook}
            disabled={disabled}
          >
            <FacebookIcon />
            <span>Facebook</span>
          </SocialButton>
          <SocialButton
            label={mode === "login" ? "Continue with Apple" : "Sign up with Apple"}
            onClick={onApple}
            disabled={disabled || !onApple}
          >
            <AppleIcon />
            <span>Apple</span>
          </SocialButton>
        </div>
      </div>
    </>
  );
}

export const authToggleBtnClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0F766E]";
