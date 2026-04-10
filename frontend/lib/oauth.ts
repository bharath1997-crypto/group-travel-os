import { API_BASE } from "@/lib/api";

/** Full browser navigation to backend OAuth start (redirects to provider). */
export function startGoogleOAuth(): void {
  window.location.href = `${API_BASE}/auth/oauth/google/start`;
}

export function startFacebookOAuth(): void {
  window.location.href = `${API_BASE}/auth/oauth/facebook/start`;
}
