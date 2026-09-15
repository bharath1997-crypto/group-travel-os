import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearHeroMemoryCacheForTests, resolveHero } from "@/lib/hero-server";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

const weather = {
  current: { time: "2026-09-11T18:00", temperature_2m: 22, relative_humidity_2m: 50, weather_code: 0 },
  hourly: {
    time: ["2026-09-11T18:00", "2026-09-11T19:00", "2026-09-11T20:00"],
    weather_code: [0, 0, 61],
  },
  daily: { sunrise: ["2026-09-11T06:30"], sunset: ["2026-09-11T19:00"] },
};

const reverse = {
  lat: "41.88",
  lon: "-87.63",
  boundingbox: ["41.70", "42.02", "-87.94", "-87.52"],
  address: {
    neighbourhood: "Uptown",
    city: "Chicago",
    "ISO3166-2-lvl4": "US-IL",
    country_code: "us",
  },
};

function goodCommonsPage(title: string, id: string) {
  return {
    title,
    coordinates: [{ lat: 41.88, lon: -87.63 }],
    imageinfo: [{
      url: `https://upload.wikimedia.org/${id}.jpg`,
      thumburl: `https://upload.wikimedia.org/${id}.jpg`,
      width: 2400,
      height: 1200,
      thumbwidth: 2400,
      thumbheight: 1200,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, "_")}`,
      extmetadata: {
        Artist: { value: "Test Photographer" },
        LicenseShortName: { value: "CC BY-SA 4.0" },
        Assessments: { value: "quality image" },
      },
    }],
  };
}

describe("hero provider degradation", () => {
  beforeEach(() => clearHeroMemoryCacheForTests());

  it("uses IP location when GPS coordinates are absent", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("ipapi.co")) return json({ city: "Chicago", region_code: "IL", country_code: "US", latitude: 41.88, longitude: -87.63 });
      if (url.includes("nominatim")) return json(reverse);
      if (url.includes("open-meteo")) return json(weather);
      if (url.includes("query.wikidata.org")) return json({ results: { bindings: [] } });
      return json({ query: { pages: {} } });
    }) as unknown as typeof fetch;

    const result = await resolveHero({ lat: null, lon: null }, { fetchImpl, now: () => new Date("2026-09-11T18:04:00Z") });
    expect(result.precision).toBe("ip");
    expect(result.city).toBe("Chicago");
    expect(result.photo).toBeNull();
  });

  it("returns 200-ready partial data when Nominatim is down", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("nominatim")) return json({}, 503);
      if (url.includes("open-meteo")) return json(weather);
      if (url.includes("query.wikidata.org")) return json({ results: { bindings: [] } });
      return json({ query: { pages: {} } });
    }) as unknown as typeof fetch;

    const result = await resolveHero({ lat: 41.88, lon: -87.63 }, { fetchImpl });
    expect(result.precision).toBe("gps");
    expect(result.weather?.tempC).toBe(22);
    expect(result.photo).toBeNull();
  });

  it("returns the colour fallback when no geo-verified photo survives", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("nominatim")) return json(reverse);
      if (url.includes("open-meteo")) return json(weather);
      if (url.includes("query.wikidata.org")) return json({ results: { bindings: [] } });
      return json({
        query: {
          pages: {
            "1": goodCommonsPage("File:Parking lot sign.jpg", "bad"),
          },
        },
      });
    }) as unknown as typeof fetch;

    const result = await resolveHero({ lat: 41.88, lon: -87.63 }, { fetchImpl });
    expect(result.photo).toBeNull();
    expect(result.dominantColor).toBeTruthy();
  });

  it("prefers wikidata entity photos over commons geosearch", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("nominatim")) return json(reverse);
      if (url.includes("open-meteo")) return json(weather);
      if (url.includes("query.wikidata.org")) {
        return json({
          results: {
            bindings: [{
              itemLabel: { value: "Millennium Park" },
              image: { value: "Chicago skyline from Grant Park.jpg" },
              coord: { value: "Point(-87.623 41.882)" },
            }],
          },
        });
      }
      if (url.includes("commons.wikimedia.org/w/api.php") && url.includes("titles=File")) {
        return json({
          query: {
            pages: {
              "1": goodCommonsPage("File:Chicago skyline from Grant Park.jpg", "good"),
            },
          },
        });
      }
      return json({
        query: {
          pages: {
            "2": goodCommonsPage("File:Walgreens storefront.jpg", "bad-store"),
          },
        },
      });
    }) as unknown as typeof fetch;

    const result = await resolveHero({ lat: 41.88, lon: -87.63 }, { fetchImpl });
    expect(result.photo?.url).toContain("good");
    expect(result.photo?.credit).toContain("Test Photographer");
  });

  it("returns the nullable unknown shape when IP resolution fails", async () => {
    const fetchImpl = vi.fn(async () => json({}, 503)) as unknown as typeof fetch;
    const result = await resolveHero({}, { fetchImpl, now: () => new Date("2026-09-11T18:04:00Z") });
    expect(result).toMatchObject({ placeLabel: null, precision: null, weather: null, photo: null });
    expect(result.cachedAt).toBe("2026-09-11T18:04:00.000Z");
  });
});
