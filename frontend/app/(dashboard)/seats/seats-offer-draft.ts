import type { LocationPoint } from "./seats-location";
import type { SeatShareVehicleType } from "./seats-vehicle";

export const OFFER_DRAFT_KEY = "rovvy.seatshare.offer-draft.v1";

export type OfferDraft = {
  from: LocationPoint;
  to: LocationPoint;
  vehicleType: SeatShareVehicleType;
  departDate: string;
  departTime: string;
  seatsOffered: number;
  approval: "instant" | "manual";
  note: string;
};

function isPoint(v: unknown): v is LocationPoint {
  const p = v as LocationPoint | null;
  return (
    !!p &&
    typeof p.address === "string" &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    typeof p.isConfirmed === "boolean"
  );
}

export function parseOfferDraft(raw: string | null): OfferDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<OfferDraft>;
    if (!isPoint(d.from) || !isPoint(d.to)) return null;
    if (typeof d.vehicleType !== "string") return null;
    if (d.approval !== "instant" && d.approval !== "manual") return null;
    const seats = Number(d.seatsOffered);
    if (!Number.isInteger(seats) || seats < 1 || seats > 4) return null;
    return {
      from: d.from,
      to: d.to,
      vehicleType: d.vehicleType as SeatShareVehicleType,
      departDate: typeof d.departDate === "string" ? d.departDate : "",
      departTime: typeof d.departTime === "string" ? d.departTime : "05:30",
      seatsOffered: seats,
      approval: d.approval,
      note: typeof d.note === "string" ? d.note : "",
    };
  } catch {
    return null;
  }
}

export function loadOfferDraft(): OfferDraft | null {
  try {
    return parseOfferDraft(window.localStorage.getItem(OFFER_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function saveOfferDraft(draft: OfferDraft): void {
  try {
    window.localStorage.setItem(OFFER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage blocked: the wizard still works without a draft */
  }
}

export function clearOfferDraft(): void {
  try {
    window.localStorage.removeItem(OFFER_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
