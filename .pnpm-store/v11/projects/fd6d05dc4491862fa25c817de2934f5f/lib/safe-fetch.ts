/**
 * Thin companion to `@/lib/api`.
 *
 * `@/lib/api` is the project's fetch entry point and already normalises its
 * RequestInit internally, so nothing is re-implemented here — these are plain
 * re-exports. The one thing this module adds is `optionalSignalInit`, for call
 * sites that hold a possibly-undefined AbortSignal and would otherwise build
 * `{ signal: undefined }`.
 */

export {
  apiFetch,
  apiFetchWithStatus,
  fetchWithTimeout,
  normalizeRequestInit,
  ApiFetchError,
} from "@/lib/api";

/** Build RequestInit with signal only when present (avoids `{ signal: undefined }`). */
export function optionalSignalInit(signal?: AbortSignal | null): RequestInit {
  if (signal && typeof signal.aborted === "boolean") {
    return { signal };
  }
  return {};
}
