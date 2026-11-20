import { isSeatsAuthError } from "./seats-api-errors";

export type SeatsSearchLoadFailure =
  | { kind: "auth" }
  | { kind: "error"; message: string };

export type SeatsMeLoadFailure =
  | { kind: "auth" }
  | { kind: "error"; message: string };

export function resolveSeatsSearchLoadFailure(error: unknown): SeatsSearchLoadFailure {
  if (isSeatsAuthError(error)) return { kind: "auth" };
  return { kind: "error", message: "Could not load seat listings. Try again." };
}

export function resolveSeatsMeLoadFailure(error: unknown): SeatsMeLoadFailure {
  if (isSeatsAuthError(error)) return { kind: "auth" };
  return { kind: "error", message: "Could not load your rides. Try again." };
}
