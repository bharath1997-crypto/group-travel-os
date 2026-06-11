import { apiFetch } from "@/lib/api";

/** Backend `AppException` detail when OAuth login is used but email is not registered. */
export const OAUTH_EMAIL_NOT_REGISTERED_CODE = "oauth_email_not_registered";

export const OAUTH_EMAIL_NOT_REGISTERED_MESSAGE =
  "We verified your social account, but it is not registered with Rovvy yet.";

export const OAUTH_NOT_REGISTERED_MODAL_TITLE = "Account not found";

type OAuthIntent = "login" | "signup";

/** Backend maps `register` → signup flow; `login` stays login-only (existing accounts). */
function intentQuery(intent: OAuthIntent): string {
  const q = intent === "signup" ? "register" : "login";
  return `?intent=${q}`;
}

/**
 * Open the provider OAuth URL in a new browser tab when possible.
 * IDE embedded browsers (e.g. Cursor Simple Browser) are too short for Google’s
 * account picker / consent UI — a real tab avoids clipped layouts and scroll traps.
 *
 * @returns true when a new tab was opened; false when falling back to same-tab navigation.
 */
export function openOAuthInNewTab(url: string): boolean {
  if (typeof window === "undefined") return false;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    opened.opener = null;
    return true;
  }
  window.location.assign(url);
  return false;
}

/** Start Google OAuth. Prefer a new tab; same-tab redirect if the popup is blocked. */
export async function startGoogleOAuth(
  intent: OAuthIntent = "login",
): Promise<boolean> {
  const q = intentQuery(intent);
  const data = await apiFetch<{ url: string }>(`/auth/oauth/google/start${q}`);
  if (!data?.url) return false;
  return openOAuthInNewTab(data.url);
}

/** Start Facebook OAuth. Prefer a new tab; same-tab redirect if the popup is blocked. */
export async function startFacebookOAuth(
  intent: OAuthIntent = "login",
): Promise<boolean> {
  const q = intentQuery(intent);
  const data = await apiFetch<{ url: string }>(`/auth/oauth/facebook/start${q}`);
  if (!data?.url) return false;
  return openOAuthInNewTab(data.url);
}
