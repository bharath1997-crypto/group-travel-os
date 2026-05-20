'use client'

import Image from 'next/image'

interface RovvyLogoProps {
  variant?: 'primary' | 'dark' | 'white';
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  width?: number;
  height?: number;
}

// ─────────────────────────────────────
// FULL LOGO (symbol + wordmark)
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
    sm: { w: 80,  h: 27  },
    md: { w: 110, h: 37  },
    lg: { w: 150, h: 50  },
    xl: { w: 200, h: 67  },
  }
  const defaultSize = sizes[size] || sizes.md;
  const w = width || defaultSize.w;
  const h = height || defaultSize.h;
  
  // Use logo-primary for dark variant (white background) 
  // and logo-dark for primary/white variant (dark background)
  // based on the user's explicit code in Step 1
  const src = variant === 'primary' || variant === 'white'
    ? '/logo-primary.png'
    : '/logo-dark.png'

  const imgStyle = variant === 'dark' || variant === 'white'
    ? { objectFit: 'contain' as const, filter: 'brightness(0) invert(1)' }
    : { objectFit: 'contain' as const };

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <Image
        src={src}
        alt="Rovvy"
        width={w}
        height={h}
        priority
        style={imgStyle}
      />
      {showTagline && (
        <span className={`text-xs -mt-2 font-bold ${
          variant === 'dark' 
            ? 'text-white' 
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
    <Image
      src="/logo-icon.png"
      alt="Rovvy"
      width={size}
      height={size}
      priority
      className={className}
    />
  )
}

export default RovvyLogo;
