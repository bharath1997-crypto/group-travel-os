import type { ConvoyMapPin } from "./live-convoy-map-pins";

export function createConvoyPinElement(pin: ConvoyMapPin): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "live-convoy-pin-marker";
  el.style.cursor = "pointer";

  const accent = pin.isSelf ? "#0E6E5C" : "rgba(15,22,20,0.14)";
  const badgeBg = pin.isSelf ? "#0E6E5C" : "#EDEAE2";
  const badgeColor = pin.isSelf ? "#fff" : "#5F665F";
  const stemColor = pin.isSelf ? "#0E6E5C" : "rgba(251,250,247,0.8)";
  const dotBg = pin.isSelf ? "#0E6E5C" : "#FBFAF7";
  const dotBorder = pin.isSelf ? "#FBFAF7" : "rgba(15,22,20,0.3)";

  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;background:#FBFAF7;border:1.5px solid ${accent};box-shadow:0 6px 18px rgba(0,0,0,0.36);white-space:nowrap">
        <span aria-hidden="true" style="font-size:14px;line-height:1">🚗</span>
        <span style="font-size:12.5px;font-weight:${pin.isSelf ? 600 : 500};color:${pin.isSelf ? "#0F1614" : "#2A312B"}">${pin.label}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:500;color:${badgeColor};background:${badgeBg};padding:2px 6px;border-radius:999px">${pin.seatsOpen} open</span>
      </div>
      <span style="width:2px;height:16px;background:${stemColor}"></span>
      <span style="width:11px;height:11px;border-radius:999px;background:${dotBg};border:2px solid ${dotBorder}"></span>
    </div>
  `;

  return el;
}
