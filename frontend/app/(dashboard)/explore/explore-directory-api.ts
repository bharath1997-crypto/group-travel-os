const API_ROOT =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1").replace(/\/api\/v1\/?$/, "") ||
  "http://localhost:8001";

const DIRECTORY_BASE = `${API_ROOT}/api/v2/explorer/directory`;

async function directoryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DIRECTORY_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) {
    throw new Error(`Directory request failed (${response.status})`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

export type DirectoryStateSummary = {
  slug: string;
  name: string;
  state_code: string | null;
  population: number | null;
  event_count: number;
};

export type DirectoryCitySummary = {
  slug: string;
  name: string;
  state_code: string | null;
  population: number | null;
  event_count: number;
  lat: number | null;
  lng: number | null;
};

export type DirectoryWikipedia = {
  extract: string;
  title: string;
  url: string;
  license_label: string;
  attribution: string;
};

export type DirectoryNearestCity = {
  kind: string;
  slug: string;
  name: string;
  state_code: string | null;
  state_slug: string;
  state_name: string | null;
  population: number | null;
  event_count: number;
  distance_miles?: number | null;
};

export type DirectoryStatePage = {
  slug: string;
  name: string;
  state_code: string | null;
  population: number | null;
  event_count: number;
  wikipedia: DirectoryWikipedia | null;
  indexable: boolean;
  cities: DirectoryCitySummary[];
};

export type DirectoryCityPage = {
  slug: string;
  name: string;
  state_slug: string;
  state_name: string;
  state_code: string | null;
  population: number | null;
  lat: number | null;
  lng: number | null;
  event_count: number;
  place_count: number;
  wikipedia: DirectoryWikipedia | null;
  indexable: boolean;
  nearest_with_events: DirectoryNearestCity | null;
};

export type DirectorySearchHit = DirectoryNearestCity;

const REVALIDATE_SECONDS = 4 * 60 * 60;

export async function fetchDirectoryStates(): Promise<DirectoryStateSummary[]> {
  return directoryFetch<DirectoryStateSummary[]>("/states", {
    next: { revalidate: REVALIDATE_SECONDS },
  } as RequestInit);
}

export async function fetchDirectoryState(stateSlug: string): Promise<DirectoryStatePage | null> {
  try {
    return await directoryFetch<DirectoryStatePage>(`/${encodeURIComponent(stateSlug)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    } as RequestInit);
  } catch {
    return null;
  }
}

export async function fetchDirectoryCity(
  stateSlug: string,
  citySlug: string,
): Promise<DirectoryCityPage | null> {
  try {
    return await directoryFetch<DirectoryCityPage>(
      `/${encodeURIComponent(stateSlug)}/${encodeURIComponent(citySlug)}`,
      { next: { revalidate: REVALIDATE_SECONDS } } as RequestInit,
    );
  } catch {
    return null;
  }
}

export async function searchDirectory(q: string): Promise<DirectorySearchHit[]> {
  const params = new URLSearchParams({ q: q.trim(), limit: "10" });
  return directoryFetch<DirectorySearchHit[]>(`/search?${params.toString()}`);
}

export async function nearestDirectoryCity(lat: number, lng: number): Promise<DirectoryNearestCity | null> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  try {
    return await directoryFetch<DirectoryNearestCity | null>(`/nearest?${params.toString()}`);
  } catch {
    return null;
  }
}
