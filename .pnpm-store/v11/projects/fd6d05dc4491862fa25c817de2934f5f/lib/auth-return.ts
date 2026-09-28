const AUTH_RETURN_KEY = "rovvy_auth_return_path";

export function safeAuthReturnPath(raw: string | null | undefined, fallback = "/explore"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export function authReturnPathFromParams(params: Pick<URLSearchParams, "get">, fallback = "/explore"): string {
  return safeAuthReturnPath(params.get("next") || params.get("returnTo"), fallback);
}

export function authHref(path: "/login" | "/register" | "/signup" | "/verify", next: string): string {
  return `${path}?next=${encodeURIComponent(safeAuthReturnPath(next))}`;
}

export function rememberAuthReturnPath(next: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_RETURN_KEY, safeAuthReturnPath(next));
}

export function recalledAuthReturnPath(fallback = "/explore", clear = false): string {
  if (typeof window === "undefined") return fallback;
  const next = safeAuthReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY), fallback);
  if (clear) sessionStorage.removeItem(AUTH_RETURN_KEY);
  return next;
}
