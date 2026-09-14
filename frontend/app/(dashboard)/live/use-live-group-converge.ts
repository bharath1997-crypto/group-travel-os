"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FriendLocation } from "./live-friend-layer-sync";
import type { GroupConvergeMember, GroupWayraNotice } from "./live-group-converge-mock";
import {
  buildConvergeMembers,
  memberLocationsToFriends,
  MEMBER_ETA_REFRESH_MS,
  parseTripLocationsSnapshot,
  resolveLocationStatus,
  shouldRefreshMemberEta,
  wayraNoticeFromAlert,
} from "./live-group-converge";
import { ensureLiveFirebaseSession } from "./live-firebase-auth";
import type { GroupMemberSummary, TripMemberLocation } from "./live-group-location-types";
import {
  publishTripMemberLocation,
  subscribeTripLocations,
} from "./live-group-location-sync";
import { fetchWayraLiveContextAlert } from "./live-group-network";
import { fetchLiveRoute } from "./live-routing";
import { etaMinutesFromDuration } from "./live-types";

type GpsSnapshot = {
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number | null;
  status: string;
};

type UseLiveGroupConvergeOptions = {
  enabled: boolean;
  tripId: string | null;
  currentUserId: string | null;
  currentUserName: string;
  roster: GroupMemberSummary[];
  destination: { lat: number; lng: number } | null;
  travelMode: string;
  gps: GpsSnapshot;
  yourRouteDurationSeconds: number | null;
};

type UseLiveGroupConvergeResult = {
  connected: boolean;
  error: string | null;
  friends: FriendLocation[];
  members: GroupConvergeMember[];
  memberLocations: TripMemberLocation[];
  wayraNotice: GroupWayraNotice | null;
};

const EMPTY_RESULT: UseLiveGroupConvergeResult = {
  connected: false,
  error: null,
  friends: [],
  members: [],
  memberLocations: [],
  wayraNotice: null,
};

export function useLiveGroupConverge(
  options: UseLiveGroupConvergeOptions,
): UseLiveGroupConvergeResult {
  const {
    enabled,
    tripId,
    currentUserId,
    currentUserName,
    roster,
    destination,
    travelMode,
    gps,
    yourRouteDurationSeconds,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<TripMemberLocation[]>([]);
  const [memberEtas, setMemberEtas] = useState<Record<string, number | null>>({});
  const [wayraAlert, setWayraAlert] = useState<string | null>(null);

  const etaCacheRef = useRef<Record<string, { eta: number | null; at: number }>>({});
  const etaInflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !tripId) {
      setConnected(false);
      setError(null);
      setLocations([]);
      setMemberEtas({});
      setWayraAlert(null);
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
        setError(session.error ?? "Could not connect to live location sharing.");
        return;
      }

      setConnected(true);
      setError(null);

      unsubscribe = subscribeTripLocations(session.db, tripId, (snapshot) => {
        if (cancelled) return;
        setLocations(parseTripLocationsSnapshot(snapshot));
      });

      const publishSelf = async () => {
        if (!currentUserId || gps.lat == null || gps.lng == null) return;
        const updatedAt = gps.timestamp ?? Date.now();
        const status = resolveLocationStatus(updatedAt);
        try {
          await publishTripMemberLocation(session.db!, tripId, currentUserId, {
            lat: gps.lat,
            lng: gps.lng,
            speedMps: gps.speed,
            heading: gps.heading,
            updatedAt,
            status,
            name: currentUserName,
            travelMode,
          });
        } catch (publishError) {
          console.error("[Rovvy Live] Failed to publish group location:", publishError);
        }
      };

      void publishSelf();
      publishTimer = setInterval(() => {
        void publishSelf();
      }, 10_000);
    };

    void connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (publishTimer) clearInterval(publishTimer);
    };
  }, [
    enabled,
    tripId,
    currentUserId,
    currentUserName,
    travelMode,
    gps.lat,
    gps.lng,
    gps.speed,
    gps.heading,
    gps.timestamp,
  ]);

  useEffect(() => {
    if (!enabled || !tripId || !connected) {
      setWayraAlert(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const alert = await fetchWayraLiveContextAlert(tripId);
      if (!cancelled) setWayraAlert(alert);
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, tripId, connected]);

  useEffect(() => {
    if (!enabled || !destination || locations.length === 0) return;

    let cancelled = false;

    const refreshEtas = async () => {
      const next: Record<string, number | null> = {};

      for (const location of locations) {
        if (location.userId === currentUserId) continue;
        if (location.status === "stale") {
          next[location.userId] = null;
          continue;
        }

        const cached = etaCacheRef.current[location.userId];
        if (cached && !shouldRefreshMemberEta(cached.at)) {
          next[location.userId] = cached.eta;
          continue;
        }
        if (etaInflightRef.current.has(location.userId)) {
          next[location.userId] = cached?.eta ?? null;
          continue;
        }

        etaInflightRef.current.add(location.userId);
        try {
          const result = await fetchLiveRoute(
            { lat: location.lat, lng: location.lng },
            destination,
            travelMode,
            false,
            "group_member",
          );
          const eta = etaMinutesFromDuration(result.route?.durationSeconds ?? null);
          etaCacheRef.current[location.userId] = { eta, at: Date.now() };
          next[location.userId] = eta;
        } catch {
          next[location.userId] = cached?.eta ?? null;
        } finally {
          etaInflightRef.current.delete(location.userId);
        }
      }

      if (!cancelled) {
        setMemberEtas((prev) => ({ ...prev, ...next }));
      }
    };

    void refreshEtas();
    const timer = setInterval(() => {
      void refreshEtas();
    }, MEMBER_ETA_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, destination, locations, currentUserId, travelMode]);

  const members = useMemo(
    () =>
      buildConvergeMembers({
        roster,
        locations,
        currentUserId,
        currentUserName,
        yourRouteDurationSeconds,
        memberEtas,
        destination,
        travelMode,
      }),
    [
      roster,
      locations,
      currentUserId,
      currentUserName,
      yourRouteDurationSeconds,
      memberEtas,
      destination,
      travelMode,
    ],
  );

  const friends = useMemo(
    () => memberLocationsToFriends(locations, roster, currentUserId),
    [locations, roster, currentUserId],
  );

  const wayraNotice = useMemo(() => wayraNoticeFromAlert(wayraAlert), [wayraAlert]);

  if (!enabled || !tripId) return EMPTY_RESULT;

  return {
    connected,
    error,
    friends,
    members,
    memberLocations: locations,
    wayraNotice,
  };
}
