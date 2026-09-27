import { apiFetch } from "@/lib/api";

/** Backend `AppException` detail when OAuth login is used but email is not registered. */
export const OAUTH_EMAIL_NOT_REGISTERED_CODE = "oauth_email_not_registered";

export const OAUTH_EMAIL_NOT_REGISTERED_MESSAGE =
  "We verified your social account, but it is not registered with Rovvy yet.";

export const OAUTH_NOT_REGISTERED_MODAL_TITLE = "Account not found";

type OAuthIntent = "login" | "signup";

/** Backend maps `register` -> signup flow; `login` stays login-only (existing accounts). */
function intentQuery(intent: OAuthIntent): string {
  const q = intent === "signup" ? "register" : "login";
  return `?intent=${q}`;
}

/**
 * Navigate the current tab to the OAuth provider URL.
 *
 * Same-tab redirect is the production-standard OAuth approach (used by GitHub,
 * Google, Stripe, etc.).  window.open() was previously attempted first, but
 * modern browsers block popups opened after an async API call (user-gesture
 * context expires), leaving the button permanently stuck in "Connecting...".
 *
 * @returns false always — callers treat false as "redirect triggered, page is leaving".
 */
export function navigateToOAuth(url: string): boolean {
  if (typeof window === "undefined") return false;
  window.location.assign(url);
  return false;
}

/** @deprecated Use navigateToOAuth — kept for any remaining call sites. */
export const openOAuthInNewTab = navigateToOAuth;

/** Start Google OAuth — redirects the current tab to accounts.google.com. */
export async function startGoogleOAuth(
  intent: OAuthIntent = "login",
): Promise<boolean> {
  const q = intentQuery(intent);
  const data = await apiFetch<{ url: string }>(`/auth/oauth/google/start${q}`, {}, 30000);
  if (!data?.url) throw new Error("No OAuth URL returned by server");
  return navigateToOAuth(data.url);
}

/** Start Facebook OAuth — redirects the current tab to facebook.com. */
export async function startFacebookOAuth(
  intent: OAuthIntent = "login",
): Promise<boolean> {
  const q = intentQuery(intent);
  const data = await apiFetch<{ url: string }>(`/auth/oauth/facebook/start${q}`, {}, 30000);
  if (!data?.url) throw new Error("No OAuth URL returned by server");
  return navigateToOAuth(data.url);
}
