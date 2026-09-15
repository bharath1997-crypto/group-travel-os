export type HeroPrecision = "gps" | "ip" | null;

export type HeroWeather = {
  tempC: number | null;
  tempF: number | null;
  phrase: string | null;
};

export type HeroPhoto = {
  url: string | null;
  width: number | null;
  height: number | null;
  credit: string | null;
  creditUrl: string | null;
  lat: number | null;
  lon: number | null;
  dominantColor: string | null;
};

export type HeroResponse = {
  placeLabel: string | null;
  precisionNote: string | null;
  precision: HeroPrecision;
  city: string | null;
  region: string | null;
  country: string | null;
  distanceMiles: number | null;
  bearing: string | null;
  suggestedRadiusMiles: number | null;
  weather: HeroWeather | null;
  photo: HeroPhoto | null;
  dominantColor: string | null;
  hourBucket: "dawn" | "day" | "dusk" | "night" | null;
  cachedAt: string | null;
};

export type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initialBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  if (haversineMiles(lat1, lon1, lat2, lon2) < 0.05) return null;
  const fromLat = toRadians(lat1);
  const toLat = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

export function compassPoint(bearing: number | null): string | null {
  if (bearing === null) return null;
  const points = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return points[Math.round((bearing % 360) / 45) % 8];
}

export function pointInsideBounds(lat: number, lon: number, bounds: Bounds | null): boolean {
  if (!bounds) return false;
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

type PlaceLabelInput = {
  distanceMiles: number;
  direction: string | null;
  insideCityBounds: boolean;
  neighbourhood: string | null;
  locality: string | null;
  hubCity: string | null;
  precision: HeroPrecision;
};

export function mapDistanceToPlace(input: PlaceLabelInput): Pick<
  HeroResponse,
  "placeLabel" | "precisionNote" | "suggestedRadiusMiles"
> {
  const distance = Math.max(0, input.distanceMiles);
  const miles = Math.round(distance);
  const direction = input.direction ?? "near";
  const hub = input.hubCity;

  if (input.insideCityBounds) {
    return {
      placeLabel: input.neighbourhood && hub ? `${input.neighbourhood}, ${hub}` : hub ?? input.locality,
      precisionNote: input.precision === "gps" ? "exact" : "approximate",
      suggestedRadiusMiles: 15,
    };
  }

  if (distance < 10) {
    return {
      placeLabel: input.locality ?? input.neighbourhood ?? hub,
      precisionNote: hub ? `${miles} mi ${direction} of ${hub}` : "approximate",
      suggestedRadiusMiles: 15,
    };
  }

  if (distance <= 40) {
    return {
      placeLabel: hub ? `${hub} area` : input.locality,
      precisionNote: hub ? `${miles} mi ${direction} of ${hub}` : "approximate",
      suggestedRadiusMiles: Math.max(25, Math.min(60, Math.ceil(distance / 5) * 5)),
    };
  }

  if (distance <= 100) {
    return {
      placeLabel: input.locality ?? input.neighbourhood ?? hub,
      precisionNote: hub ? `${miles} mi ${direction} · nearest hub ${hub}` : "approximate",
      suggestedRadiusMiles: 60,
    };
  }

  return {
    placeLabel: "No city nearby",
    precisionNote: "showing what's within 60 mi",
    suggestedRadiusMiles: 60,
  };
}

export function keepIpHeroAfterGeolocationDenied(current: HeroResponse | null): HeroResponse | null {
  if (!current) return null;
  return {
    ...current,
    precision: current.precision === "gps" ? "ip" : current.precision,
    precisionNote: current.precision === "gps" ? "approximate" : current.precisionNote,
  };
}

export function unknownHero(now = new Date()): HeroResponse {
  return {
    placeLabel: null,
    precisionNote: null,
    precision: null,
    city: null,
    region: null,
    country: null,
    distanceMiles: null,
    bearing: null,
    suggestedRadiusMiles: null,
    weather: null,
    photo: null,
    dominantColor: "#2A3A34",
    hourBucket: null,
    cachedAt: now.toISOString(),
  };
}
