function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

/** Retry dynamic import when dev HMR serves a stale or slow SeatShare chunk. */
export async function loadSeatsPageClientModule(
  retry = 0,
): Promise<typeof import("./SeatsPageClient")> {
  try {
    return await import("./SeatsPageClient");
  } catch (error) {
    if (isChunkLoadError(error) && retry < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (retry + 1)));
      return loadSeatsPageClientModule(retry + 1);
    }
    throw error;
  }
}

export async function loadSeatsRoutePanelModule(
  retry = 0,
): Promise<typeof import("./SeatsRoutePanel")> {
  try {
    return await import("./SeatsRoutePanel");
  } catch (error) {
    if (isChunkLoadError(error) && retry < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (retry + 1)));
      return loadSeatsRoutePanelModule(retry + 1);
    }
    throw error;
  }
}

export async function loadSeatsMapPickModalModule(
  retry = 0,
): Promise<typeof import("./SeatsMapPickModal")> {
  try {
    return await import("./SeatsMapPickModal");
  } catch (error) {
    if (isChunkLoadError(error) && retry < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (retry + 1)));
      return loadSeatsMapPickModalModule(retry + 1);
    }
    throw error;
  }
}
