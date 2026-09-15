"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildDefaultSeatShare, type SeatShareState } from "./live-seat-share-mock";

import { ensureLiveFirebaseSession } from "./live-firebase-auth";

import { findJoinedDriverId, mergeConvoyLocationRefresh } from "./live-convoy-actions";

import {

  publishConvoyOffer,

  subscribeTripConvoy,

  transactionAddConvoyPickup,

  transactionJoinConvoySeat,

} from "./live-convoy-sync";

import type { ConvoyOfferRecord } from "./live-convoy-types";

import {

  buildYourConvoyOffer,

  convoyOffersToSeatShare,

  convoyPayloadToRecord,

  formatRouteLabel,

  parseConvoySnapshot,

} from "./live-seat-share-convoy";



type UseLiveSeatShareOptions = {

  enabled: boolean;

  tripId: string | null;

  currentUserId: string | null;

  currentUserName: string;

  destinationName: string;

  routeDistanceMeters: number | null;

  routeDurationSeconds: number | null;

  lat: number | null;

  lng: number | null;

};



export function useLiveSeatShare(options: UseLiveSeatShareOptions) {

  const {

    enabled,

    tripId,

    currentUserId,

    currentUserName,

    destinationName,

    routeDistanceMeters,

    routeDurationSeconds,

    lat,

    lng,

  } = options;



  const usingRealConvoy = enabled && Boolean(tripId) && Boolean(currentUserId);

  const [connected, setConnected] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [share, setShare] = useState<SeatShareState>(() =>

    buildDefaultSeatShare(destinationName),

  );

  const [offers, setOffers] = useState<ConvoyOfferRecord[]>([]);

  const offersRef = useRef<ConvoyOfferRecord[]>([]);

  offersRef.current = offers;



  const routeLabel = useMemo(

    () =>

      formatRouteLabel({

        distanceMeters: routeDistanceMeters,

        durationSeconds: routeDurationSeconds,

      }),

    [routeDistanceMeters, routeDurationSeconds],

  );



  const buildSelfOffer = useCallback(() => {

    const existing = offersRef.current.find((offer) => offer.userId === currentUserId) ?? null;

    return mergeConvoyLocationRefresh(

      existing,

      buildYourConvoyOffer({

        userId: currentUserId ?? "",

        driverName: currentUserName,

        destinationName,

        routeLabel,

        lat,

        lng,

      }),

    );

  }, [currentUserId, currentUserName, destinationName, lat, lng, routeLabel]);



  const publishSelf = useCallback(async () => {

    if (!usingRealConvoy || !tripId || !currentUserId) return;



    const session = await ensureLiveFirebaseSession();

    if (!session.ok || !session.db) {

      setError(session.error ?? "Could not connect to Seat Share.");

      return;

    }



    setConnected(true);

    setError(null);



    await publishConvoyOffer(session.db, tripId, currentUserId, buildSelfOffer());

  }, [buildSelfOffer, currentUserId, tripId, usingRealConvoy]);



  const joinVehicle = useCallback(

    async (driverUserId: string, pickupLabel: string) => {

      if (!usingRealConvoy || !tripId || !currentUserId) {

        return { ok: false as const, error: "Open Live from a trip to join a ride." };

      }

      if (driverUserId === currentUserId) {

        return { ok: false as const, error: "That is your ride offer." };

      }



      const session = await ensureLiveFirebaseSession();

      if (!session.ok || !session.db) {

        return {

          ok: false as const,

          error: session.error ?? "Could not connect to Seat Share.",

        };

      }



      return transactionJoinConvoySeat(session.db, tripId, driverUserId, {

        userId: currentUserId,

        name: currentUserName,

        pickupLabel,

        etaMinutes: 12,

      });

    },

    [currentUserId, currentUserName, tripId, usingRealConvoy],

  );



  const addPickup = useCallback(

    async (pickupLabel: string, etaMinutes = 10) => {

      if (!usingRealConvoy || !tripId || !currentUserId) {

        return { ok: false as const, error: "Open Live from a trip to add pickup stops." };

      }



      const session = await ensureLiveFirebaseSession();

      if (!session.ok || !session.db) {

        return {

          ok: false as const,

          error: session.error ?? "Could not connect to Seat Share.",

        };

      }



      return transactionAddConvoyPickup(session.db, tripId, currentUserId, {

        id: `pickup-${Date.now()}`,

        label: pickupLabel,

        etaMinutes,

      });

    },

    [currentUserId, tripId, usingRealConvoy],

  );



  const joinedVehicleId = useMemo(

    () => findJoinedDriverId(offers, currentUserId),

    [currentUserId, offers],

  );



  useEffect(() => {

    if (!usingRealConvoy || !tripId) {

      setConnected(false);

      setError(null);

      setOffers([]);

      setShare(buildDefaultSeatShare(destinationName));

      return;

    }



    let cancelled = false;

    let unsubscribe: (() => void) | null = null;

    let publishTimer: ReturnType<typeof setInterval> | null = null;



    const connect = async () => {

      const session = await ensureLiveFirebaseSession();

      if (cancelled) return;

      if (!session.ok || !session.db) {

        setConnected(false);

        setError(session.error ?? "Could not connect to Seat Share.");

        setOffers([]);

        setShare(buildDefaultSeatShare(destinationName));

        return;

      }



      setConnected(true);

      setError(null);



      unsubscribe = subscribeTripConvoy(session.db, tripId, (snapshot) => {

        if (cancelled) return;

        const nextOffers = parseConvoySnapshot(snapshot);

        setOffers(nextOffers);

        if (nextOffers.length === 0) {

          if (currentUserId) {

            setShare(

              convoyOffersToSeatShare(

                [convoyPayloadToRecord(currentUserId, buildSelfOffer())],

                destinationName,

                currentUserId,

              ),

            );

          } else {

            setShare({ destinationName, vehicles: [] });

          }

          return;

        }

        setShare(convoyOffersToSeatShare(nextOffers, destinationName, currentUserId));

      });



      const publish = async () => {

        if (!currentUserId) return;

        try {

          const existing = offersRef.current.find((offer) => offer.userId === currentUserId) ?? null;

          await publishConvoyOffer(

            session.db!,

            tripId,

            currentUserId,

            mergeConvoyLocationRefresh(

              existing,

              buildYourConvoyOffer({

                userId: currentUserId,

                driverName: currentUserName,

                destinationName,

                routeLabel,

                lat,

                lng,

              }),

            ),

          );

        } catch (publishError) {

          console.error("[Rovvy Live] Failed to publish convoy offer:", publishError);

        }

      };



      void publish();

      publishTimer = setInterval(() => {

        void publish();

      }, 15_000);

    };



    void connect();



    return () => {

      cancelled = true;

      unsubscribe?.();

      if (publishTimer) clearInterval(publishTimer);

    };

  }, [

    currentUserId,

    currentUserName,

    destinationName,

    lat,

    lng,

    routeLabel,

    tripId,

    usingRealConvoy,

  ]);



  return {

    usingRealConvoy,

    connected,

    error,

    share,

    offers,

    joinedVehicleId,

    publishSelf,

    joinVehicle,

    addPickup,

  };

}


