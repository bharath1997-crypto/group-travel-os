import {
  OPENFREEMAP_PUBLIC_ORIGIN,
  resolveOpenFreeMapCleanStyleUrlForLiveMap,
  resolveOpenFreeMapStreetStyleUrlForLiveMap,
  shouldUsePublicOpenFreeMapTileFallback,
} from "@/lib/map-providers";

let prefetchStarted = false;

/** Warm OpenFreeMap style JSON + TLS while Live shell loads (dev fallback path only). */
export function prefetchLiveOpenFreeMapStyles(): void {
  if (typeof window === "undefined" || prefetchStarted) return;
  if (!shouldUsePublicOpenFreeMapTileFallback()) return;
  prefetchStarted = true;

  const head = document.head;
  if (!head.querySelector('link[data-rovvy-preconnect="openfreemap"]')) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = OPENFREEMAP_PUBLIC_ORIGIN;
    preconnect.crossOrigin = "anonymous";
    preconnect.dataset.rovvyPreconnect = "openfreemap";
    head.appendChild(preconnect);
  }

  const styleUrls = [
    resolveOpenFreeMapCleanStyleUrlForLiveMap(),
    resolveOpenFreeMapStreetStyleUrlForLiveMap(),
  ];

  for (const url of styleUrls) {
    void fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" }).catch(
      () => undefined,
    );
  }
}
