import { OPENFREEMAP_PUBLIC_ORIGIN, ROVVY_TILES_ORIGIN } from "@/lib/map-providers";

/** Pull a MapLibre style JSON URL out of a tile/style error message. */
export function extractStyleUrlFromMapError(message: string): string | null {
  const match = message.match(/https?:\/\/[^\s)]+\/styles\/[^\s)]+/i);
  return match?.[0] ?? null;
}

export function isRovvyHostedOpenFreeMapStyleUrl(url: string): boolean {
  return url.startsWith(ROVVY_TILES_ORIGIN);
}

/** Public OpenFreeMap CDN equivalent when the Rovvy worker is unreachable. */
export function resolveOpenFreeMapPublicFallbackStyleUrl(failedStyleUrl: string): string | null {
  if (!isRovvyHostedOpenFreeMapStyleUrl(failedStyleUrl)) return null;
  const styleMatch = failedStyleUrl.match(/\/styles\/([^/?#]+)/);
  const styleName = styleMatch?.[1] ?? "liberty";
  return `${OPENFREEMAP_PUBLIC_ORIGIN}/styles/${styleName}`;
}

export function resolveOpenFreeMapFallbackFromMapError(message: string): string | null {
  const failed = extractStyleUrlFromMapError(message);
  if (!failed) return null;
  return resolveOpenFreeMapPublicFallbackStyleUrl(failed);
}
