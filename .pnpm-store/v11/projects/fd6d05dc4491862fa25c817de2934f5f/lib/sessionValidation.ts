import { apiFetchWithStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type SessionUser = {
  id?: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  profile_completion_filled?: number;
  profile_completion_total?: number;
};

export type SessionCheckResult =
  | { status: "valid"; user: SessionUser }
  | { status: "invalid" }
  | { status: "offline" };

/** Returns a minimal user from localStorage when the API is temporarily unreachable. */
export function getCachedSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const name = localStorage.getItem("gt_user_name")?.trim();
  if (!name) return null;
  return { full_name: name, email: "" };
}

/**
 * Validates the saved JWT against /auth/me.
 * - 401/403 → invalid (sign out)
 * - network/timeout → offline (keep token)
 */
export async function checkSession(timeoutMs = 12000): Promise<SessionCheckResult> {
  if (!getToken()) return { status: "invalid" };

  try {
    const { data, status } = await apiFetchWithStatus<SessionUser>(
      "/auth/me",
      {},
      timeoutMs,
    );

    if (status === 200 && data) {
      return { status: "valid", user: data };
    }

    if (status === 401 || status === 403) {
      return { status: "invalid" };
    }

    return { status: "offline" };
  } catch {
    return { status: "offline" };
  }
}
