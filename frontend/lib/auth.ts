import { clearUserSessionStorage } from "@/lib/userSessionStorage";

const TOKEN_KEY = "gt_token";

export function saveToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  clearUserSessionStorage();
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
