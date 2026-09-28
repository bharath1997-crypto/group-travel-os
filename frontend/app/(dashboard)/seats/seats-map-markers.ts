import { createUserMarkerElement } from "@/app/(dashboard)/live/live-gps-marker";
import type { LocationPoint } from "./seats-location";

export function isEndpointVisibleOnMap(point: LocationPoint | null | undefined): boolean {
  if (!point) return false;
  if (point.isConfirmed) return true;
  return Boolean(point.address.trim());
}

export function createSeatShareLiveGpsMarkerElement(): HTMLElement {
  const el = createUserMarkerElement(
    {
      mode: "browse",
      heading: null,
      speedMps: null,
      acquiring: false,
      approximate: false,
    },
    false,
  );
  el.style.zIndex = "5";
  return el;
}

export function createSeatShareReferenceMarkerElement(
  role: "from" | "to",
  label: string,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;";
  const badge = document.createElement("span");
  badge.textContent = role === "from" ? "From" : "To";
  badge.style.cssText =
    "font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:#fff;color:#9a3412;border:1px solid rgba(154,52,18,0.35);box-shadow:0 2px 6px rgba(15,23,42,0.12);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  const pin = document.createElement("div");
  pin.style.cssText =
    "width:14px;height:14px;border-radius:50% 50% 50% 0;background:#ea580c;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(15,23,42,0.35);";
  const caption = document.createElement("span");
  caption.textContent = label.length > 36 ? `${label.slice(0, 34)}…` : label;
  caption.style.cssText =
    "font-size:10px;font-weight:600;color:#0f1614;max-width:120px;text-align:center;line-height:1.2;";
  wrap.appendChild(badge);
  wrap.appendChild(pin);
  if (label.trim()) wrap.appendChild(caption);
  return wrap;
}

export function createSeatShareActiveMarkerElement(role: "from" | "to"): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;";
  const badge = document.createElement("span");
  badge.textContent = role === "from" ? "Pickup here" : "Drop-off here";
  badge.style.cssText =
    "font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#0f766e;color:#fff;box-shadow:0 2px 8px rgba(15,118,110,0.35);";
  const pin = document.createElement("div");
  pin.style.cssText =
    "width:18px;height:18px;border-radius:50% 50% 50% 0;background:#0f766e;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(15,23,42,0.4);";
  wrap.appendChild(badge);
  wrap.appendChild(pin);
  return wrap;
}
