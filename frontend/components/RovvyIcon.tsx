import React from 'react';
import { SymbolPath, RocketPath, ArcPath } from './RovvyLogo';

type RovvyIconProps = {
  size?: number;
  className?: string;
}

export const RovvyIcon: React.FC<RovvyIconProps> = ({
  size = 32,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-center rounded-lg ${className}`}
      style={{
        display: 'flex',
        width: size,
        height: size,
        backgroundColor: '#0F766E',
      }}
    >
      <svg
        width="70%"
        height="70%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Arc */}
        <path
          d={ArcPath}
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* 'r' shape */}
        <path
          d={SymbolPath}
          fill="#FFFFFF"
        />
        {/* Rocket/Plane */}
        <path
          d={RocketPath}
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};

export default RovvyIcon;
