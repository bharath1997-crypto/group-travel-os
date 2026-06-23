'use client'

/** Official brand assets — source of truth: /brand/ at repo root */
const BRAND_ASSETS = {
  primary: '/brand/rovvy_logo_primary.png',
  dark: '/brand/rovvy_logo_dark.png',
  icon: '/brand/rovvy_icon.png',
} as const

interface RovvyLogoProps {
  variant?: 'primary' | 'dark' | 'white'
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  width?: number
  height?: number
}

const SIZE_HEIGHT: Record<NonNullable<RovvyLogoProps['size']>, number> = {
  sm: 26,
  md: 34,
  lg: 46,
  xl: 62,
}

/**
 * Full wordmark logo — always renders official PNG from /brand/.
 * Use variant="primary" on light backgrounds, "dark" or "white" on dark backgrounds.
 */
export function RovvyLogo({
  variant = 'primary',
  showTagline = false,
  size = 'md',
  className = '',
  width,
  height,
}: RovvyLogoProps) {
  const src =
    variant === 'primary' ? BRAND_ASSETS.primary : BRAND_ASSETS.dark
  const h = height ?? SIZE_HEIGHT[size]

  return (
    <div className={`flex flex-col items-start ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Rovvy"
        height={h}
        width={width}
        className="w-auto object-contain"
        style={width ? { width, height: h } : { height: h }}
      />
      {showTagline && (
        <span
          className={`text-[10px] tracking-wide font-bold mt-1 ${
            variant === 'primary' ? 'text-[#6B7280]' : 'text-white/80'
          }`}
        >
          Roam together
        </span>
      )}
    </div>
  )
}

/**
 * App icon only — official PNG from /brand/rovvy_icon.png
 */
export function RovvyIcon({
  size = 32,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_ASSETS.icon}
      alt="Rovvy"
      width={size}
      height={size}
      className={`object-contain ${className}`.trim()}
    />
  )
}

export default RovvyLogo
