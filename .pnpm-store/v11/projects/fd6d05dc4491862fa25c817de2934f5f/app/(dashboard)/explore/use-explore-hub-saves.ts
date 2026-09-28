"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";



import { isLoggedIn } from "@/lib/auth";

import { useDashboardUser } from "@/contexts/dashboard-user-context";



import { createCollectionItem, fetchCollectionItems } from "../collection/collection-api";

import type { ExploreSlot } from "./explore-hub-data";

import {

  collectionCreateBodyFromExploreSlot,

  exploreListingSaveKey,

  restoredExploreSavedSlotIds,

  slotIdFromExploreSaveKey,

  type ExploreSaveUiState,

} from "./explore-hub-save";



export type ExploreSavesReloadState = "idle" | "loading" | "loaded" | "error";



export function useExploreHubSaves(displayCity: string) {

  const { user, loading: userLoading } = useDashboardUser();

  const router = useRouter();

  const pathname = usePathname();

  const loginNext = encodeURIComponent(pathname || "/explore");



  /** Hub session selection (saved bar); not a Collection delete on clear. */

  const [savedSlotIds, setSavedSlotIds] = useState<string[]>([]);

  const [persistedKeys, setPersistedKeys] = useState<Set<string>>(() => new Set());

  const [saveStateById, setSaveStateById] = useState<Record<string, ExploreSaveUiState>>({});

  const [saveErrorById, setSaveErrorById] = useState<Record<string, string>>({});

  const [reloadState, setReloadState] = useState<ExploreSavesReloadState>("idle");

  const [reloadError, setReloadError] = useState<string | null>(null);

  const loadSeq = useRef(0);



  const persistedSlotIds = useMemo(() => {

    const ids = new Set<string>();

    for (const key of persistedKeys) {

      const id = slotIdFromExploreSaveKey(key);

      if (id) ids.add(id);

    }

    return ids;

  }, [persistedKeys]);



  const reloadFromServer = useCallback(async (): Promise<boolean> => {

    if (!user || userLoading || !isLoggedIn()) return false;

    const seq = ++loadSeq.current;

    setReloadState("loading");

    try {

      const data = await fetchCollectionItems();

      if (seq !== loadSeq.current) return false;

      const keys = new Set<string>();

      for (const item of data.items) {

        const key = item.saved_from?.trim();

        if (key?.startsWith("explore:listing:")) keys.add(key);

      }

      setPersistedKeys(keys);

      const restored = restoredExploreSavedSlotIds(data.items);

      setSavedSlotIds(restored);

      setSaveStateById((prev) => {

        const next = { ...prev };

        for (const id of restored) {

          next[id] = "saved";

        }

        return next;

      });

      setReloadState("loaded");

      setReloadError(null);

      return true;

    } catch (err) {

      if (seq !== loadSeq.current) return false;

      const message =

        err instanceof Error ? err.message : "Could not load your saved listings from My Space";

      setReloadState("error");

      setReloadError(message);

      return false;

    }

  }, [user, userLoading]);



  useEffect(() => {

    if (userLoading) return;

    if (!user) {

      setSavedSlotIds([]);

      setPersistedKeys(new Set());

      setSaveStateById({});

      setSaveErrorById({});

      setReloadState("idle");

      setReloadError(null);

      return;

    }

    if (!isLoggedIn()) return;

    void reloadFromServer();

  }, [user, user?.id, userLoading, reloadFromServer]);



  const isListingSaved = useCallback(

    (slot: ExploreSlot) => {

      const key = exploreListingSaveKey(slot);

      if (persistedKeys.has(key)) return true;

      if (saveStateById[slot.id] === "saved") return true;

      return savedSlotIds.includes(slot.id);

    },

    [persistedKeys, saveStateById, savedSlotIds],

  );



  const saveListing = useCallback(

    async (slot: ExploreSlot): Promise<boolean> => {

      if (!user) {

        router.push(`/login?next=${loginNext}`);

        return false;

      }

      const key = exploreListingSaveKey(slot);

      if (persistedKeys.has(key) || savedSlotIds.includes(slot.id)) {

        setSaveStateById((s) => ({ ...s, [slot.id]: "saved" }));

        setSavedSlotIds((all) => (all.includes(slot.id) ? all : [...all, slot.id]));

        return true;

      }



      setSaveStateById((s) => ({ ...s, [slot.id]: "saving" }));

      setSaveErrorById((e) => {

        const next = { ...e };

        delete next[slot.id];

        return next;

      });



      try {

        await createCollectionItem(collectionCreateBodyFromExploreSlot(slot, displayCity));

        setPersistedKeys((prev) => new Set(prev).add(key));

        setSavedSlotIds((all) => (all.includes(slot.id) ? all : [...all, slot.id]));

        setSaveStateById((s) => ({ ...s, [slot.id]: "saved" }));

        return true;

      } catch (err) {

        const message = err instanceof Error ? err.message : "Could not save listing";

        setSaveStateById((s) => ({ ...s, [slot.id]: "error" }));

        setSaveErrorById((e) => ({ ...e, [slot.id]: message }));

        return false;

      }

    },

    [user, router, loginNext, displayCity, persistedKeys, savedSlotIds],

  );



  /** Clears the planning bar only; Collection items stay on the server. */

  const clearSessionSelection = useCallback(() => {

    setSavedSlotIds([]);

  }, []);



  const saveUiState = useCallback(

    (slotId: string): ExploreSaveUiState => {

      const direct = saveStateById[slotId];

      if (direct === "saving" || direct === "error") return direct;

      if (persistedSlotIds.has(slotId)) return "saved";

      if (direct === "saved" || savedSlotIds.includes(slotId)) return "saved";

      return "idle";

    },

    [saveStateById, persistedSlotIds, savedSlotIds],

  );



  const saveError = useCallback(

    (slotId: string): string | undefined => saveErrorById[slotId],

    [saveErrorById],

  );



  return {

    user,

    savedSlotIds,

    isListingSaved,

    saveListing,

    clearSessionSelection,

    saveUiState,

    saveError,

    reloadFromServer,

    reloadState,

    reloadError,

    retryReloadSaves: reloadFromServer,

  };

}


