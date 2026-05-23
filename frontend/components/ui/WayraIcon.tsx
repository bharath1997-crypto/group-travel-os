'use client'
import React from 'react'

interface WayraIconProps {
  state?: 'flying' | 'perched'
  size?: number
  variant?: 'fog' | 'navy' | 'raw'
  animate?: boolean
  className?: string
}

function FlyingSVG() {
  return (
    <svg width="56" height="56" viewBox="0 0 100 100" fill="none">
      {/* Outer compass ring */}
      <circle cx="50" cy="50" r="42" stroke="url(#compass-gradient)" strokeWidth="2.5" strokeDasharray="6 3" />
      <circle cx="50" cy="50" r="35" stroke="url(#ring-gradient)" strokeWidth="1" opacity="0.6" />
      
      {/* Compass pointer lines */}
      <line x1="50" y1="8" x2="50" y2="15" stroke="#E94560" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="85" x2="50" y2="92" stroke="#0F3460" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="50" x2="15" y2="50" stroke="#0F3460" strokeWidth="2" strokeLinecap="round" />
      <line x1="85" y1="50" x2="92" y2="50" stroke="#0F3460" strokeWidth="2" strokeLinecap="round" />

      {/* Soaring travel bird / paper plane fusion */}
      <g transform="translate(18, 22)">
        {/* Back wing */}
        <path d="M12 28 L40 10 L28 32 Z" fill="url(#wing-back-grad)" />
        {/* Front wing */}
        <path d="M28 32 L56 5 L42 36 Z" fill="url(#wing-front-grad)" />
        {/* Main fuselage / bird body */}
        <path d="M8 40 L50 20 L28 32 Z" fill="url(#body-grad)" />
        {/* Beak / compass needle point */}
        <path d="M50 20 L58 17 L46 25 Z" fill="#E94560" />
      </g>

      {/* Sparkles / stars (smart AI touch) */}
      <path d="M72 24 L74 29 L79 31 L74 33 L72 38 L70 33 L65 31 L70 29 Z" fill="#FFD700" />
      <path d="M25 68 L26 71 L29 72 L26 73 L25 76 L24 73 L21 72 L24 71 Z" fill="#FFD700" opacity="0.8" />

      {/* Gradients definitions */}
      <defs>
        <radialGradient id="compass-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E94560" />
          <stop offset="100%" stopColor="#0F766E" />
        </radialGradient>
        <linearGradient id="ring-gradient" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#0F3460" />
        </linearGradient>
        <linearGradient id="body-grad" x1="8" y1="40" x2="50" y2="20">
          <stop offset="0%" stopColor="#0F3460" />
          <stop offset="100%" stopColor="#E94560" />
        </linearGradient>
        <linearGradient id="wing-front-grad" x1="28" y1="32" x2="56" y2="5">
          <stop offset="0%" stopColor="#E94560" />
          <stop offset="100%" stopColor="#FF7597" />
        </linearGradient>
        <linearGradient id="wing-back-grad" x1="12" y1="28" x2="40" y2="10">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PerchedSVG() {
  return (
    <svg width="56" height="56" viewBox="0 0 100 100" fill="none">
      {/* Glowing circular background */}
      <circle cx="50" cy="50" r="40" stroke="url(#ring-gradient)" strokeWidth="2" />
      <circle cx="50" cy="50" r="32" stroke="url(#ring-gradient)" strokeWidth="1" strokeDasharray="4 2" opacity="0.7" />
      
      {/* Stylized geometric perched bird / travel guide */}
      <g transform="translate(25, 22)">
        {/* Folded wing */}
        <path d="M12 35 Q22 15 36 24 Q24 28 12 35" fill="url(#wing-folded-grad)" stroke="#0F3460" strokeWidth="0.8" />
        {/* Compact body */}
        <ellipse cx="22" cy="38" rx="14" ry="10" fill="url(#body-perched-grad)" stroke="#0F3460" strokeWidth="0.8" />
        {/* Head */}
        <circle cx="34" cy="26" r="9" fill="white" stroke="#0F3460" strokeWidth="1" />
        {/* Smart crown cap */}
        <path d="M26 21 Q34 14 42 19 C40 26 30 26 26 21" fill="#0F3460" />
        {/* Eye (smart dot) */}
        <circle cx="37" cy="24" r="2.2" fill="#E94560" />
        <circle cx="38" cy="23.2" r="0.8" fill="white" />
        {/* Downward beak / pointer */}
        <path d="M34 33 L32 48 L36 33 Z" fill="#E94560" />
        {/* Perch branch */}
        <line x1="4" y1="48" x2="40" y2="48" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Gradients definitions */}
      <defs>
        <linearGradient id="ring-gradient" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#E94560" />
        </linearGradient>
        <linearGradient id="body-perched-grad" x1="8" y1="48" x2="36" y2="28">
          <stop offset="0%" stopColor="#0F3460" />
          <stop offset="100%" stopColor="#E94560" />
        </linearGradient>
        <linearGradient id="wing-folded-grad" x1="12" y1="35" x2="36" y2="24">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function WayraIcon({
  state = 'flying',
  size = 1,
  variant = 'fog',
  animate = true,
  className = ''
}: WayraIconProps) {

  const wrapStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(variant === 'fog' ? {
      background: 'radial-gradient(ellipse at center, rgba(233,69,96,0.13) 0%, rgba(233,69,96,0.03) 65%, transparent 100%)',
      borderRadius: '50%',
      padding: '10px',
    } : variant === 'navy' ? {
      background: '#0F3460',
      borderRadius: '50%',
      padding: '8px',
      boxShadow: '0 3px 10px rgba(15,52,96,0.22)',
    } : {}),
    transform: `scale(${size})`,
    transformOrigin: 'center',
  }

  const innerStyle: React.CSSProperties = animate ? {
    animation: state === 'flying'
      ? 'wayra-soar 3s ease-in-out infinite'
      : 'wayra-bob 4s ease-in-out infinite',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <>
      <style>{`
        @keyframes wayra-soar {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes wayra-bob {
          0%,100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
      `}</style>
      <div style={wrapStyle} className={className}>
        <div style={innerStyle}>
          {state === 'flying' ? <FlyingSVG /> : <PerchedSVG />}
        </div>
      </div>
    </>
  )
}
