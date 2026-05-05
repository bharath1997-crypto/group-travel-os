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
    <svg width="48" height="32" viewBox="0 0 220 140" fill="none">
      {/* Upper wing — long swept back */}
      <path
        d="M95 72 Q102 52 114 36 Q124 22 136 16 Q144 12 148 16 Q138 22 128 32 Q116 44 106 58 Q100 66 96 72"
        fill="white" stroke="#333" strokeWidth="1.4" strokeLinejoin="round"
      />
      {/* Wing feather detail lines */}
      <line x1="114" y1="36" x2="110" y2="26" stroke="#555" strokeWidth="0.7" strokeLinecap="round"/>
      <line x1="122" y1="30" x2="119" y2="20" stroke="#555" strokeWidth="0.7" strokeLinecap="round"/>
      <line x1="130" y1="24" x2="128" y2="14" stroke="#555" strokeWidth="0.6" strokeLinecap="round"/>
      <line x1="138" y1="18" x2="137" y2="10" stroke="#555" strokeWidth="0.6" strokeLinecap="round"/>
      {/* Wing tips — individual feathers */}
      <path d="M136 16 Q144 8 150 10 Q145 16 138 20" fill="white" stroke="#333" strokeWidth="0.9"/>
      <path d="M142 13 Q150 5 155 8 Q150 13 144 17" fill="white" stroke="#333" strokeWidth="0.8"/>
      <path d="M148 11 Q155 4 159 7 Q154 12 149 15" fill="white" stroke="#333" strokeWidth="0.7"/>
      {/* Lower wing drooping */}
      <path
        d="M98 78 Q104 90 118 95 Q130 98 138 95 Q128 89 116 84 Q106 80 100 76"
        fill="white" stroke="#333" strokeWidth="1.1" strokeLinejoin="round"
      />
      <line x1="104" y1="90" x2="100" y2="96" stroke="#888" strokeWidth="0.5" strokeLinecap="round"/>
      <line x1="112" y1="94" x2="109" y2="100" stroke="#888" strokeWidth="0.5" strokeLinecap="round"/>
      <line x1="120" y1="96" x2="119" y2="102" stroke="#888" strokeWidth="0.5" strokeLinecap="round"/>
      {/* Body — slim torpedo */}
      <path
        d="M68 80 Q80 68 96 70 Q112 72 124 76 Q118 86 104 88 Q86 90 74 86 Q66 84 68 80"
        fill="white" stroke="#333" strokeWidth="1.2" strokeLinejoin="round"
      />
      {/* Neck to head */}
      <path
        d="M118 74 Q126 70 134 68 Q142 68 144 74 Q140 78 132 78 Q122 78 118 74"
        fill="white" stroke="#333" strokeWidth="1.1"
      />
      {/* Head circle */}
      <circle cx="148" cy="70" r="14" fill="white" stroke="#333" strokeWidth="1.2"/>
      {/* Black cap — top of head */}
      <path
        d="M136 62 Q148 54 160 58 Q162 66 156 72 Q148 74 140 68 Q134 64 136 62"
        fill="#1a1a1a"
      />
      {/* Coral beak — long sharp pointing right */}
      <path
        d="M160 70 Q176 67 192 68 Q176 70 160 72"
        fill="#E94560" stroke="#c73050" strokeWidth="0.6"
      />
      {/* Forked tail — left side */}
      <path d="M68 80 Q52 74 38 64 Q46 74 58 82" fill="white" stroke="#333" strokeWidth="1.1"/>
      <path d="M70 86 Q52 84 36 78 Q44 82 58 88" fill="white" stroke="#333" strokeWidth="1.1"/>
      {/* Eye */}
      <circle cx="154" cy="66" r="3.5" fill="#1a1a1a"/>
      <circle cx="155" cy="65" r="1.1" fill="white"/>
      {/* Body center line detail */}
      <path d="M80 78 Q96 76 112 78" stroke="#bbb" strokeWidth="0.6" fill="none"/>
    </svg>
  )
}

function PerchedSVG() {
  return (
    <svg width="38" height="52" viewBox="0 0 110 148" fill="none">
      {/* Tail pointing up — perched posture */}
      <path d="M30 54 Q16 46 10 36 Q16 46 22 56" fill="white" stroke="#333" strokeWidth="1.1"/>
      <path d="M30 58 Q14 54 8 46 Q14 54 22 60" fill="white" stroke="#333" strokeWidth="1.1"/>
      {/* Wing folded neatly along body */}
      <path
        d="M32 50 Q40 36 58 30 Q70 26 74 32 Q64 38 52 46 Q42 52 34 58"
        fill="white" stroke="#333" strokeWidth="1.1" strokeLinejoin="round"
      />
      {/* Folded feather lines */}
      <path d="M44 38 Q56 34 66 32" stroke="#aaa" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
      <path d="M40 44 Q52 40 62 38" stroke="#aaa" strokeWidth="0.6" fill="none" strokeLinecap="round"/>
      <path d="M36 50 Q48 46 58 44" stroke="#aaa" strokeWidth="0.5" fill="none" strokeLinecap="round"/>
      {/* Body compact round */}
      <ellipse cx="46" cy="64" rx="18" ry="13" fill="white" stroke="#333" strokeWidth="1.2"/>
      {/* Neck */}
      <path
        d="M56 54 Q64 48 74 50 Q76 56 72 60 Q66 62 60 58"
        fill="white" stroke="#333" strokeWidth="1.1"
      />
      {/* Head */}
      <circle cx="74" cy="48" r="13" fill="white" stroke="#333" strokeWidth="1.2"/>
      {/* Black cap */}
      <path
        d="M64 40 Q74 34 84 38 Q86 44 82 50 Q74 52 66 46 Q62 42 64 40"
        fill="#1a1a1a"
      />
      {/* Eye */}
      <circle cx="80" cy="46" r="2.8" fill="#1a1a1a"/>
      <circle cx="81" cy="45" r="0.9" fill="white"/>
      {/* Coral beak pointing straight DOWN */}
      <path
        d="M72 58 Q70 74 70 90 Q72 74 74 58"
        fill="#E94560" stroke="#c73050" strokeWidth="0.6"
      />
      {/* Coral feet gripping stick */}
      <path d="M36 76 Q32 84 28 90" stroke="#E94560" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M38 78 Q36 86 34 92" stroke="#E94560" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M56 76 Q60 84 62 90" stroke="#E94560" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M54 78 Q56 86 58 92" stroke="#E94560" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* The stick — perch line */}
      <line x1="18" y1="92" x2="72" y2="92" stroke="#E94560" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
      {/* Beak tip touches earth */}
      <circle cx="71" cy="92" r="2" fill="#E94560" opacity="0.45"/>
    </svg>
  )
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
