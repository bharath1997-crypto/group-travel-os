/**
 * Google Maps–style live GPS marker (blue dot, pulse, heading cone).
 *
 * Visual only — position comes from navigator.geolocation via applyUserLocation().
 * This module never sets lat/lng; it renders whatever the navigator reports.
 */

export type GpsMarkerMode = "browse" | "live" | "navigate";

export type GpsMarkerVisualState = {
  mode: GpsMarkerMode;
  heading: number | null;
  speedMps: number | null;
  acquiring: boolean;
  approximate: boolean;
};

export const GPS_MARKER_HEADING_MIN_SPEED_MPS = 0.8;

const BROWSE_CORE = "#1A73E8";
const BROWSE_PULSE = "26, 115, 232";
const BROWSE_CONE = "rgba(26, 115, 232, 0.38)";
const LIVE_CORE = "#0F766E";
const LIVE_PULSE = "15, 118, 110";
const LIVE_CONE = "rgba(15, 118, 110, 0.42)";
const NAV_CONE = "rgba(26, 115, 232, 0.48)";

const GPS_MARKER_HOST_STYLE =
  "width:56px;height:56px;display:flex;align-items:center;justify-content:center;overflow:visible;pointer-events:none;";

/** Minimal marker HTML — used if rendering ever throws. */
export const GPS_MARKER_FALLBACK_HTML = `<div data-gps-dot="true" style="position:relative;flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#ffffff;box-shadow:0 0 0 2px #fff,0 2px 8px rgba(15,23,42,0.45);display:flex;align-items:center;justify-content:center;">
  <div style="width:15px;height:15px;border-radius:50%;background:${BROWSE_CORE};"></div>
</div>`;

function findGpsMarkerContentHost(target: HTMLElement): HTMLElement {
  if (target.classList.contains("rovvy-gps-marker-host")) return target;
  const nested = target.querySelector(".rovvy-gps-marker-host") as HTMLElement | null;
  return nested ?? target;
}

export function createUserMarkerElement(
  stateOrLiveActive: unknown,
  navigating = false,
): HTMLDivElement {
  const outer = document.createElement("div");
  outer.className = "rovvy-gps-marker-outer";
  const host = document.createElement("div");
  host.className = "rovvy-gps-marker-host";
  host.style.cssText = GPS_MARKER_HOST_STYLE;
  try {
    host.innerHTML = buildUserMarkerHtml(stateOrLiveActive, navigating);
  } catch {
    host.innerHTML = GPS_MARKER_FALLBACK_HTML;
  }
  outer.appendChild(host);
  return outer;
}

export function applyUserMarkerContent(
  target: HTMLElement,
  stateOrLiveActive: unknown,
  navigating = false,
): void {
  const host = findGpsMarkerContentHost(target);
  try {
    host.innerHTML = buildUserMarkerHtml(stateOrLiveActive, navigating);
  } catch {
    host.innerHTML = GPS_MARKER_FALLBACK_HTML;
  }
}

function buildGpsDotShellHtml(core: string, approximate: boolean): string {
  const size = approximate ? 28 : 26;
  const coreSize = approximate ? 16 : 15;
  const halo = approximate
    ? "0 0 0 2px rgba(255,255,255,0.98), 0 2px 10px rgba(15,23,42,0.55), 0 0 0 6px rgba(26,115,232,0.32)"
    : "0 0 0 2px rgba(255,255,255,0.98), 0 2px 8px rgba(15,23,42,0.5), 0 0 0 4px rgba(26,115,232,0.22)";
  return `<div data-gps-dot="true" style="position:relative;flex-shrink:0;width:${size}px;height:${size}px;border-radius:50%;background:#ffffff;box-shadow:${halo};display:flex;align-items:center;justify-content:center;z-index:4;">
    <div style="width:${coreSize}px;height:${coreSize}px;border-radius:50%;background:${core};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25);"></div>
  </div>`;
}

function markerColorsForMode(mode: GpsMarkerMode): { core: string; pulse: string; cone: string } {
  if (mode === "live") {
    return { core: LIVE_CORE, pulse: LIVE_PULSE, cone: LIVE_CONE };
  }
  if (mode === "navigate") {
    return { core: BROWSE_CORE, pulse: BROWSE_PULSE, cone: NAV_CONE };
  }
  return { core: BROWSE_CORE, pulse: BROWSE_PULSE, cone: BROWSE_CONE };
}

export function resolveGpsMarkerMode(liveActive: boolean, navigating: boolean): GpsMarkerMode {
  if (navigating) return "navigate";
  if (liveActive) return "live";
  return "browse";
}

function isGpsMarkerMode(value: unknown): value is GpsMarkerMode {
  return value === "browse" || value === "live" || value === "navigate";
}

/** Coerce partial / legacy marker args into a safe visual state. */
export function normalizeGpsMarkerVisualState(
  stateOrLiveActive: unknown,
  navigating = false,
): GpsMarkerVisualState {
  if (typeof stateOrLiveActive === "boolean") {
    return {
      mode: resolveGpsMarkerMode(stateOrLiveActive, navigating),
      heading: null,
      speedMps: null,
      acquiring: false,
      approximate: false,
    };
  }

  if (
    stateOrLiveActive == null ||
    typeof stateOrLiveActive !== "object" ||
    Array.isArray(stateOrLiveActive)
  ) {
    return {
      mode: resolveGpsMarkerMode(false, navigating),
      heading: null,
      speedMps: null,
      acquiring: false,
      approximate: false,
    };
  }

  const state = stateOrLiveActive as Partial<GpsMarkerVisualState>;
  return {
    mode: isGpsMarkerMode(state.mode) ? state.mode : "browse",
    heading: state.heading ?? null,
    speedMps: state.speedMps ?? null,
    acquiring: Boolean(state.acquiring),
    approximate: Boolean(state.approximate),
  };
}

export function shouldShowGpsHeadingCone(
  mode: GpsMarkerMode,
  heading: number | null,
  speedMps: number | null,
): boolean {
  if (heading == null || !Number.isFinite(heading)) return false;
  if (mode === "navigate") return true;
  return speedMps != null && speedMps >= GPS_MARKER_HEADING_MIN_SPEED_MPS;
}

export function normalizeGpsHeading(heading: number | null): number | null {
  if (heading == null || !Number.isFinite(heading)) return null;
  return ((heading % 360) + 360) % 360;
}

export function buildGpsMarkerCss(): string {
  return `
.rovvy-live-map-container .maplibregl-marker:has(.rovvy-gps-marker),
.rovvy-live-map-container .maplibregl-marker:has(.rovvy-gps-marker-host),
.rovvy-live-map-container .maplibregl-marker:has(.rovvy-gps-marker-outer),
.rovvy-live-map-container .maplibregl-marker:has([data-gps-dot="true"]) {
  z-index: 100 !important;
}
.rovvy-gps-marker-outer {
  width: 56px;
  height: 56px;
  pointer-events: none;
}
.rovvy-gps-marker {
  position: relative;
  width: 56px;
  height: 56px;
  pointer-events: none;
  z-index: 20;
}
.rovvy-gps-marker__cone {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  transform: translate(-50%, -50%) rotate(var(--rovvy-gps-heading, 0deg));
  transform-origin: center center;
  opacity: 0;
  transition: opacity 180ms ease;
  pointer-events: none;
  z-index: 1;
}
.rovvy-gps-marker--heading .rovvy-gps-marker__cone {
  opacity: 1;
}
.rovvy-gps-marker__pulse {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22px;
  height: 22px;
  margin-left: -11px;
  margin-top: -11px;
  border-radius: 50%;
  background: rgba(var(--rovvy-gps-pulse-rgb, 26, 115, 232), 0.22);
  opacity: 0;
  transform: scale(1);
  pointer-events: none;
  z-index: 2;
}
.rovvy-gps-marker--acquiring .rovvy-gps-marker__pulse {
  opacity: 1;
  animation: rovvy-gps-acquire-pulse 1.8s ease-out infinite;
}
.rovvy-gps-marker__dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 24px;
  height: 24px;
  margin-left: -12px;
  margin-top: -12px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.98),
    0 2px 8px rgba(15, 23, 42, 0.35),
    0 0 0 5px rgba(var(--rovvy-gps-pulse-rgb, 26, 115, 232), 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
}
.rovvy-gps-marker--approximate .rovvy-gps-marker__dot {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.95),
    0 1px 4px rgba(15, 23, 42, 0.28),
    0 0 0 4px rgba(var(--rovvy-gps-pulse-rgb, 26, 115, 232), 0.18);
}
.rovvy-gps-marker__core {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--rovvy-gps-core, #1a73e8);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}
.rovvy-gps-marker--globe {
  width: 68px;
  height: 68px;
}
.rovvy-gps-marker--globe .rovvy-gps-marker__dot {
  width: 30px;
  height: 30px;
  margin-left: -15px;
  margin-top: -15px;
}
.rovvy-gps-marker--globe .rovvy-gps-marker__core {
  width: 18px;
  height: 18px;
}
.rovvy-gps-marker--globe .rovvy-gps-marker__pulse {
  width: 30px;
  height: 30px;
  margin-left: -15px;
  margin-top: -15px;
}
.rovvy-gps-marker--globe .rovvy-gps-marker__cone {
  width: 64px;
  height: 64px;
}
.user-location-popup.maplibregl-popup {
  z-index: 5;
}
.user-location-popup .maplibregl-popup-content {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  font-family: Inter, system-ui, sans-serif;
}
.user-location-popup .maplibregl-popup-tip {
  border-top-color: #ffffff;
}
@keyframes rovvy-gps-acquire-pulse {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  100% {
    transform: scale(2.8);
    opacity: 0;
  }
}
`;
}

function buildHeadingConeSvg(coneColor: string): string {
  return `<svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="rovvyGpsCone" x1="26" y1="26" x2="26" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${coneColor}" stop-opacity="0.55" />
        <stop offset="100%" stop-color="${coneColor}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="M26 26 L14 4 A22 22 0 0 1 38 4 Z" fill="url(#rovvyGpsCone)" />
  </svg>`;
}

export function buildUserMarkerHtml(
  stateOrLiveActive: unknown,
  navigating = false,
): string {
  try {
    const state = normalizeGpsMarkerVisualState(stateOrLiveActive, navigating);
    const { core, pulse, cone } = markerColorsForMode(state.mode);
    const heading = normalizeGpsHeading(state.heading);
    const showCone = shouldShowGpsHeadingCone(state.mode, heading, state.speedMps);
    const classes = [
      "rovvy-gps-marker",
      state.acquiring ? "rovvy-gps-marker--acquiring" : "",
      state.approximate ? "rovvy-gps-marker--approximate" : "",
      showCone ? "rovvy-gps-marker--heading" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const style = [
      `--rovvy-gps-core:${core}`,
      `--rovvy-gps-pulse-rgb:${pulse}`,
      showCone && heading != null ? `--rovvy-gps-heading:${heading}deg` : "",
    ]
      .filter(Boolean)
      .join(";");

    return `<div class="${classes}" style="position:absolute;inset:0;overflow:visible;pointer-events:none;${style}">
      <div class="rovvy-gps-marker__cone" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)${showCone && heading != null ? ` rotate(${heading}deg)` : ""};">${buildHeadingConeSvg(cone)}</div>
      <div class="rovvy-gps-marker__pulse"></div>
    </div>`;
  } catch {
    return GPS_MARKER_FALLBACK_HTML;
  }
}

export function setUserMarkerGlobeScale(target: HTMLElement, globe: boolean): void {
  const marker = target.querySelector(".rovvy-gps-marker");
  if (marker) {
    marker.classList.toggle("rovvy-gps-marker--globe", globe);
  }
}

export function buildUserLocationPopupHtml(
  accuracy: number | null,
  timestamp: number | null,
): string {
  const ageSec = timestamp ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : null;
  const accuracyLabel =
    accuracy != null && accuracy > 0 ? `± ${Math.round(accuracy)} m` : "Unknown";
  const updatedLabel =
    ageSec == null ? "Just now" : ageSec <= 1 ? "Just now" : `${ageSec}s ago`;

  return `<div style="min-width:148px;">
    <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:4px;">Your location</div>
    <div style="font-size:11px;color:#64748B;">Accuracy ${accuracyLabel}</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:2px;">Updated ${updatedLabel}</div>
  </div>`;
}
