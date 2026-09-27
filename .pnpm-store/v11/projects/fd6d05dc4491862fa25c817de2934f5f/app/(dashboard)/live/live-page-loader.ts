import { prefetchLiveOpenFreeMapStyles } from "./live-map-style-prefetch";

/** Retry dynamic import when dev HMR serves a stale or slow Live chunk. */
export async function loadLivePageClientModule(retry = 0): Promise<typeof import("./LivePageClient")> {
  prefetchLiveOpenFreeMapStyles();
  try {
    return await import("./LivePageClient");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError =
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes("Failed to fetch dynamically imported module");

    if (isChunkError && retry < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (retry + 1)));
      return loadLivePageClientModule(retry + 1);
    }

    throw error;
  }
}
