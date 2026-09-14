export type VoteMapPin = {
  id: string;
  name: string;
  voteCount: number;
  lat: number;
  lng: number;
  leading?: boolean;
};

export function createVotePinElement(pin: VoteMapPin): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "live-vote-pin-marker";
  el.style.cursor = "pointer";

  const accent = pin.leading ? "#0E6E5C" : "rgba(15,22,20,0.14)";
  const badgeBg = pin.leading ? "#0E6E5C" : "#EDEAE2";
  const badgeColor = pin.leading ? "#fff" : "#5F665F";
  const stemColor = pin.leading ? "#0E6E5C" : "rgba(251,250,247,0.8)";
  const dotBg = pin.leading ? "#0E6E5C" : "#FBFAF7";
  const dotBorder = pin.leading ? "#FBFAF7" : "rgba(15,22,20,0.3)";

  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;background:#FBFAF7;border:1.5px solid ${accent};box-shadow:0 6px 18px rgba(0,0,0,0.36);white-space:nowrap">
        <span style="font-size:12.5px;font-weight:${pin.leading ? 600 : 500};color:${pin.leading ? "#0F1614" : "#2A312B"}">${pin.name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:500;color:${badgeColor};background:${badgeBg};padding:2px 6px;border-radius:999px">${pin.voteCount}</span>
      </div>
      <span style="width:2px;height:16px;background:${stemColor}"></span>
      <span style="width:11px;height:11px;border-radius:999px;background:${dotBg};border:2px solid ${dotBorder}"></span>
    </div>
  `;

  return el;
}
