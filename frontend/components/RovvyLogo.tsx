'use client'

interface RovvyLogoProps {
  variant?: 'primary' | 'dark' | 'white';
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  width?: number;
  height?: number;
}

// ─────────────────────────────────────
// FULL SVG LOGO (symbol + wordmark)
// Use: Login, Register, Sidebar, 
//      Landing page, Emails
// ─────────────────────────────────────
export function RovvyLogo({
  variant = 'dark',
  showTagline = false,
  size = 'md',
  className = '',
  width,
  height,
}: RovvyLogoProps) {
  const sizes = {
    sm: { w: 95,  h: 26  },
    md: { w: 125, h: 34  },
    lg: { w: 165, h: 46  },
    xl: { w: 220, h: 62  },
  }
  const defaultSize = sizes[size] || sizes.md;
  const w = width || defaultSize.w;
  const h = height || defaultSize.h;

  const isPrimary = variant === 'primary';
  const textFill = isPrimary ? '#0F766E' : '#FFFFFF';

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 125 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rovvy-logo-svg overflow-visible"
        aria-label="Rovvy"
      >
        <defs>
          <linearGradient id="logo-teal-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="logo-trail-grad" x1="0" y1="28" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <style>{`
          .rovvy-logo-svg:hover .logo-icon-group {
            animation: rovvy-fly 1.5s ease-in-out infinite;
            transform-origin: 17px 18px;
          }
          @keyframes rovvy-fly {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            50% {
              transform: translate(2px, -2px) scale(1.04);
            }
          }
        `}</style>

        {/* Paper Airplane Icon */}
        <g className="logo-icon-group">
          {/* Trail 1 */}
          <path
            d="M 4 28 C 8 26, 11 22, 13 17"
            stroke={isPrimary ? 'url(#logo-trail-grad)' : 'currentColor'}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity={isPrimary ? 1 : 0.6}
          />
          {/* Trail 2 */}
          <path
            d="M 9 28 C 13 26, 16 23, 18 19"
            stroke={isPrimary ? 'url(#logo-trail-grad)' : 'currentColor'}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity={isPrimary ? 1 : 0.8}
          />
          {/* Wings */}
          <path
            d="M 28 4 L 12 16 L 17 18 Z"
            fill={isPrimary ? 'url(#logo-teal-grad)' : 'currentColor'}
          />
          <path
            d="M 28 4 L 17 18 L 24 12 Z"
            fill={isPrimary ? 'url(#logo-teal-grad)' : 'currentColor'}
            fillOpacity="0.85"
          />
          <path
            d="M 17 18 L 15 20 L 20 18 Z"
            fill={isPrimary ? 'url(#logo-teal-grad)' : 'currentColor'}
            fillOpacity="0.7"
          />
        </g>

        {/* Wordmark (Increased font size & styled) */}
        <text
          x="35"
          y="22.5"
          fontFamily="var(--font-display), 'Outfit', 'Inter', system-ui, sans-serif"
          fontWeight="900"
          fontSize="24"
          letterSpacing="-0.04em"
          fill={textFill}
        >
          rovvy
        </text>
      </svg>

      {showTagline && (
        <span className={`text-[10px] tracking-wide font-bold mt-1 pl-[35px] ${
          variant === 'dark' 
            ? 'text-white/80' 
            : 'text-[#6B7280]'
        }`}>
          Roam together
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────
// ICON ONLY (r symbol, no wordmark)
// Use: Favicon, Tab icon, Mobile header,
//      App icon, Small spaces, Notifications
// ─────────────────────────────────────
export function RovvyIcon({
  size = 32,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rovvy-logo-svg overflow-visible ${className}`}
      aria-label="Rovvy Icon"
    >
      <defs>
        <linearGradient id="icon-teal-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="icon-trail-grad" x1="0" y1="28" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <style>{`
        .rovvy-logo-svg:hover .logo-icon-group {
          animation: rovvy-fly 1.5s ease-in-out infinite;
          transform-origin: 17px 18px;
        }
        @keyframes rovvy-fly {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(2px, -2px) scale(1.05);
          }
        }
      `}</style>
      <g className="logo-icon-group">
        <path
          d="M 4 28 C 8 26, 11 22, 13 17"
          stroke="url(#icon-trail-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 9 28 C 13 26, 16 23, 18 19"
          stroke="url(#icon-trail-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 28 4 L 12 16 L 17 18 Z"
          fill="url(#icon-teal-grad)"
        />
        <path
          d="M 28 4 L 17 18 L 24 12 Z"
          fill="url(#icon-teal-grad)"
          fillOpacity="0.85"
        />
        <path
          d="M 17 18 L 15 20 L 20 18 Z"
          fill="url(#icon-teal-grad)"
          fillOpacity="0.7"
        />
      </g>
    </svg>
  )
}

export default RovvyLogo;
