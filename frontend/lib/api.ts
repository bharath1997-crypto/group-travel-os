export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;

  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody =
    options.body !== undefined &&
    options.body !== null &&
    options.body !== "";
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

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const message = await errorMessageFromResponse(res);
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/** GET (and optional future public methods) without sending auth — for share links. */
export async function apiFetchPublic<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody =
    options.body !== undefined &&
    options.body !== null &&
    options.body !== "";
  if (
    hasBody &&
    !headers.has("Content-Type") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const message = await errorMessageFromResponse(res);
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
