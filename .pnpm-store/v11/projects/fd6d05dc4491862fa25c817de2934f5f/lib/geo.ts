export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return r * c;
}

/** Returns a user-facing message when geolocation cannot be used, or null if OK to call. */
export function geolocationUnavailableMessage(): string | null {
  if (typeof navigator === "undefined") return "GPS not supported in this browser";
  if (!navigator.geolocation) return "GPS not supported in this browser";
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
    if (protocol !== "https:" && !local) {
      return "GPS requires HTTPS — use https://rovvy.app or a secure local origin";
    }
  }
  return null;
}

export function geolocationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === 1) {
    return "Enable location permission in browser settings";
  }
  if (err.code === 2) {
    return "GPS position unavailable — try again with a clearer signal";
  }
  if (err.code === 3) {
    return "GPS request timed out — check permissions and try again";
  }
  return err.message || "GPS error — check browser location settings";
}
