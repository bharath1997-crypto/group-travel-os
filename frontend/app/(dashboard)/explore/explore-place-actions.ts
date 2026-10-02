/** Place drawer actions built only from provider data — no geocoding or API keys. */

type DirectionsTarget = {
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
  address?: string | null;
};

/** Google Maps directions deep link (opens the native app on phones). */
export function exploreDirectionsUrl({ lat, lng, name, address }: DirectionsTarget): string | null {
  const hasPin = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
  const destination = hasPin
    ? `${lat},${lng}`
    : [name, address].filter((part) => part && part.trim()).join(", ");
  if (!destination || (!hasPin && !address?.trim())) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** tel: link from a provider phone string; null when it has too few digits to dial. */
export function explorePhoneHref(phone?: string | null): string | null {
  if (!phone) return null;
  const dialable = phone.trim().replace(/[^\d+]/g, "");
  return dialable.replace(/\D/g, "").length >= 7 ? `tel:${dialable}` : null;
}
