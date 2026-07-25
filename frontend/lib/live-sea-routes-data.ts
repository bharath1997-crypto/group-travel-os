/**
 * Static maritime overlays for Live map — zero API cost.
 * Shipping lanes + ferries + cruise itineraries (simplified paths).
 */

export type SeaRouteCategory = "shipping" | "ferry" | "cruise";

export type SeaRouteFeature = {
  type: "Feature";
  properties: { name: string; category: SeaRouteCategory };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export const LIVE_SEA_ROUTES_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    // ── Major shipping lanes ──────────────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "North Atlantic trunk", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-74.0, 40.7], [-60.0, 42.0], [-45.0, 44.5], [-30.0, 47.0], [-15.0, 49.0], [0.0, 50.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Trans-Pacific trunk", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-122.4, 37.8], [-150.0, 38.0], [-170.0, 35.0], [170.0, 35.0], [145.0, 34.0], [139.7, 35.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Asia–Europe via Suez", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.8, 1.3], [95.0, 5.0], [80.0, 6.0], [55.0, 12.0], [43.0, 12.5], [32.5, 30.0], [20.0, 35.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Suez Canal corridor", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [32.3, 29.9], [32.5, 30.5], [32.6, 31.2], [32.3, 31.8], [32.0, 32.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Panama Canal corridor", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.9, 9.4], [-79.7, 9.1], [-79.5, 8.9], [-79.3, 8.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Panama–US Gulf", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.5, 9.0], [-85.0, 12.0], [-90.0, 18.0], [-95.0, 24.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Strait of Malacca", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [99.0, 5.5], [101.0, 3.5], [103.5, 1.5], [104.0, 1.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "South China Sea trunk", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [114.0, 22.0], [112.0, 18.0], [110.0, 12.0], [107.0, 8.0], [104.0, 1.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Strait of Hormuz", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [56.0, 26.5], [57.0, 26.2], [58.0, 25.8], [59.0, 25.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Cape of Good Hope route", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [18.4, -34.0], [10.0, -30.0], [0.0, -20.0], [-10.0, -5.0], [-20.0, 10.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Mediterranean east–west", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [34.0, 31.5], [25.0, 35.0], [18.0, 38.0], [12.0, 40.0], [5.0, 43.0], [-0.5, 43.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Baltic access", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [12.0, 55.5], [14.0, 56.0], [16.0, 57.0], [18.0, 58.0], [20.0, 59.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Australia–Asia", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [151.2, -33.9], [140.0, -25.0], [125.0, -15.0], [115.0, -8.0], [106.8, -6.1],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "West Africa–Europe", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [3.4, 6.5], [0.0, 10.0], [-5.0, 20.0], [-10.0, 30.0], [-9.0, 38.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Brazil–Europe", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-43.2, -22.9], [-40.0, -15.0], [-35.0, -5.0], [-30.0, 5.0], [-20.0, 20.0], [-10.0, 38.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "English Channel transit", category: "shipping" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-5.0, 49.5], [-2.0, 50.0], [0.5, 50.5], [2.0, 51.0],
        ],
      },
    },
    // ── Major ferries ─────────────────────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Dover–Calais", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [1.3, 50.9], [1.1, 50.8], [1.8, 50.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Hook of Holland–Harwich", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [4.1, 51.9], [2.5, 52.2], [1.3, 51.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Helsinki–Tallinn", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [24.9, 60.2], [25.0, 59.8], [24.8, 59.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Stockholm–Helsinki", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [18.1, 59.3], [20.0, 59.5], [22.0, 59.8], [24.9, 60.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Oslo–Copenhagen", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.7, 59.9], [11.5, 58.5], [12.6, 55.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Patras–Ancona", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [21.7, 38.2], [19.0, 39.5], [16.5, 41.0], [13.5, 43.6],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Barcelona–Palma", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [2.2, 41.4], [2.5, 40.5], [2.7, 39.6],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Marseille–Ajaccio", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [5.4, 43.3], [7.0, 42.5], [8.7, 41.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Dublin–Holyhead", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-6.3, 53.3], [-5.5, 53.2], [-4.6, 53.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Tarifa–Tangier", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-5.6, 36.0], [-5.8, 35.9], [-5.5, 35.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Istanbul–Bursa (Sea of Marmara)", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [28.9, 40.9], [29.2, 40.5], [29.0, 40.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Hong Kong–Macau", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [114.2, 22.3], [113.8, 22.2], [113.5, 22.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Seattle–Bainbridge", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-122.3, 47.6], [-122.5, 47.6], [-122.5, 47.6],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Vancouver–Victoria", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-123.1, 49.3], [-123.5, 49.0], [-123.4, 48.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Wellington–Picton", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [174.8, -41.3], [174.5, -41.2], [174.0, -41.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Singapore–Batam", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.8, 1.3], [104.0, 1.1], [104.0, 1.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Piraeus–Heraklion", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [23.6, 37.9], [25.0, 37.5], [25.1, 35.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Cape Town–Robben Island", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [18.4, -33.9], [18.4, -33.8], [18.4, -33.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Messina Strait", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [15.6, 38.2], [15.5, 38.1], [15.6, 38.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Bosphorus crossing", category: "ferry" },
      geometry: {
        type: "LineString",
        coordinates: [
          [29.0, 41.0], [29.0, 41.1], [29.1, 41.2],
        ],
      },
    },
    // ── Cruise itineraries ────────────────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Caribbean loop", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-80.2, 25.8], [-77.0, 23.0], [-81.4, 19.3], [-87.0, 20.5], [-80.2, 25.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Western Mediterranean", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [2.2, 41.4], [5.4, 43.3], [7.0, 43.5], [9.2, 41.1], [12.5, 41.9], [14.3, 40.6], [2.2, 41.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Eastern Mediterranean", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [23.7, 37.9], [25.1, 35.3], [28.0, 36.5], [32.5, 34.7], [23.7, 37.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Alaska Inside Passage", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-122.3, 47.6], [-124.0, 48.5], [-130.0, 52.0], [-133.0, 55.5], [-135.0, 57.8], [-130.0, 52.0], [-122.3, 47.6],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Northern Europe fjords", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [12.6, 55.7], [10.4, 59.9], [5.3, 60.4], [6.0, 62.5], [5.3, 60.4], [12.6, 55.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Transatlantic repositioning", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-0.1, 50.8], [-10.0, 48.0], [-30.0, 44.0], [-50.0, 40.0], [-70.0, 40.0], [-74.0, 40.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Hawaiian islands", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-157.9, 21.3], [-158.0, 21.5], [-159.5, 22.0], [-155.1, 19.7], [-157.9, 21.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Asia explorer", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.8, 1.3], [109.0, 7.0], [114.2, 22.3], [121.5, 25.0], [139.7, 35.5], [103.8, 1.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Australia & New Zealand", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [151.2, -33.9], [153.0, -27.5], [170.0, -43.5], [174.8, -41.3], [151.2, -33.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Panama Canal cruise", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.5, 9.0], [-79.7, 9.1], [-80.0, 9.2], [-118.2, 33.7], [-79.5, 9.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Antarctica peninsula", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-68.3, -54.8], [-65.0, -55.5], [-60.0, -63.0], [-58.0, -64.5], [-68.3, -54.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Galápagos circuit", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-90.3, -0.7], [-91.0, -0.5], [-90.5, -1.0], [-89.6, -0.9], [-90.3, -0.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Gulf of Mexico", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-95.0, 29.0], [-90.0, 26.0], [-85.0, 22.0], [-81.0, 24.0], [-95.0, 29.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Baltic capitals", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [24.1, 56.9], [24.8, 59.4], [24.9, 60.2], [18.1, 59.3], [24.1, 56.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Norwegian coast", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [5.3, 60.4], [7.0, 62.5], [14.0, 67.0], [18.0, 69.5], [5.3, 60.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Red Sea & Suez", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [39.2, 21.5], [36.0, 24.0], [32.5, 29.0], [32.3, 31.8], [39.2, 21.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "South Pacific", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [174.8, -36.8], [178.0, -18.0], [-149.6, -17.5], [174.8, -36.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Amazon & Brazil coast", category: "cruise" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-43.2, -22.9], [-38.5, -3.7], [-48.5, -1.5], [-43.2, -22.9],
        ],
      },
    },
  ] satisfies SeaRouteFeature[],
};
