/**
 * Map API / OAuth error tokens to user-friendly copy for the login page.
 */
export function friendlyLoginError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Something went wrong. Please try again.";
  }

  const lower = trimmed.toLowerCase();

  if (lower === "server" || lower.includes("server error") || lower === "bad gateway") {
    return "We couldn't complete sign-in right now. Please try again in a moment.";
  }

  if (
    lower === "missing_params" ||
    lower === "missing_token" ||
    lower === "oauth_error"
  ) {
    return "Sign-in was interrupted. Please try again.";
  }

  if (lower === "profile") {
    return "We couldn’t load your account. Please sign in again.";
  }

  if (
    lower.includes("invalid email or password") ||
    lower.includes("invalid email") ||
    lower === "unauthorized"
  ) {
    return "Invalid email or password. Please try again.";
  }

  if (lower.includes("oauth_email_not_registered")) {
    return "No account found for that sign-in. Create an account or use email and password.";
  }

  if (trimmed.length > 220) {
    return "Something went wrong. Please try again.";
  }

  return trimmed;
}
