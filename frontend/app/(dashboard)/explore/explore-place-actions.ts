/** Place drawer actions built only from provider data — no geocoding or API keys. */

/** tel: link from a provider phone string; null when it has too few digits to dial. */
export function explorePhoneHref(phone?: string | null): string | null {
  if (!phone) return null;
  const dialable = phone.trim().replace(/[^\d+]/g, "");
  return dialable.replace(/\D/g, "").length >= 7 ? `tel:${dialable}` : null;
}
