import {
  LOUNGE_URL_CONNECT,
} from "@/lib/open-lounge";

export function buildProfileConnectUrl(
  userId: string,
  username?: string | null,
): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://rovvy.app";
  const params = new URLSearchParams({ [LOUNGE_URL_CONNECT]: userId });
  if (username?.trim()) {
    params.set("u", username.trim().replace(/^@/, ""));
  }
  return `${origin}/explore?${params.toString()}`;
}

export function profileHandleLabel(username?: string | null): string | null {
  const u = username?.trim().replace(/^@/, "");
  return u ? `@${u}` : null;
}
