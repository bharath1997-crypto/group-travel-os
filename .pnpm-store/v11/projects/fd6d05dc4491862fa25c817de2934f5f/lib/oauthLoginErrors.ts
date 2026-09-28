import {
  OAUTH_EMAIL_NOT_REGISTERED_CODE,
  OAUTH_EMAIL_NOT_REGISTERED_MESSAGE,
  OAUTH_NOT_REGISTERED_MODAL_TITLE,
} from "@/lib/oauth";

export type OauthLoginAlert = {
  variant: "warning" | "error" | "info";
  title?: string;
  body: string;
  showCreateAccount?: boolean;
};

function normalizeErr(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function oauthErrorToAlert(raw: string): OauthLoginAlert {
  const original = normalizeErr(raw);
  const err = original.toLowerCase();

  if (
    err.includes(OAUTH_EMAIL_NOT_REGISTERED_CODE) ||
    err.includes("oauth_email_not_registered")
  ) {
    return {
      variant: "warning",
      title: OAUTH_NOT_REGISTERED_MODAL_TITLE,
      body: OAUTH_EMAIL_NOT_REGISTERED_MESSAGE,
      showCreateAccount: true,
    };
  }

  if (err === "server") {
    return {
      variant: "error",
      body:
        "We couldn’t finish sign-in with that provider (server error). Try again, or use email and password. If it keeps happening, check API logs and OAuth app settings.",
    };
  }

  if (err === "db_busy" || err.includes("db_busy")) {
    return {
      variant: "error",
      body:
        "The database is busy or waking up. Wait a moment and try again, or use email and password. In dev, open http://localhost:8000/health/db to see blockers.",
    };
  }

  if (err.includes("missing_token")) {
    return {
      variant: "error",
      body: "Sign-in was interrupted. Please try again.",
    };
  }

  if (err.includes("missing_params") || err.includes("invalid_state")) {
    return {
      variant: "error",
      body: "Sign-in was interrupted. Please try again.",
    };
  }

  if (err.includes("profile") || err.includes("profile_unavailable")) {
    return {
      variant: "error",
      body: "We could not load your account. Please try signing in again.",
    };
  }

  if (original.length > 0 && original.length < 400) {
    return { variant: "error", body: original };
  }

  return {
    variant: "error",
    body: "Sign-in failed. Please try again.",
  };
}

/** Same mapping as login; register page uses error styling only (no “create account” extra link). */
export function oauthErrorToRegisterAlert(raw: string): OauthLoginAlert {
  const alert = oauthErrorToAlert(raw);
  return {
    variant: "error",
    title: alert.title,
    body: alert.body,
  };
}
