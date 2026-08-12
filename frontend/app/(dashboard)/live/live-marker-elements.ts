/**
 * DOM factories for MapLibre HTML markers on Live.
 *
 * Pure functions: they build detached elements and never touch the map, React
 * state or the network. Extracted from LiveMapComponent so marker styling can
 * be changed without opening the map controller.
 */

/** Grey/teal dot with a "START" chip — route origin. */
export function createStartMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "rovvy-start-marker";
  el.style.cssText =
    "display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; user-select: none;";

  el.innerHTML = `
    <div style="
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 2.5px solid #64748B;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 4px; height: 4px; border-radius: 50%; background: #0F766E;"></div>
    </div>
    <div style="
      margin-top: 4px;
      background: #0F172A;
      color: #FFFFFF;
      font-family: sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2.5px 6.5px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      white-space: nowrap;
    ">
      Start
    </div>
  `;
  return el;
}

function createRovvyTeardropPinElement(size: "md" | "lg" = "md"): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;";
  const pinSize = size === "lg" ? 28 : 24;
  const wrapH = size === "lg" ? 40 : 36;
  el.innerHTML = `
    <div style="
      position: relative;
      width: ${pinSize + 4}px;
      height: ${wrapH}px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    ">
      <div style="
        width: ${pinSize}px;
        height: ${pinSize}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #0F766E;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      "></div>
      <div style="
        position: absolute;
        top: ${size === "lg" ? 8 : 7}px;
        left: 50%;
        transform: translateX(-50%);
        width: ${size === "lg" ? 9 : 8}px;
        height: ${size === "lg" ? 9 : 8}px;
        border-radius: 50%;
        background: #ffffff;
      "></div>
    </div>
  `;
  return el;
}

/** Teal teardrop, or a plain puck while turn-by-turn navigation is running. */
export function createDestinationMarkerElement(navigating: boolean): HTMLDivElement {
  if (navigating) {
    const el = document.createElement("div");
    el.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#FFFFFF;border:4px solid #0F766E;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`;
    return el;
  }
  return createRovvyTeardropPinElement("lg");
}

export function createClickedPinMarkerElement(): HTMLDivElement {
  return createRovvyTeardropPinElement("md");
}

/** Small dot plus a monospace lat/lng readout for "find coordinates". */
export function createCoordinateOverlayElement(lat: number, lng: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:8;";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px);">
      <div style="width:12px;height:12px;border-radius:50%;background:#0F766E;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
      <div style="max-width:220px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.96);border:1px solid #e7e5e4;font-size:11px;font-weight:600;color:#1c1917;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.12);font-family:ui-monospace,monospace;line-height:1.35;">
        ${Math.abs(lat).toFixed(5)}° ${latDir}<br/>${Math.abs(lng).toFixed(5)}° ${lngDir}
      </div>
    </div>
  `;
  return el;
}

function createRedMapPinElement(size: "md" | "lg" = "lg"): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;";
  const pinSize = size === "lg" ? 28 : 24;
  const wrapH = size === "lg" ? 40 : 36;
  el.innerHTML = `
    <div style="
      position: relative;
      width: ${pinSize + 4}px;
      height: ${wrapH}px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    ">
      <div style="
        width: ${pinSize}px;
        height: ${pinSize}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #DC2626;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(220,38,38,0.45);
      "></div>
      <div style="
        position: absolute;
        top: ${size === "lg" ? 8 : 7}px;
        left: 50%;
        transform: translateX(-50%);
        width: ${size === "lg" ? 9 : 8}px;
        height: ${size === "lg" ? 9 : 8}px;
        border-radius: 50%;
        background: #ffffff;
      "></div>
    </div>
  `;
  return el;
}

/** Red pin with a "Selected place" coordinate caption. */
export function createExactSelectedPlaceMarkerElement(
  lat: number,
  lng: number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:8;";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  const pin = createRedMapPinElement("lg");
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:6px;transform:translateY(-4px);";
  wrap.appendChild(pin);
  const label = document.createElement("div");
  label.style.cssText =
    "max-width:220px;padding:5px 9px;border-radius:9px;background:rgba(15,23,42,0.94);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:10px;font-weight:700;font-family:ui-monospace,monospace;text-align:center;line-height:1.35;box-shadow:0 4px 16px rgba(0,0,0,0.38);";
  label.innerHTML = `Selected place<br/>${Math.abs(lat).toFixed(5)}° ${latDir}<br/>${Math.abs(lng).toFixed(5)}° ${lngDir}`;
  wrap.appendChild(label);
  el.appendChild(wrap);
  return el;
}

/** Amber immigration badge. The label is backend-supplied, so set it as text. */
export function createBorderCheckpointMarkerElement(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:9;";

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-6px);";

  const badge = document.createElement("div");
  badge.style.cssText =
    "width:30px;height:30px;border-radius:10px;background:#F59E0B;border:2.5px solid #ffffff;box-shadow:0 0 16px rgba(245,158,11,0.55),0 4px 12px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;";
  badge.textContent = "🛂";
  wrap.appendChild(badge);

  const caption = document.createElement("div");
  caption.style.cssText =
    "max-width:240px;padding:6px 10px;border-radius:10px;background:rgba(255,251,235,0.97);border:1.5px solid #F59E0B;font-size:11px;font-weight:700;color:#92400E;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.18);line-height:1.35;";
  caption.textContent = label;
  wrap.appendChild(caption);

  el.appendChild(wrap);
  return el;
}
