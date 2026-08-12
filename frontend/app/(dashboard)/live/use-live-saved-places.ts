"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listLiveSavedPlaces,
  SAVED_PLACES_CHANGED_EVENT,
  type LiveSavedPlace,
} from "./live-saved-places-store";

export function useLiveSavedPlaces(): LiveSavedPlace[] {
  const [places, setPlaces] = useState<LiveSavedPlace[]>(() =>
    typeof window === "undefined" ? [] : listLiveSavedPlaces(),
  );

  const refresh = useCallback(() => {
    setPlaces(listLiveSavedPlaces());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(SAVED_PLACES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SAVED_PLACES_CHANGED_EVENT, refresh);
  }, [refresh]);

  return places;
}
