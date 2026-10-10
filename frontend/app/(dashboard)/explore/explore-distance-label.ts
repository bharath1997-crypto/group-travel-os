/** Distance copy for feed reason chips — miles only when measured (F15). */
export function formatExploreDistanceMiles(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles) || miles < 0) return "";
  if (miles < 0.05) return "";
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function formatExploreDistanceFromMeters(distanceM: number | null | undefined): string {
  if (distanceM == null || !Number.isFinite(distanceM)) return "";
  return formatExploreDistanceMiles(distanceM / 1609.344);
}
