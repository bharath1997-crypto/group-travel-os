import { API_BASE } from "@/lib/api";

/** Backend `AppException` detail when OAuth login is used but email is not registered. */
export const OAUTH_EMAIL_NOT_REGISTERED_CODE = "oauth_email_not_registered";

export const OAUTH_EMAIL_NOT_REGISTERED_MESSAGE =
  "We verified your social account, but it is not registered with Group Travel OS yet.";

export const OAUTH_NOT_REGISTERED_MODAL_TITLE = "Account not found";

type OAuthIntent = "login" | "signup";

/** Backend maps `register` → signup flow; `login` stays login-only (existing accounts). */
function intentQuery(intent: OAuthIntent): string {
  const q = intent === "signup" ? "register" : "login";
  return `?intent=${q}`;
}

/** Full browser navigation to backend OAuth start (redirects to provider). */
export function startGoogleOAuth(intent: OAuthIntent = "login"): void {
  window.location.href = `${API_BASE}/auth/oauth/google/start${intentQuery(intent)}`;
}

export function startFacebookOAuth(intent: OAuthIntent = "login"): void {
  window.location.href = `${API_BASE}/auth/oauth/facebook/start${intentQuery(intent)}`;
}
