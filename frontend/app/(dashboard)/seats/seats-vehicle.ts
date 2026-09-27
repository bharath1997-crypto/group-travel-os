export const SEATSHARE_VEHICLE_TYPES = [
  { id: "sedan", label: "Sedan", mileageKmpl: 15 },
  { id: "suv", label: "SUV", mileageKmpl: 12 },
  { id: "compact_hatchback", label: "Compact / Hatchback", mileageKmpl: 18 },
  { id: "minivan", label: "Minivan", mileageKmpl: 14 },
] as const;

export type SeatShareVehicleType = (typeof SEATSHARE_VEHICLE_TYPES)[number]["id"];

export function mileageForVehicleType(type: SeatShareVehicleType): number {
  return SEATSHARE_VEHICLE_TYPES.find((v) => v.id === type)?.mileageKmpl ?? 15;
}

export function vehicleDisplayLabel(type: SeatShareVehicleType | string | null | undefined): string {
  const row = SEATSHARE_VEHICLE_TYPES.find((v) => v.id === type);
  return row?.label ?? "Four-wheeler";
}
