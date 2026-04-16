import { apiFetch } from "@/lib/api";

/**
 * Ask the API to send (or resend) the verification email for the logged-in user.
 */
export async function requestVerificationEmail(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    await apiFetch("/auth/send-verification-email", { method: "POST" });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return { ok: false, message };
  }
}

/** Navigate to email verification (client router when provided, else full navigation). */
export function goToVerifyEmail(
  router?: { push: (href: string) => void },
): void {
  if (router) {
    router.push("/verify-email");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = "/verify-email";
  }
}
