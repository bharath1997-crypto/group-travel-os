/** Country → state/province → city hierarchy for Explore destination browsing. */

export type ExploreContinentId = "americas" | "europe" | "asia" | "oceania";

export type CatalogCity = {
  id: string;
  name: string;
  subtitle: string;
};

export type CatalogState = {
  id: string;
  name: string;
  code: string;
  hubCity: string;
  lat: number;
  lon: number;
  cities: CatalogCity[];
};

export type CatalogCountry = {
  id: string;
  name: string;
  regionId: ExploreContinentId;
  hubCity: string;
  lat: number;
  lon: number;
  social?: string;
  states?: CatalogState[];
  /** Countries without admin divisions (Singapore, etc.) */
  cities?: CatalogCity[];
};

export const EXPLORE_CONTINENT_TABS: { id: ExploreContinentId; label: string; headline: string }[] = [
  { id: "americas", label: "Americas", headline: "the Americas" },
  { id: "europe", label: "Europe", headline: "Europe" },
  { id: "asia", label: "Asia", headline: "Asia" },
  { id: "oceania", label: "Oceania", headline: "Oceania & Australia" },
];

const US_STATES: CatalogState[] = [
  {
    id: "us-il",
    name: "Illinois",
    code: "IL",
    hubCity: "Chicago",
    lat: 41.8781,
    lon: -87.6298,
    cities: [{ id: "chicago", name: "Chicago", subtitle: "IL · Midwest hub" }],
  },
  {
    id: "us-ny",
    name: "New York",
    code: "NY",
    hubCity: "New York",
    lat: 40.7128,
    lon: -74.006,
    cities: [{ id: "new-york", name: "New York", subtitle: "NY · Broadway & boroughs" }],
  },
  {
    id: "us-la",
    name: "Louisiana",
    code: "LA",
    hubCity: "New Orleans",
    lat: 29.9511,
    lon: -90.0715,
    cities: [{ id: "new-orleans", name: "New Orleans", subtitle: "LA · Festival city" }],
  },
  {
    id: "us-tx",
    name: "Texas",
    code: "TX",
    hubCity: "Austin",
    lat: 30.2672,
    lon: -97.7431,
    cities: [{ id: "austin", name: "Austin", subtitle: "TX · Live music" }],
  },
  {
    id: "us-co",
    name: "Colorado",
    code: "CO",
    hubCity: "Denver",
    lat: 39.7392,
    lon: -104.9903,
    cities: [{ id: "denver", name: "Denver", subtitle: "CO · Trails & breweries" }],
  },
  {
    id: "us-fl",
    name: "Florida",
    code: "FL",
    hubCity: "Miami",
    lat: 25.7617,
    lon: -80.1918,
    cities: [{ id: "miami", name: "Miami", subtitle: "FL · Beach nights" }],
  },
  {
    id: "us-ca",
    name: "California",
    code: "CA",
    hubCity: "Los Angeles",
    lat: 34.0522,
    lon: -118.2437,
    cities: [{ id: "los-angeles", name: "Los Angeles", subtitle: "CA · Coast & comedy" }],
  },
  {
    id: "us-wa",
    name: "Washington",
    code: "WA",
    hubCity: "Seattle",
    lat: 47.6062,
    lon: -122.3321,
    cities: [{ id: "seattle", name: "Seattle", subtitle: "WA · Markets & music" }],
  },
];

export const EXPLORE_COUNTRIES: CatalogCountry[] = [
  {
    id: "us",
    name: "United States",
    regionId: "americas",
    hubCity: "Chicago",
    lat: 41.8781,
    lon: -87.6298,
    social: "50 states · events nationwide",
    states: US_STATES,
  },
  {
    id: "ca",
    name: "Canada",
    regionId: "americas",
    hubCity: "Toronto",
    lat: 43.6532,
    lon: -79.3832,
    social: "Provinces & territories",
    states: [
      {
        id: "ca-on",
        name: "Ontario",
        code: "ON",
        hubCity: "Toronto",
        lat: 43.6532,
        lon: -79.3832,
        cities: [{ id: "toronto", name: "Toronto", subtitle: "ON · Waterfront" }],
      },
      {
        id: "ca-bc",
        name: "British Columbia",
        code: "BC",
        hubCity: "Vancouver",
        lat: 49.2827,
        lon: -123.1207,
        cities: [{ id: "vancouver", name: "Vancouver", subtitle: "BC · Mountains & harbour" }],
      },
      {
        id: "ca-qc",
        name: "Quebec",
        code: "QC",
        hubCity: "Montreal",
        lat: 45.5017,
        lon: -73.5673,
        cities: [{ id: "montreal", name: "Montreal", subtitle: "QC · Jazz & festivals" }],
      },
      {
        id: "ca-ab",
        name: "Alberta",
        code: "AB",
        hubCity: "Calgary",
        lat: 51.0447,
        lon: -114.0719,
        cities: [{ id: "calgary", name: "Calgary", subtitle: "AB · Rockies gateway" }],
      },
    ],
  },
  {
    id: "mx",
    name: "Mexico",
    regionId: "americas",
    hubCity: "Mexico City",
    lat: 19.4326,
    lon: -99.1332,
    social: "Regions & coasts",
    cities: [
      { id: "mexico-city", name: "Mexico City", subtitle: "CDMX · Capital" },
      { id: "cancun", name: "Cancún", subtitle: "QR · Caribbean coast" },
      { id: "guadalajara", name: "Guadalajara", subtitle: "JAL · Tequila country" },
      { id: "oaxaca", name: "Oaxaca", subtitle: "OAX · Food-first" },
    ],
  },
  {
    id: "gb",
    name: "United Kingdom",
    regionId: "europe",
    hubCity: "London",
    lat: 51.5074,
    lon: -0.1278,
    social: "England, Scotland, Wales",
    cities: [{ id: "london", name: "London", subtitle: "England · Theatre & pubs" }],
  },
  {
    id: "ie",
    name: "Ireland",
    regionId: "europe",
    hubCity: "Dublin",
    lat: 53.3498,
    lon: -6.2603,
    cities: [{ id: "dublin", name: "Dublin", subtitle: "Leinster · Trad sessions" }],
  },
  {
    id: "fr",
    name: "France",
    regionId: "europe",
    hubCity: "Paris",
    lat: 48.8566,
    lon: 2.3522,
    cities: [{ id: "paris", name: "Paris", subtitle: "Île-de-France · Museums" }],
  },
  {
    id: "de",
    name: "Germany",
    regionId: "europe",
    hubCity: "Berlin",
    lat: 52.52,
    lon: 13.405,
    cities: [{ id: "berlin", name: "Berlin", subtitle: "Berlin · Clubs & galleries" }],
  },
  {
    id: "nl",
    name: "Netherlands",
    regionId: "europe",
    hubCity: "Amsterdam",
    lat: 52.3676,
    lon: 4.9041,
    cities: [{ id: "amsterdam", name: "Amsterdam", subtitle: "NH · Canals" }],
  },
  {
    id: "it",
    name: "Italy",
    regionId: "europe",
    hubCity: "Rome",
    lat: 41.9028,
    lon: 12.4964,
    cities: [{ id: "rome", name: "Rome", subtitle: "Lazio · Historic centre" }],
  },
  {
    id: "es",
    name: "Spain",
    regionId: "europe",
    hubCity: "Barcelona",
    lat: 41.3874,
    lon: 2.1686,
    cities: [{ id: "barcelona", name: "Barcelona", subtitle: "Catalonia · Tapas & beach" }],
  },
  {
    id: "pt",
    name: "Portugal",
    regionId: "europe",
    hubCity: "Lisbon",
    lat: 38.7223,
    lon: -9.1393,
    cities: [{ id: "lisbon", name: "Lisbon", subtitle: "Lisbon · Fado & hills" }],
  },
  {
    id: "cz",
    name: "Czech Republic",
    regionId: "europe",
    hubCity: "Prague",
    lat: 50.0755,
    lon: 14.4378,
    cities: [{ id: "prague", name: "Prague", subtitle: "Bohemia · Old Town" }],
  },
  {
    id: "at",
    name: "Austria",
    regionId: "europe",
    hubCity: "Vienna",
    lat: 48.2082,
    lon: 16.3738,
    cities: [{ id: "vienna", name: "Vienna", subtitle: "Vienna · Classical & cafés" }],
  },
  {
    id: "jp",
    name: "Japan",
    regionId: "asia",
    hubCity: "Tokyo",
    lat: 35.6762,
    lon: 139.6503,
    cities: [
      { id: "tokyo", name: "Tokyo", subtitle: "Kanto · Neon districts" },
      { id: "osaka", name: "Osaka", subtitle: "Kansai · Street food" },
    ],
  },
  {
    id: "kr",
    name: "South Korea",
    regionId: "asia",
    hubCity: "Seoul",
    lat: 37.5665,
    lon: 126.978,
    cities: [{ id: "seoul", name: "Seoul", subtitle: "Seoul · K-culture nights" }],
  },
  {
    id: "sg",
    name: "Singapore",
    regionId: "asia",
    hubCity: "Singapore",
    lat: 1.3521,
    lon: 103.8198,
    cities: [{ id: "singapore", name: "Singapore", subtitle: "City-state · Hawkers" }],
  },
  {
    id: "th",
    name: "Thailand",
    regionId: "asia",
    hubCity: "Bangkok",
    lat: 13.7563,
    lon: 100.5018,
    cities: [{ id: "bangkok", name: "Bangkok", subtitle: "Central · Temples & markets" }],
  },
  {
    id: "hk",
    name: "Hong Kong",
    regionId: "asia",
    hubCity: "Hong Kong",
    lat: 22.3193,
    lon: 114.1694,
    cities: [{ id: "hong-kong", name: "Hong Kong", subtitle: "HK · Harbour & dim sum" }],
  },
  {
    id: "tw",
    name: "Taiwan",
    regionId: "asia",
    hubCity: "Taipei",
    lat: 25.033,
    lon: 121.5654,
    cities: [{ id: "taipei", name: "Taipei", subtitle: "Taipei · Night markets" }],
  },
  {
    id: "in",
    name: "India",
    regionId: "asia",
    hubCity: "Mumbai",
    lat: 19.076,
    lon: 72.8777,
    cities: [
      { id: "mumbai", name: "Mumbai", subtitle: "Maharashtra · Coast" },
      { id: "delhi", name: "Delhi", subtitle: "NCR · Old & new city" },
    ],
  },
  {
    id: "my",
    name: "Malaysia",
    regionId: "asia",
    hubCity: "Kuala Lumpur",
    lat: 3.139,
    lon: 101.6869,
    cities: [{ id: "kuala-lumpur", name: "Kuala Lumpur", subtitle: "KL · Skyline" }],
  },
  {
    id: "id",
    name: "Indonesia",
    regionId: "asia",
    hubCity: "Jakarta",
    lat: -6.2088,
    lon: 106.8456,
    cities: [{ id: "jakarta", name: "Jakarta", subtitle: "Java · Mega-city food" }],
  },
  {
    id: "ph",
    name: "Philippines",
    regionId: "asia",
    hubCity: "Manila",
    lat: 14.5995,
    lon: 120.9842,
    cities: [{ id: "manila", name: "Manila", subtitle: "NCR · Bay sunsets" }],
  },
  {
    id: "ae",
    name: "United Arab Emirates",
    regionId: "asia",
    hubCity: "Dubai",
    lat: 25.2048,
    lon: 55.2708,
    cities: [{ id: "dubai", name: "Dubai", subtitle: "Dubai · Desert evenings" }],
  },
  {
    id: "vn",
    name: "Vietnam",
    regionId: "asia",
    hubCity: "Ho Chi Minh City",
    lat: 10.8231,
    lon: 106.6297,
    cities: [{ id: "ho-chi-minh-city", name: "Ho Chi Minh City", subtitle: "South · Coffee bars" }],
  },
  {
    id: "au",
    name: "Australia",
    regionId: "oceania",
    hubCity: "Sydney",
    lat: -33.8688,
    lon: 151.2093,
    social: "States & territories",
    states: [
      {
        id: "au-nsw",
        name: "New South Wales",
        code: "NSW",
        hubCity: "Sydney",
        lat: -33.8688,
        lon: 151.2093,
        cities: [{ id: "sydney", name: "Sydney", subtitle: "NSW · Harbour" }],
      },
      {
        id: "au-vic",
        name: "Victoria",
        code: "VIC",
        hubCity: "Melbourne",
        lat: -37.8136,
        lon: 144.9631,
        cities: [{ id: "melbourne", name: "Melbourne", subtitle: "VIC · Laneways" }],
      },
      {
        id: "au-qld",
        name: "Queensland",
        code: "QLD",
        hubCity: "Brisbane",
        lat: -27.4698,
        lon: 153.0251,
        cities: [{ id: "brisbane", name: "Brisbane", subtitle: "QLD · Riverfront" }],
      },
      {
        id: "au-wa",
        name: "Western Australia",
        code: "WA",
        hubCity: "Perth",
        lat: -31.9505,
        lon: 115.8605,
        cities: [{ id: "perth", name: "Perth", subtitle: "WA · Sunset coast" }],
      },
    ],
  },
  {
    id: "nz",
    name: "New Zealand",
    regionId: "oceania",
    hubCity: "Auckland",
    lat: -36.8509,
    lon: 174.7645,
    cities: [
      { id: "auckland", name: "Auckland", subtitle: "North Island · Harbour" },
      { id: "wellington", name: "Wellington", subtitle: "North Island · Capital" },
    ],
  },
];

export function countriesForContinent(continentId: ExploreContinentId): CatalogCountry[] {
  return EXPLORE_COUNTRIES.filter((c) => c.regionId === continentId);
}

export function findCountry(countryId: string | null | undefined): CatalogCountry | null {
  if (!countryId) return null;
  return EXPLORE_COUNTRIES.find((c) => c.id === countryId) ?? null;
}

export function findState(countryId: string, stateId: string | null): CatalogState | null {
  const country = findCountry(countryId);
  if (!country?.states || !stateId) return null;
  return country.states.find((s) => s.id === stateId) ?? null;
}

export function citiesForCountrySelection(countryId: string, stateId: string | null): CatalogCity[] {
  const country = findCountry(countryId);
  if (!country) return [];
  if (stateId && country.states) {
    const state = country.states.find((s) => s.id === stateId);
    return state?.cities ?? [];
  }
  if (country.states) {
    return country.states.flatMap((s) => s.cities);
  }
  return country.cities ?? [];
}

export function continentHeadline(continentId: ExploreContinentId): string {
  return EXPLORE_CONTINENT_TABS.find((t) => t.id === continentId)?.headline ?? "your region";
}
