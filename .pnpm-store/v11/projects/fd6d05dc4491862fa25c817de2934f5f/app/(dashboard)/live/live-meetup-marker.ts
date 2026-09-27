/** Meet-up / destination pin — zoom-resilient, distinct from transit dots. */

function clampZoom(zoom: number): number {
  return Math.min(18, Math.max(2, zoom));
}

/** Scale pin down when zoomed out so meet-ups stay visible at city/state level. */
export function meetupMarkerScale(zoom: number): number {
  const z = clampZoom(zoom);
  if (z <= 6) return 0.62;
  if (z <= 9) return 0.72;
  if (z <= 12) return 0.86;
  if (z <= 14) return 0.95;
  return 1;
}

export function createMeetupMarkerElement(
  label: string | undefined,
  zoom: number,
): HTMLDivElement {
  const scale = meetupMarkerScale(zoom);
  const el = document.createElement("div");
  el.className = "rovvy-meetup-marker";
  el.style.cssText = `pointer-events:none;z-index:8;transform:scale(${scale});transform-origin:center bottom;`;

  const safeLabel = label?.trim() || "Meet point";
  const showLabel = zoom >= 11;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
      <div style="position:relative;width:44px;height:52px;filter:drop-shadow(0 4px 14px rgba(233,69,96,0.45));">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(233,69,96,0.22);border:2px solid rgba(233,69,96,0.55);animation:rovvy-meetup-pulse 2.8s infinite cubic-bezier(0.25,0,0,1);"></div>
        <div style="position:absolute;left:50%;top:2px;transform:translateX(-50%) rotate(-45deg);width:34px;height:34px;border-radius:50% 50% 50% 0;background:linear-gradient(145deg,#E94560 0%,#C0264A 100%);border:3px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.28);"></div>
        <div style="position:absolute;left:50%;top:11px;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#E94560;">★</div>
      </div>
      ${
        showLabel
          ? `<div style="max-width:min(240px,42vw);padding:5px 10px;border-radius:10px;background:rgba(15,23,42,0.92);border:1.5px solid rgba(233,69,96,0.65);color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:1.35;box-shadow:0 4px 16px rgba(0,0,0,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(safeLabel)}
            </div>`
          : ""
      }
    </div>
  `;

  if (!document.getElementById("rovvy-meetup-pulse-keyframes")) {
    const style = document.createElement("style");
    style.id = "rovvy-meetup-pulse-keyframes";
    style.textContent = `
      @keyframes rovvy-meetup-pulse {
        0% { transform: scale(0.85); opacity: 0.75; }
        100% { transform: scale(1.55); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return el;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
