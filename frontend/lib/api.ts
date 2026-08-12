import { getToken } from "@/lib/auth";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const DEFAULT_TIMEOUT_MS =
  typeof process !== "undefined" && process.env.NODE_ENV === "development"
    ? 45000
    : 8000;

const API_UNAVAILABLE_PATTERN =
  /timed out|database might be waking|Failed to fetch|Network error|Could not reach|network request failed|load failed/i;

/** Thrown by apiFetch on timeout/network failure — dev overlay suppresses these. */
export class ApiFetchError extends Error {
  readonly rovvyApiUnavailable = true;

  constructor(message: string) {
    super(message);
    this.name = "ApiFetchError";
  }
}

function isApiUnavailableError(reason: unknown): boolean {
  if (
    reason instanceof ApiFetchError ||
    (typeof reason === "object" &&
      reason !== null &&
      "rovvyApiUnavailable" in reason &&
      (reason as { rovvyApiUnavailable?: boolean }).rovvyApiUnavailable)
  ) {
    return true;
  }
  const message =
    reason instanceof Error ? reason.message : reason != null ? String(reason) : "";
  return API_UNAVAILABLE_PATTERN.test(message);
}

function installApiRejectionGuard() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __rovvyApiRejectionGuard?: boolean };
  if (w.__rovvyApiRejectionGuard) return;
  w.__rovvyApiRejectionGuard = true;

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      if (!isApiUnavailableError(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      const message =
        event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
      console.warn("[Rovvy] API unavailable (backend slow or offline):", message);
    },
    true,
  );
}

installApiRejectionGuard();

/** Never pass null/undefined/non-object init into fetch or destructure .signal blindly. */
export function normalizeRequestInit(init?: RequestInit | null): RequestInit {
  if (init == null || typeof init !== "object") return {};
  const out: RequestInit = { ...init };
  if (out.signal === undefined) {
    delete (out as { signal?: AbortSignal }).signal;
  }
  return out;
}

function networkErrorMessage(url: string, cause: unknown): string {
  let origin = API_BASE;
  try {
    origin = new URL(url).origin;
  } catch {
    /* keep API_BASE */
  }
  const hint =
    "Start the FastAPI server (port 8000), confirm NEXT_PUBLIC_API_URL in frontend/.env.local, and use an origin allowed by ALLOWED_ORIGINS (localhost and 127.0.0.1 are included by default).";
  if (cause instanceof TypeError) {
    return `Network error calling ${origin}. ${hint}`;
  }
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (/Failed to fetch|NetworkError|load failed|Network request failed/i.test(msg)) {
    return `Could not reach ${origin}. ${hint}`;
  }
  return msg;
}

async function errorMessageFromResponse(res: Response): Promise<string> {
  const fallback = res.statusText || "Request failed";
  try {
    const errBody: unknown = await res.json();
    if (
      typeof errBody === "object" &&
      errBody !== null &&
      "detail" in errBody
    ) {
      const detail = (errBody as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof (item as { msg: unknown }).msg === "string"
              ? (item as { msg: string }).msg
              : JSON.stringify(item),
          )
          .join("; ");
      }
      if (detail != null) return String(detail);
    }
  } catch {
    /* use default message */
  }
  return fallback;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const opts = normalizeRequestInit(options);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;

  const headers = new Headers(opts.headers);
  const method = (opts.method ?? "GET").toUpperCase();
  const hasBody =
    opts.body !== undefined &&
    opts.body !== null &&
    opts.body !== "";
  if (
    hasBody &&
    !headers.has("Content-Type") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("gt_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(
      url,
      normalizeRequestInit({ ...opts, headers, signal: controller.signal }),
    );
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiFetchError(
        "The request timed out. The database might be waking up or experiencing high latency.",
      );
    }
    throw new ApiFetchError(networkErrorMessage(url, e));
  }

  if (!res.ok) {
    const message = await errorMessageFromResponse(res);
    throw new ApiFetchError(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export async function apiFetchWithStatus<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: T | null; status: number }> {
  const opts = normalizeRequestInit(options);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;
  const token = getToken();

  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (opts.method ?? "GET").toUpperCase();
  const hasBody =
    opts.body !== undefined &&
    opts.body !== null &&
    opts.body !== "";
  if (
    hasBody &&
    !headers.has("Content-Type") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      url,
      normalizeRequestInit({ ...opts, headers, signal: controller.signal }),
    );
    clearTimeout(timeoutId);
    if (!res.ok) return { data: null, status: res.status };
    if (res.status === 204) return { data: null, status: res.status };
    try {
      const data = (await res.json()) as T;
      return { data, status: res.status };
    } catch {
      return { data: null, status: res.status };
    }
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      return { data: null, status: 408 }; // Request Timeout
    }
    return { data: null, status: 0 };
  }
}

/** GET (and optional future public methods) without sending auth — for share links. */
export async function apiFetchPublic<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const opts = normalizeRequestInit(options);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;
  const headers = new Headers(opts.headers);
  const method = (opts.method ?? "GET").toUpperCase();
  const hasBody =
    opts.body !== undefined &&
    opts.body !== null &&
    opts.body !== "";
  if (
    hasBody &&
    !headers.has("Content-Type") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      url,
      normalizeRequestInit({ ...opts, headers, signal: controller.signal }),
    );
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiFetchError(
        "The request timed out. The database might be waking up or experiencing high latency.",
      );
    }
    throw new ApiFetchError(networkErrorMessage(url, e));
  }

  if (!res.ok) {
    const message = await errorMessageFromResponse(res);
    throw new ApiFetchError(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit | null,
): Promise<Response> {
  const safeInit = normalizeRequestInit(init);
  const external = safeInit.signal;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const onExternalAbort = () => {
    clearTimeout(timeout);
    controller.abort();
  };
  if (external) {
    if (external.aborted) {
      clearTimeout(timeout);
      controller.abort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  return fetch(
    input,
    normalizeRequestInit({ ...safeInit, signal: controller.signal }),
  ).finally(() => {
    clearTimeout(timeout);
    if (external) {
      external.removeEventListener("abort", onExternalAbort);
    }
  });
}
