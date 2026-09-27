"use client";

import {
  LIVE_DOCK_PANEL,
  LIVE_DOCK_PRIMARY_CTA,
  LIVE_DOCK_SECTION_LABEL,
  LIVE_EMPTY_STATE_TITLE,
} from "./live-design-tokens";
import type { SeatShareState, SeatShareVehicle } from "./live-seat-share-mock";
import { seatShareOpenSeats } from "./live-seat-share-mock";

type LiveSeatSharePanelProps = {
  share: SeatShareState;
  joinedVehicleId?: string | null;
  onJoinVehicle?: (vehicleId: string) => void;
  onAddPickup?: () => void;
  onBroadcastSeats?: () => void;
};

function VehicleCard({
  vehicle,
  joined,
  onJoin,
}: {
  vehicle: SeatShareVehicle;
  joined?: boolean;
  onJoin?: () => void;
}) {
  const filled = vehicle.seatsTotal - vehicle.seatsOpen;

  return (
    <div className="rounded-[16px] border border-[rgba(15,22,20,0.12)] bg-white p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[#0F1614]">{vehicle.label}</p>
          <p className="mt-0.5 font-mono text-[9.5px] text-[#5F665F]">
            {vehicle.routeLabel} · ${vehicle.costPerHead} ea
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#DCEAE5] px-2 py-0.5 font-mono text-[10px] font-medium text-[#0A4A3E]">
          {vehicle.seatsOpen} open
        </span>
      </div>

      <div className="mb-3 flex gap-1">
        {Array.from({ length: vehicle.seatsTotal }).map((_, index) => (
          <span
            key={`${vehicle.id}-seat-${index}`}
            className={`h-2 flex-1 rounded-full ${
              index < filled ? "bg-[#0E6E5C]" : "bg-[#EDEAE2]"
            }`}
          />
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        {vehicle.pickups.map((pickup) => (
          <div
            key={pickup.id}
            className="flex items-center justify-between gap-2 rounded-[11px] bg-[#F6F4EF] px-2.5 py-2"
          >
            <span className="min-w-0 text-[11.5px] font-medium text-[#2A312B]">{pickup.label}</span>
            <span className="shrink-0 font-mono text-[10px] text-[#5F665F]">{pickup.etaMinutes} min</span>
          </div>
        ))}
      </div>

      {joined ? (
        <div className="w-full rounded-full border border-[rgba(15,118,110,0.25)] bg-[rgba(15,118,110,0.08)] py-2 text-center text-[11.5px] font-semibold text-[#0F766E]">
          Seat requested
        </div>
      ) : vehicle.seatsOpen > 0 && vehicle.driverName !== "You" ? (
        <button
          type="button"
          onClick={onJoin}
          className="w-full rounded-full border border-[rgba(15,22,20,0.14)] bg-white py-2 text-[11.5px] font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
        >
          Request seat · join ride
        </button>
      ) : vehicle.driverName === "You" ? (
        <div className="w-full rounded-full border border-[rgba(15,22,20,0.08)] bg-[#F6F4EF] py-2 text-center text-[11.5px] font-medium text-[#5F665F]">
          Your open seats are live
        </div>
      ) : null}
    </div>
  );
}

export default function LiveSeatSharePanel({
  share,
  joinedVehicleId = null,
  onJoinVehicle,
  onAddPickup,
  onBroadcastSeats,
}: LiveSeatSharePanelProps) {
  const openSeats = seatShareOpenSeats(share);

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`overflow-hidden ${LIVE_DOCK_PANEL}`}>
        <div className="border-b border-[rgba(15,22,20,0.08)] px-3.5 py-3.5">
          <div className={`mb-2 flex items-center gap-1.5 ${LIVE_DOCK_SECTION_LABEL}`}>
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#4084E8]" aria-hidden />
            Seat Share live
          </div>
          <h2 className={`${LIVE_EMPTY_STATE_TITLE} text-[22px]`}>
            {openSeats} seats open to {share.destinationName}
          </h2>
          <p className="mt-1 text-[11.5px] text-[#5F665F]">
            Pickup points update as drivers move. Cost splits when the ride ends.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-3.5">
          {share.vehicles.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[rgba(15,22,20,0.16)] bg-[#F6F4EF] px-3 py-4 text-[12px] leading-snug text-[#5F665F]">
              Broadcast your open seats to show your ride on the trip map.
            </p>
          ) : (
            share.vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                joined={joinedVehicleId === vehicle.id}
                onJoin={() => onJoinVehicle?.(vehicle.id)}
              />
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[rgba(15,22,20,0.08)] bg-[#F1EFE8] px-3.5 py-3">
          <button
            type="button"
            onClick={onAddPickup}
            className="min-w-[92px] flex-1 rounded-full border border-[rgba(15,22,20,0.16)] bg-white px-2 py-2.5 text-[11.5px] font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
          >
            Add pickup
          </button>
          <button
            type="button"
            onClick={onBroadcastSeats}
            className={`min-w-[92px] flex-1 ${LIVE_DOCK_PRIMARY_CTA}`}
          >
            Broadcast seats
          </button>
        </div>
      </div>
    </div>
  );
}
