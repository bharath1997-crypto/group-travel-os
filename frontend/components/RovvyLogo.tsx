import React from 'react';

export type RovvyLogoProps = {
  variant?: 'primary' | 'dark' | 'white'
  showTagline?: boolean
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  width?: number
  height?: number
}

const sizeMap = {
  sm: { symbol: 24, text: 14, tagline: 10, gap: 4 },
  md: { symbol: 32, text: 18, tagline: 12, gap: 6 },
  lg: { symbol: 48, text: 24, tagline: 14, gap: 8 },
  xl: { symbol: 64, text: 32, tagline: 16, gap: 10 },
};

const variantMap = {
  primary: {
    symbol: '#0F766E',
    wordmark: '#0F766E',
    tagline: '#6B7280',
  },
  dark: {
    symbol: '#0F766E',
    wordmark: '#FFFFFF',
    tagline: '#94A3B8',
  },
  white: {
    symbol: '#FFFFFF',
    wordmark: '#FFFFFF',
    tagline: 'rgba(255, 255, 255, 0.7)',
  },
};

export const SymbolPath = "M25,35 H37 V45 C42,35 52,35 60,40 V52 C54,48 46,53 37,57 V80 H25 Z";
export const RocketPath = "M58,42 L85,15 L70,35 Z";
export const ArcPath = "M15,60 C25,85 55,90 80,55";

export const RovvyLogo: React.FC<RovvyLogoProps> = ({
  variant = 'primary',
  showTagline = true,
  showWordmark = true,
  size = 'md',
  className = '',
}) => {
  const currentSize = sizeMap[size];
  const colors = variantMap[variant];

  return (
    <div className={`flex items-center ${className}`} style={{ gap: currentSize.gap }}>
      {/* Symbol */}
      <svg
        width={currentSize.symbol}
        height={currentSize.symbol}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Arc */}
        <path
          d={ArcPath}
          stroke={colors.symbol}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* 'r' shape */}
        <path
          d={SymbolPath}
          fill={colors.symbol}
        />
        {/* Rocket/Plane */}
        <path
          d={RocketPath}
          fill={colors.symbol}
        />
      </svg>

      {/* Text */}
      {(showWordmark || showTagline) && (
        <div className="flex flex-col justify-center">
          {showWordmark && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 'bold',
                fontSize: currentSize.text,
                color: colors.wordmark,
                lineHeight: 1,
              }}
            >
              rovvy
            </span>
          )}
          {showTagline && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 'normal',
                fontSize: currentSize.tagline,
                color: colors.tagline,
                marginTop: 2,
              }}
            >
              Roam together
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RovvyLogo;
export { RovvyIcon } from './RovvyIcon';

