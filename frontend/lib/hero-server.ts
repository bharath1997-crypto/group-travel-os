import {
  compassPoint,
  haversineMiles,
  initialBearingDegrees,
  mapDistanceToPlace,
  pointInsideBounds,
  unknownHero,
  type Bounds,
  type HeroPhoto,
  type HeroPrecision,
  type HeroResponse,
  type HeroWeather,
} from "./hero-location";
import {
  type HeroPhotoCandidate,
  MIN_TIER_SURVIVORS,
  PHOTO_RADIUS_TIERS_KM,
  blockedPhotoText,
  chooseRankedPhoto,
  commonsFilenameFromValue,
  lowQualityMetadata,
  passesTechnicalBar,
  qualityAssessmentRank,
  roundedCoordinateKey,
  stripHtml,
} from "./hero-photo-quality";

type FetchLike = typeof fetch;

type ProviderDependencies = {
  fetchImpl?: FetchLike;
  now?: () => Date;
  flickrApiKey?: string | null;
};

type RequestPoint = {
  lat: number;
  lon: number;
  precision: Exclude<HeroPrecision, null>;
  ipCity?: string | null;
  ipRegion?: string | null;
  ipCountry?: string | null;
};

type ReversePlace = {
  neighbourhood: string | null;
  locality: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  centreLat: number;
  centreLon: number;
  bounds: Bounds | null;
};

type WeatherResult = {
  weather: HeroWeather | null;
  hourBucket: HeroResponse["hourBucket"];
  localDate: string;
};

type DecorationCacheValue = {
  weather: HeroWeather | null;
  photo: HeroPhoto | null;
  dominantColor: string;
  hourBucket: HeroResponse["hourBucket"];
  cachedAt: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const WIKIDATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WIKIDATA_RADIUS_KM = 8;
const USER_AGENT = "RovvyExploreHero/1.0 (+https://rovvy.app; contact: contact@rovvy.app)";
const CITY_HUES: Record<string, string> = {
  chicago: "#2A3A34",
  "new york": "#263744",
  "new orleans": "#49322F",
  austin: "#34422D",
  denver: "#344653",
  london: "#384247",
  paris: "#4B3E42",
  tokyo: "#3A3347",
};

const decorationCache = new Map<string, { expiresAt: number; value: DecorationCacheValue }>();
const wikidataCache = new Map<string, { expiresAt: number; rows: WikidataEntity[] }>();
let nominatimQueue: Promise<void> = Promise.resolve();
let lastNominatimStartedAt = 0;

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function normalizeCity(city: string | null): string {
  return (city ?? "unknown").trim().toLowerCase().replace(/\s+/g, " ");
}

function cityHue(city: string | null): string {
  const normalized = normalizeCity(city);
  if (CITY_HUES[normalized]) return CITY_HUES[normalized];
  let hash = 2166136261;
  for (const char of normalized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 20% 24%)`;
}

async function fetchJson<T>(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(5500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function rateLimitedNominatim<T>(task: () => Promise<T>): Promise<T> {
  let release: () => void = () => undefined;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = nominatimQueue;
  nominatimQueue = previous.then(() => turn);
  await previous;
  const wait = Math.max(0, 1000 - (Date.now() - lastNominatimStartedAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimStartedAt = Date.now();
  try {
    return await task();
  } finally {
    release();
  }
}

async function reverseGeocode(fetchImpl: FetchLike, lat: number, lon: number): Promise<ReversePlace | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  const run = () =>
    fetchJson<Record<string, unknown>>(fetchImpl, url.toString(), {
      headers: {
        "User-Agent": "RovvyExploreHero/1.0 (+https://rovvy.app; contact: contact@rovvy.app)",
        Accept: "application/json",
      },
    });
  const data = fetchImpl === fetch ? await rateLimitedNominatim(run) : await run();
  if (!data) return null;

  const address = (data.address ?? {}) as Record<string, string | undefined>;
  const box = Array.isArray(data.boundingbox) ? data.boundingbox.map(Number) : [];
  const bounds =
    box.length === 4 && box.every(Number.isFinite)
      ? { south: box[0], north: box[1], west: box[2], east: box[3] }
      : null;
  const fallbackLat = finiteCoordinate(data.lat, -90, 90) ?? lat;
  const fallbackLon = finiteCoordinate(data.lon, -180, 180) ?? lon;
  const centreLat = bounds ? (bounds.south + bounds.north) / 2 : fallbackLat;
  const centreLon = bounds ? (bounds.west + bounds.east) / 2 : fallbackLon;
  const regionCode = address["ISO3166-2-lvl4"]?.split("-").at(-1) ?? address.state_code ?? address.state ?? null;

  return {
    neighbourhood: address.neighbourhood ?? address.suburb ?? address.quarter ?? null,
    locality: address.town ?? address.village ?? address.municipality ?? address.suburb ?? null,
    city: address.city ?? address.town ?? address.municipality ?? address.county ?? null,
    region: regionCode,
    country: address.country_code?.toUpperCase() ?? address.country ?? null,
    centreLat,
    centreLon,
    bounds,
  };
}

function weatherState(code: number | null): string | null {
  if (code === null) return null;
  if (code <= 1) return "clear";
  if (code <= 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storms";
  return "mixed weather";
}

function shortHour(value: string): string {
  const hour = Number(value.slice(11, 13));
  if (!Number.isFinite(hour)) return "later";
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  return String(hour > 12 ? hour - 12 : hour);
}

function parseLocalHour(value: string | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

async function getWeather(fetchImpl: FetchLike, lat: number, lon: number, now: Date): Promise<WeatherResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code");
  url.searchParams.set("hourly", "weather_code");
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("forecast_hours", "6");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  const data = await fetchJson<Record<string, unknown>>(fetchImpl, url.toString());
  if (!data) return { weather: null, hourBucket: null, localDate: now.toISOString().slice(0, 10) };

  const current = (data.current ?? {}) as Record<string, unknown>;
  const hourly = (data.hourly ?? {}) as { time?: string[]; weather_code?: number[] };
  const daily = (data.daily ?? {}) as { sunrise?: string[]; sunset?: string[] };
  const tempC = finiteCoordinate(current.temperature_2m, -100, 100);
  const humidity = finiteCoordinate(current.relative_humidity_2m, 0, 100);
  const currentCode = finiteCoordinate(current.weather_code, 0, 99);
  const state = weatherState(currentCode);
  const nextChangeIndex = (hourly.weather_code ?? []).findIndex(
    (code, index) => index > 0 && weatherState(code) !== state,
  );
  const nextState = nextChangeIndex > 0 ? weatherState(hourly.weather_code?.[nextChangeIndex] ?? null) : null;
  const changeHour = nextChangeIndex > 0 ? shortHour(hourly.time?.[nextChangeIndex] ?? "") : null;
  let phrase = humidity !== null && humidity >= 75 && (state === "clear" || state === "cloudy") ? "humid" : state;
  if (state && nextState && changeHour) {
    phrase = ["rain", "snow", "storms"].includes(nextState)
      ? `${nextState} from ${changeHour}`
      : `${state} till ${changeHour}`;
  }

  const currentTime = String(current.time ?? hourly.time?.[0] ?? now.toISOString());
  const currentMs = parseLocalHour(currentTime) ?? now.valueOf();
  const sunriseMs = parseLocalHour(daily.sunrise?.[0]);
  const sunsetMs = parseLocalHour(daily.sunset?.[0]);
  let hourBucket: HeroResponse["hourBucket"] = "night";
  if (sunriseMs !== null && Math.abs(currentMs - sunriseMs) <= 60 * 60 * 1000) hourBucket = "dawn";
  else if (sunsetMs !== null && Math.abs(currentMs - sunsetMs) <= 60 * 60 * 1000) hourBucket = "dusk";
  else if (sunriseMs !== null && sunsetMs !== null && currentMs > sunriseMs && currentMs < sunsetMs) hourBucket = "day";

  return {
    weather: tempC === null && !phrase ? null : { tempC, tempF: tempC === null ? null : Math.round((tempC * 9) / 5 + 32), phrase },
    hourBucket,
    localDate: currentTime.slice(0, 10),
  };
}

type WikidataEntity = {
  itemLabel: string;
  image: string;
  lat: number | null;
  lon: number | null;
};

function withinRadiusKm(
  searchLat: number,
  searchLon: number,
  photoLat: number | null,
  photoLon: number | null,
  radiusKm: number,
): boolean {
  if (photoLat === null || photoLon === null) return false;
  return haversineMiles(searchLat, searchLon, photoLat, photoLon) * 1.609344 <= radiusKm;
}

function parseWktPoint(value: unknown): { lat: number | null; lon: number | null } {
  if (typeof value !== "string") return { lat: null, lon: null };
  const match = value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!match) return { lat: null, lon: null };
  return {
    lon: finiteCoordinate(Number(match[1]), -180, 180),
    lat: finiteCoordinate(Number(match[2]), -90, 90),
  };
}

function wikidataSparql(lat: number, lon: number): string {
  return `
SELECT ?item ?itemLabel ?image ?coord WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${WIKIDATA_RADIUS_KM}" .
  }
  ?item wdt:P18 ?image .
  ?item wdt:P31/wdt:P279* ?type .
  VALUES ?type {
    wd:Q4989906
    wd:Q22698
    wd:Q41176
    wd:Q811979
    wd:Q57831
    wd:Q3957
    wd:Q123705
    wd:Q1107656
    wd:Q12280
    wd:Q2039348
    wd:Q207694
    wd:Q24354
    wd:Q1007870
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT 40`.trim();
}

async function queryWikidataEntities(fetchImpl: FetchLike, lat: number, lon: number): Promise<WikidataEntity[]> {
  const cacheKey = roundedCoordinateKey(lat, lon);
  const cached = wikidataCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.rows;

  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("format", "json");
  url.searchParams.set("query", wikidataSparql(lat, lon));
  const data = await fetchJson<{ results?: { bindings?: Array<Record<string, { value?: string }>> } }>(
    fetchImpl,
    url.toString(),
    { headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" } },
  );
  const rows = (data?.results?.bindings ?? []).flatMap((binding) => {
    const image = binding.image?.value;
    if (!image) return [];
    const point = parseWktPoint(binding.coord?.value);
    return [{
      itemLabel: binding.itemLabel?.value ?? "",
      image,
      lat: point.lat,
      lon: point.lon,
    } satisfies WikidataEntity];
  });
  wikidataCache.set(cacheKey, { expiresAt: now + WIKIDATA_CACHE_TTL_MS, rows });
  return rows;
}

function candidatePassesQuality(candidate: HeroPhotoCandidate): boolean {
  if (!candidate.url) return false;
  if (blockedPhotoText(candidate.title, candidate.description, candidate.entityLabel)) return false;
  if (!passesTechnicalBar(candidate.width, candidate.height)) return false;
  return true;
}

function survivorsWithinRadius(
  candidates: HeroPhotoCandidate[],
  searchLat: number,
  searchLon: number,
  radiusKm: number,
): HeroPhotoCandidate[] {
  return candidates.filter(
    (candidate) =>
      candidatePassesQuality(candidate) &&
      withinRadiusKm(searchLat, searchLon, candidate.lat, candidate.lon, radiusKm),
  );
}

function toHeroPhoto(candidate: HeroPhotoCandidate | null): HeroPhoto | null {
  if (!candidate?.url) return null;
  return {
    url: candidate.url,
    width: candidate.width,
    height: candidate.height,
    credit: candidate.credit,
    creditUrl: candidate.creditUrl,
    lat: candidate.lat,
    lon: candidate.lon,
    dominantColor: candidate.dominantColor ?? "#2A3A34",
  };
}

function candidateFromCommonsPage(
  page: Record<string, unknown>,
  source: HeroPhotoCandidate["source"],
  entityLabel = "",
): HeroPhotoCandidate | null {
  const title = String(page.title ?? "");
  const coordinate = (Array.isArray(page.coordinates) ? page.coordinates[0] : null) as
    | { lat?: number; lon?: number }
    | null;
  const info = (Array.isArray(page.imageinfo) ? page.imageinfo[0] : null) as Record<string, unknown> | null;
  if (!info) return null;

  const metadata = (info.extmetadata ?? {}) as Record<string, { value?: unknown }>;
  if (lowQualityMetadata(metadata)) return null;

  const description =
    stripHtml(metadata.ImageDescription?.value) ??
    stripHtml(metadata.ObjectName?.value) ??
    stripHtml(metadata.Caption?.value) ??
    "";
  const filename = title.replace(/^File:/i, "");
  if (blockedPhotoText(title, filename, description, entityLabel)) return null;

  const photoLat = finiteCoordinate(coordinate?.lat, -90, 90);
  const photoLon = finiteCoordinate(coordinate?.lon, -180, 180);
  const originalWidth = finiteCoordinate(info.width, 0, 100000);
  const originalHeight = finiteCoordinate(info.height, 0, 100000);
  if (!passesTechnicalBar(originalWidth, originalHeight)) return null;

  const artist = stripHtml(metadata.Artist?.value) ?? stripHtml(metadata.Credit?.value);
  const license = stripHtml(metadata.LicenseShortName?.value) ?? "Wikimedia Commons";
  const width = finiteCoordinate(info.thumbwidth, 0, 100000) ?? originalWidth;
  const height = finiteCoordinate(info.thumbheight, 0, 100000) ?? originalHeight;
  const url = typeof info.thumburl === "string" ? info.thumburl : typeof info.url === "string" ? info.url : null;
  if (!url) return null;

  return {
    url,
    width,
    height,
    credit: `Photo${artist ? ` by ${artist}` : ""}, ${license}`,
    creditUrl: typeof info.descriptionurl === "string" ? info.descriptionurl : null,
    lat: photoLat,
    lon: photoLon,
    dominantColor: "#2A3A34",
    title,
    description,
    entityLabel,
    source,
    assessmentRank: qualityAssessmentRank(metadata),
  };
}

async function fetchCommonsPages(
  fetchImpl: FetchLike,
  titles: string[],
): Promise<Record<string, Record<string, unknown>>> {
  if (!titles.length) return {};
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query",
    titles: titles.map((title) => (title.startsWith("File:") ? title : `File:${title}`)).join("|"),
    prop: "coordinates|imageinfo",
    iiprop: "url|extmetadata|dimensions",
    iiurlwidth: "2880",
    format: "json",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const data = await fetchJson<{ query?: { pages?: Record<string, Record<string, unknown>> } }>(fetchImpl, url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  return data?.query?.pages ?? {};
}

async function wikidataPhotoCandidates(fetchImpl: FetchLike, lat: number, lon: number): Promise<HeroPhotoCandidate[]> {
  const entities = await queryWikidataEntities(fetchImpl, lat, lon);
  if (!entities.length) return [];

  const filenames = entities
    .map((entity) => commonsFilenameFromValue(entity.image))
    .filter(Boolean);
  const pages = await fetchCommonsPages(fetchImpl, filenames);
  const pageList = Object.values(pages);

  return entities.flatMap((entity) => {
    const filename = commonsFilenameFromValue(entity.image);
    const page = pageList.find((entry) => {
      const title = String(entry.title ?? "");
      return title.toLowerCase() === `file:${filename.toLowerCase()}` || title.toLowerCase().includes(filename.toLowerCase().replace(/ /g, "_"));
    });
    if (!page) return [];
    const candidate = candidateFromCommonsPage(page, "wikidata", entity.itemLabel);
    if (!candidate) return [];
    return [{
      ...candidate,
      lat: candidate.lat ?? entity.lat,
      lon: candidate.lon ?? entity.lon,
      entityLabel: entity.itemLabel,
    }];
  });
}

async function commonsPhotoCandidates(
  fetchImpl: FetchLike,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<HeroPhotoCandidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: String(Math.round(radiusKm * 1000)),
    ggslimit: "40",
    ggsnamespace: "6",
    prop: "coordinates|imageinfo",
    iiprop: "url|extmetadata|dimensions",
    iiurlwidth: "2880",
    format: "json",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const data = await fetchJson<{ query?: { pages?: Record<string, Record<string, unknown>> } }>(fetchImpl, url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  return Object.values(data?.query?.pages ?? {})
    .map((page) => candidateFromCommonsPage(page, "commons"))
    .filter((candidate): candidate is HeroPhotoCandidate => candidate !== null);
}

const FLICKR_LICENSES: Record<string, string> = {
  "1": "CC BY-NC-SA",
  "2": "CC BY-NC",
  "4": "CC BY",
  "5": "CC BY-SA",
  "7": "No known copyright restrictions",
  "9": "CC0",
  "10": "Public domain",
};

async function flickrPhotoCandidates(
  fetchImpl: FetchLike,
  apiKey: string,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<HeroPhotoCandidate[]> {
  const url = new URL("https://www.flickr.com/services/rest/");
  Object.entries({
    method: "flickr.photos.search",
    api_key: apiKey,
    lat: String(lat),
    lon: String(lon),
    radius: String(radiusKm),
    radius_units: "km",
    license: "1,2,4,5,7,9,10",
    has_geo: "1",
    sort: "interestingness-desc",
    extras: "url_h,geo,license,owner_name",
    per_page: "40",
    format: "json",
    nojsoncallback: "1",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const data = await fetchJson<{ photos?: { photo?: Array<Record<string, unknown>> } }>(fetchImpl, url.toString());
  return (data?.photos?.photo ?? []).flatMap((item) => {
    const title = String(item.title ?? "");
    const photoLat = finiteCoordinate(item.latitude, -90, 90);
    const photoLon = finiteCoordinate(item.longitude, -180, 180);
    const width = finiteCoordinate(item.width_h, 0, 100000);
    const height = finiteCoordinate(item.height_h, 0, 100000);
    if (typeof item.url_h !== "string") return [];
    if (blockedPhotoText(title)) return [];
    if (!passesTechnicalBar(width, height)) return [];
    const owner = typeof item.ownername === "string" ? item.ownername : null;
    const license = FLICKR_LICENSES[String(item.license ?? "")] ?? "Flickr Creative Commons";
    return [{
      url: item.url_h,
      width,
      height,
      credit: `Photo${owner ? ` by ${owner}` : ""}, ${license}`,
      creditUrl: `https://www.flickr.com/photos/${String(item.owner ?? "")}/${String(item.id ?? "")}`,
      lat: photoLat,
      lon: photoLon,
      dominantColor: "#2A3A34",
      title,
      description: "",
      entityLabel: "",
      source: "flickr" as const,
      assessmentRank: 0,
    }];
  });
}

async function getPhoto(
  fetchImpl: FetchLike,
  flickrApiKey: string | null,
  lat: number,
  lon: number,
  seed: string,
): Promise<HeroPhoto | null> {
  const wikidataSurvivors = survivorsWithinRadius(
    await wikidataPhotoCandidates(fetchImpl, lat, lon),
    lat,
    lon,
    WIKIDATA_RADIUS_KM,
  );
  if (wikidataSurvivors.length) {
    return toHeroPhoto(chooseRankedPhoto(wikidataSurvivors, seed));
  }

  let fallbackSurvivors: HeroPhotoCandidate[] = [];
  for (const radiusKm of PHOTO_RADIUS_TIERS_KM) {
    const survivors = survivorsWithinRadius(
      await commonsPhotoCandidates(fetchImpl, lat, lon, radiusKm),
      lat,
      lon,
      radiusKm,
    );
    if (survivors.length >= MIN_TIER_SURVIVORS) {
      return toHeroPhoto(chooseRankedPhoto(survivors, seed));
    }
    if (survivors.length) fallbackSurvivors = survivors;
  }

  if (fallbackSurvivors.length) {
    return toHeroPhoto(chooseRankedPhoto(fallbackSurvivors, seed));
  }

  if (flickrApiKey) {
    const flickrSurvivors = survivorsWithinRadius(
      await flickrPhotoCandidates(fetchImpl, flickrApiKey, lat, lon, PHOTO_RADIUS_TIERS_KM.at(-1) ?? 25),
      lat,
      lon,
      PHOTO_RADIUS_TIERS_KM.at(-1) ?? 25,
    );
    if (flickrSurvivors.length) {
      return toHeroPhoto(chooseRankedPhoto(flickrSurvivors, seed));
    }
  }

  return null;
}

async function resolveIpPoint(fetchImpl: FetchLike, clientIp?: string | null): Promise<RequestPoint | null> {
  const safeIp = clientIp?.split(",")[0].trim();
  const target = safeIp && safeIp !== "::1" && safeIp !== "127.0.0.1"
    ? `https://ipapi.co/${encodeURIComponent(safeIp)}/json/`
    : "https://ipapi.co/json/";
  const data = await fetchJson<Record<string, unknown>>(fetchImpl, target, {
    headers: { "User-Agent": "RovvyExploreHero/1.0 (+https://rovvy.app; contact: contact@rovvy.app)" },
  });
  const lat = finiteCoordinate(data?.latitude, -90, 90);
  const lon = finiteCoordinate(data?.longitude, -180, 180);
  if (lat === null || lon === null) return null;
  return {
    lat,
    lon,
    precision: "ip",
    ipCity: typeof data?.city === "string" ? data.city : null,
    ipRegion: typeof data?.region_code === "string" ? data.region_code : null,
    ipCountry: typeof data?.country_code === "string" ? data.country_code : null,
  };
}

function cacheKey(city: string | null, bucket: HeroResponse["hourBucket"]): string {
  return `v2:${normalizeCity(city)}:${bucket ?? "unknown"}`;
}

export function clearHeroMemoryCacheForTests(): void {
  decorationCache.clear();
  wikidataCache.clear();
}

export async function resolveHero(
  input: { lat?: unknown; lon?: unknown; clientIp?: string | null },
  dependencies: ProviderDependencies = {},
): Promise<HeroResponse> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now?.() ?? new Date();
  const requestedLat = finiteCoordinate(input.lat, -90, 90);
  const requestedLon = finiteCoordinate(input.lon, -180, 180);
  const point: RequestPoint | null =
    requestedLat !== null && requestedLon !== null
      ? { lat: requestedLat, lon: requestedLon, precision: "gps" }
      : await resolveIpPoint(fetchImpl, input.clientIp);
  if (!point) return unknownHero(now);

  const [reverse, weatherResult] = await Promise.all([
    reverseGeocode(fetchImpl, point.lat, point.lon),
    getWeather(fetchImpl, point.lat, point.lon, now),
  ]);
  const city = reverse?.city ?? point.ipCity ?? null;
  const region = reverse?.region ?? point.ipRegion ?? null;
  const country = reverse?.country ?? point.ipCountry ?? null;
  const centreLat = reverse?.centreLat ?? point.lat;
  const centreLon = reverse?.centreLon ?? point.lon;
  const distanceMiles = haversineMiles(point.lat, point.lon, centreLat, centreLon);
  const bearing = compassPoint(initialBearingDegrees(centreLat, centreLon, point.lat, point.lon));
  const mapped = mapDistanceToPlace({
    distanceMiles,
    direction: bearing,
    insideCityBounds: pointInsideBounds(point.lat, point.lon, reverse?.bounds ?? null) || !reverse,
    neighbourhood: reverse?.neighbourhood ?? null,
    locality: reverse?.locality ?? point.ipCity ?? null,
    hubCity: city,
    precision: point.precision,
  });
  if (point.precision === "ip") {
    mapped.placeLabel = city ?? reverse?.locality ?? point.ipCity ?? null;
    mapped.precisionNote = "approximate";
  }

  const key = cacheKey(city, weatherResult.hourBucket);
  const cached = decorationCache.get(key);
  let decoration: DecorationCacheValue;
  if (cached && cached.expiresAt > now.valueOf()) {
    decoration = cached.value;
  } else {
    const dominantColor = cityHue(city);
    const seed = `${normalizeCity(city)}:${weatherResult.localDate}:${weatherResult.hourBucket ?? "unknown"}`;
    const photo = await getPhoto(fetchImpl, dependencies.flickrApiKey ?? process.env.FLICKR_API_KEY ?? null, point.lat, point.lon, seed);
    decoration = {
      weather: weatherResult.weather,
      photo: photo ? { ...photo, dominantColor: photo.dominantColor ?? dominantColor } : null,
      dominantColor,
      hourBucket: weatherResult.hourBucket,
      cachedAt: now.toISOString(),
    };
    decorationCache.set(key, { expiresAt: now.valueOf() + CACHE_TTL_MS, value: decoration });
  }

  return {
    placeLabel: mapped.placeLabel ?? city,
    precisionNote: mapped.precisionNote,
    precision: point.precision,
    city,
    region,
    country,
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    bearing,
    suggestedRadiusMiles: mapped.suggestedRadiusMiles,
    weather: decoration.weather,
    photo: decoration.photo,
    dominantColor: decoration.photo?.dominantColor ?? decoration.dominantColor,
    hourBucket: decoration.hourBucket,
    cachedAt: decoration.cachedAt,
  };
}
