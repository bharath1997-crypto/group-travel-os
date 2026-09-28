import type { LiveGeocodingReverseResult } from "./live-geocoding";
import type { PlacePreviewData } from "./live-place-preview-data";
import type { PlaceLocationField } from "./live-place-display";

const LOCALITY_KEYS = [
  { key: "city", label: "City" },
  { key: "town", label: "Town" },
  { key: "village", label: "Village" },
  { key: "hamlet", label: "Hamlet" },
  { key: "municipality", label: "Municipality" },
  { key: "suburb", label: "Suburb" },
  { key: "neighbourhood", label: "Neighbourhood" },
  { key: "isolated_dwelling", label: "Dwelling" },
] as const;

const PLACE_TYPE_LABELS: Record<string, string> = {
  city: "City",
  town: "Town",
  village: "Village",
  hamlet: "Hamlet",
  suburb: "Suburb",
  neighbourhood: "Neighbourhood",
  municipality: "Municipality",
  isolated_dwelling: "Dwelling",
  locality: "Locality",
};

function titleCaseToken(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickFirst(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export type PlaceAdminHierarchy = {
  localityName: string | null;
  localityType: string | null;
  district: string | null;
  stateOrProvince: string | null;
  country: string | null;
  postcode: string | null;
};

export function extractPlaceAdminHierarchy(
  address?: Record<string, string>,
  details?: Pick<LiveGeocodingReverseResult, "name" | "type" | "class" | "display_name"> | null,
): PlaceAdminHierarchy {
  let localityName: string | null = null;
  let localityType: string | null = null;

  if (address) {
    for (const { key, label } of LOCALITY_KEYS) {
      const value = address[key]?.trim();
      if (value) {
        localityName = value;
        localityType = label;
        break;
      }
    }
  }

  const osmPlaceType = String(details?.type || address?.place || "").toLowerCase();
  if (PLACE_TYPE_LABELS[osmPlaceType]) {
    localityType = PLACE_TYPE_LABELS[osmPlaceType];
    localityName =
      localityName ||
      details?.name?.trim() ||
      details?.display_name?.split(",")[0]?.trim() ||
      null;
  }

  const district = pickFirst(
    address?.county,
    address?.state_district,
    address?.district,
    address?.borough,
  );

  const stateOrProvince = pickFirst(
    address?.state,
    address?.province,
    address?.region,
  );

  let country = address?.country?.trim() || null;

  if (!localityName) {
    const detailName = details?.name?.trim() || null;
    const detailClass = String(details?.class || "").toLowerCase();
    const detailType = String(details?.type || "").toLowerCase();
    if (
      detailName &&
      detailClass === "boundary" &&
      detailType === "administrative" &&
      detailName.toLowerCase() !== country?.toLowerCase()
    ) {
      localityName = detailName;
      localityType = "Region";
    }
  }

  if (!localityName && district && district.toLowerCase() !== country?.toLowerCase()) {
    localityName = district;
    localityType = localityType || "District";
  }

  if (!localityName && country) {
    localityName = country;
    localityType = country === "Greenland" ? "Territory" : "Country";
  }

  return {
    localityName,
    localityType,
    district,
    stateOrProvince,
    country,
    postcode: address?.postcode?.trim() || null,
  };
}

export function applyAdminHierarchyToPlace(
  place: PlacePreviewData,
  admin: PlaceAdminHierarchy,
): PlacePreviewData {
  const categoryLabel =
    admin.localityType &&
    ["Place", "Location", "Address", "Coordinates", "Dropped pin"].includes(place.categoryLabel)
      ? admin.localityType
      : place.categoryLabel;

  return {
    ...place,
    categoryLabel,
    city: admin.localityName ?? place.city,
    state: admin.stateOrProvince ?? place.state,
    country: admin.country ?? place.country,
    district: admin.district ?? place.district,
    localityType: admin.localityType ?? place.localityType,
    localityName: admin.localityName ?? place.localityName,
    postcode: admin.postcode ?? place.postcode,
  };
}

export function buildPlaceHierarchyFields(
  place: Pick<
    PlacePreviewData,
    "name" | "localityName" | "localityType" | "district" | "state" | "country" | "postcode" | "city"
  >,
): PlaceLocationField[] {
  const fields: PlaceLocationField[] = [];
  const nameToken = place.name.trim().toLowerCase();

  const localityName = pickFirst(place.localityName, place.city);
  const localityType = place.localityType?.trim() || null;

  if (localityType) {
    fields.push({ label: "Type", value: localityType });
  }
  if (localityName && localityName.toLowerCase() !== nameToken) {
    let label = localityType || "Place";
    if (!localityType) {
      if (/borough$/i.test(localityName)) label = "Borough";
      else if (/county$/i.test(localityName)) label = "County";
      else if (/parish$/i.test(localityName)) label = "Parish";
    }
    fields.push({ label, value: localityName });
  }

  if (place.district?.trim() && place.district.trim().toLowerCase() !== nameToken) {
    fields.push({ label: "District", value: place.district.trim() });
  }

  if (place.state?.trim()) {
    fields.push({ label: "State / Province", value: place.state.trim() });
  }

  if (place.country?.trim()) {
    const country = place.country.trim();
    const alreadyListed = fields.some(
      (field) =>
        field.label === "Country" &&
        field.value.trim().toLowerCase() === country.toLowerCase(),
    );
    if (!alreadyListed) {
      fields.push({ label: "Country", value: country });
    }
  }

  if (place.postcode?.trim()) {
    fields.push({ label: "Postcode", value: place.postcode.trim() });
  }

  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.label.toLowerCase()}|${field.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatPlaceHierarchySubtitle(
  place: Pick<
    PlacePreviewData,
    "name" | "localityName" | "localityType" | "district" | "state" | "country" | "city" | "categoryLabel"
  >,
): string {
  const segments: string[] = [];

  const localityType =
    place.localityType?.trim() ||
    (place.categoryLabel && !["Place", "Location", "Address"].includes(place.categoryLabel)
      ? place.categoryLabel
      : null);
  if (localityType) segments.push(localityType);

  if (place.district?.trim()) segments.push(place.district.trim());
  if (place.state?.trim()) segments.push(place.state.trim());
  if (place.country?.trim()) segments.push(place.country.trim());

  const unique = [...new Set(segments.filter(Boolean))];
  if (unique.length > 0) return unique.join(" · ");

  const fallbackCity = pickFirst(place.localityName, place.city);
  if (fallbackCity && fallbackCity.toLowerCase() !== place.name.trim().toLowerCase()) {
    return fallbackCity;
  }

  return "Location details loading…";
}

export function formatDistanceFromUserLabel(distanceM: number | null | undefined): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  const miles = distanceM / 1609.34;
  if (miles < 0.1) return `${Math.max(1, Math.round(distanceM))} m from you`;
  if (miles < 10) return `${miles.toFixed(1)} mi from you`;
  if (miles < 100) return `${Math.round(miles)} mi from you`;
  return `${Math.round(miles).toLocaleString()} mi from you`;
}

export function inferOsmPlaceTypeLabel(
  details?: Pick<LiveGeocodingReverseResult, "type" | "class"> | null,
): string | null {
  const type = String(details?.type || "").toLowerCase();
  if (PLACE_TYPE_LABELS[type]) return PLACE_TYPE_LABELS[type];
  if (details?.class === "place" && type) return titleCaseToken(type);
  return null;
}
