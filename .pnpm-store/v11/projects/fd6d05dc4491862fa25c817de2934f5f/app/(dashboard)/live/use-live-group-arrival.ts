"use client";

import { useEffect, useMemo, useState } from "react";
import type { GroupConvergeMember } from "./live-group-converge-mock";
import { ensureLiveFirebaseSession } from "./live-firebase-auth";
import {
  computeGroupArrival,
  isWithinArrivalRadius,
  parseArrivalsSnapshot,
  arrivalRadiusForTravelMode,
} from "./live-group-arrival";
import { publishTripArrival, subscribeTripArrivals } from "./live-arrival-sync";
import type { TripMemberLocation } from "./live-group-location-types";

type UseLiveGroupArrivalOptions = {
  enabled: boolean;
  tripId: string | null;
  currentUserId: string | null;
  destination: { lat: number; lng: number } | null;
  memberCount: number;
  memberLocations: TripMemberLocation[];
  convergeMembers: GroupConvergeMember[];
  travelMode: string;
  selfLat: number | null;
  selfLng: number | null;
};

export function useLiveGroupArrival(options: UseLiveGroupArrivalOptions) {
  const {
    enabled,
    tripId,
    currentUserId,
    destination,
    memberCount,
    memberLocations,
    convergeMembers,
    travelMode,
    selfLat,
    selfLng,
  } = options;

  const usingRealArrivals = enabled && Boolean(tripId) && Boolean(currentUserId);
  const [rtArrivals, setRtArrivals] = useState<ReturnType<typeof parseArrivalsSnapshot>>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!usingRealArrivals || !tripId) {
      setRtArrivals([]);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const connect = async () => {
      const session = await ensureLiveFirebaseSession();
      if (cancelled) return;
      if (!session.ok || !session.db) {
        setConnected(false);
        return;
      }

      setConnected(true);
      unsubscribe = subscribeTripArrivals(session.db, tripId, (snapshot) => {
        if (cancelled) return;
        setRtArrivals(parseArrivalsSnapshot(snapshot));
      });
    };

    void connect();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [tripId, usingRealArrivals]);

  const arrival = useMemo(() => {
    if (!enabled || !destination) {
      return {
        arrivedUserIds: [] as string[],
        arrivedCount: 0,
        memberCount: memberCount || 1,
        subline: "",
        suggestNightFinished: false,
        selfArrived: false,
      };
    }

    return computeGroupArrival({
      destination,
      memberCount,
      selfUserId: currentUserId,
      selfLat,
      selfLng,
      memberLocations,
      rtArrivals,
      convergeMembers,
      travelMode,
    });
  }, [
    enabled,
    destination,
    memberCount,
    currentUserId,
    selfLat,
    selfLng,
    memberLocations,
    rtArrivals,
    convergeMembers,
    travelMode,
  ]);

  useEffect(() => {
    if (!usingRealArrivals || !tripId || !currentUserId || !destination) return;
    if (!arrival.selfArrived || selfLat == null || selfLng == null) return;

    let cancelled = false;
    const publish = async () => {
      const session = await ensureLiveFirebaseSession();
      if (cancelled || !session.ok || !session.db) return;
      await publishTripArrival(session.db, tripId, currentUserId, {
        lat: selfLat,
        lng: selfLng,
        arrivedAt: Date.now(),
      });
    };

    void publish();
  }, [
    arrival.selfArrived,
    currentUserId,
    destination,
    selfLat,
    selfLng,
    tripId,
    usingRealArrivals,
  ]);

  return {
    usingRealArrivals,
    connected,
    ...arrival,
    isNearDestination:
      destination != null &&
      selfLat != null &&
      selfLng != null &&
      isWithinArrivalRadius(
        selfLat,
        selfLng,
        destination.lat,
        destination.lng,
        arrivalRadiusForTravelMode(travelMode),
      ),
  };
}
