"use client";

/**
 * Illustrative world-map backdrop (vector only): teal landmasses, route pins,
 * dotted travel arcs — tuned for dark navy auth screens.
 */
export function AuthMapBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
.auth-map-route {
  stroke-dasharray: 5 12;
  animation: auth-map-route-flow 22s linear infinite;
}
.auth-map-route--slow {
  stroke-dasharray: 5 12;
  animation: auth-map-route-flow 32s linear infinite;
}
@keyframes auth-map-route-flow {
  to { stroke-dashoffset: -170; }
}
@keyframes auth-map-pin {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
.auth-map-pin {
  transform-origin: center bottom;
  animation: auth-map-pin 4s ease-in-out infinite;
}
.auth-map-pin--d1 { animation-delay: 0.3s; }
.auth-map-pin--d2 { animation-delay: 0.8s; }
.auth-map-pin--d3 { animation-delay: 1.2s; }
.auth-map-pin--d4 { animation-delay: 1.8s; }
.auth-map-continent {
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.15));
}
`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full min-h-[100%] min-w-[100%]"
        viewBox="0 0 1200 640"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="auth-land-shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#2DD4BF" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {/* Landmasses — filled teal/cyan (reference style), readable on navy */}
        <g className="auth-map-continent" fill="url(#auth-land-shine)" stroke="#99F6E4" strokeWidth="0.75" strokeOpacity="0.35">
          {/* North America */}
          <path d="M120 95 L195 82 L255 105 L290 145 L300 185 L275 225 L195 240 L140 220 L95 175 L85 130 Z" />
          <path d="M255 105 L320 98 L360 135 L340 175 L285 165 Z" />
          {/* South America */}
          <path d="M228 268 L268 255 L285 295 L280 375 L255 455 L225 468 L205 395 L215 315 Z" />
          {/* Europe */}
          <path d="M518 108 L580 95 L615 125 L605 165 L565 178 L525 165 L505 135 Z" />
          {/* Africa */}
          <path d="M545 188 L615 178 L640 240 L630 330 L595 405 L545 398 L525 305 Z" />
          {/* Asia */}
          <path d="M658 75 L780 58 L920 95 L1020 145 L1045 210 L1005 275 L930 255 L880 195 L720 155 L640 120 Z" />
          <path d="M880 195 L980 210 L1025 265 L985 310 L900 285 Z" />
          {/* Australia */}
          <path d="M920 395 L1035 385 L1075 430 L1045 475 L950 480 L895 445 Z" />
          {/* Greenland-ish */}
          <path d="M395 42 L440 38 L455 78 L420 92 L385 72 Z" />
        </g>

        {/* Arcing dotted routes between regions */}
        <g fill="none" strokeLinecap="round" strokeOpacity="0.45">
          <path
            className="auth-map-route"
            d="M 275 155 Q 420 40 560 130"
            stroke="#E2E8F0"
            strokeWidth="1.4"
          />
          <path
            className="auth-map-route--slow"
            d="M 250 320 Q 400 180 575 230"
            stroke="#CBD5E1"
            strokeWidth="1.3"
          />
          <path
            className="auth-map-route"
            d="M 598 128 Q 720 20 880 120"
            stroke="#E2E8F0"
            strokeWidth="1.35"
          />
          <path
            className="auth-map-route--slow"
            d="M 650 95 Q 820 280 990 195"
            stroke="#94A3B8"
            strokeWidth="1.2"
          />
          <path
            className="auth-map-route"
            d="M 970 250 Q 1040 340 1010 430"
            stroke="#CBD5E1"
            strokeWidth="1.25"
          />
          <path
            className="auth-map-route--slow"
            d="M 320 175 Q 480 120 530 138"
            stroke="#94A3B8"
            strokeWidth="1.15"
          />
        </g>

        {/* Map pins — red / yellow / blue / orange + white center */}
        <g>
          <g className="auth-map-pin auth-map-pin--d1" transform="translate(268, 158)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#EF4444" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d2" transform="translate(580, 128)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#3B82F6" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d3" transform="translate(255, 312)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#EAB308" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d4" transform="translate(605, 248)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#F97316" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d2" transform="translate(895, 118)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#EF4444" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d1" transform="translate(990, 218)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#3B82F6" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d3" transform="translate(1005, 428)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#EAB308" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d4" transform="translate(178, 198)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#F97316" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
          <g className="auth-map-pin auth-map-pin--d1" transform="translate(510, 108)">
            <path d="M0-22c-7.2 0-13 5.8-13 13 0 11 13 29 13 29s13-18 13-29c0-7.2-5.8-13-13-13z" fill="#EF4444" />
            <circle cx="0" cy="-11" r="5" fill="white" />
          </g>
        </g>
      </svg>
    </div>
  );
}
