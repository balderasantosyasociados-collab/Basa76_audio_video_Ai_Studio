import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface CoverArtworkProps {
  src?: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CoverArtwork: React.FC<CoverArtworkProps> = ({
  src,
  alt,
  className = '',
  size = 'md',
}) => {
  const [failed, setFailed] = useState(false);

  const fallbackSrc = '/src/assets/images/basa_station_cover_1795431407775.jpg';
  const effectiveSrc = src && !failed ? src : fallbackSrc;

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  if (failed && !src) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#181F2E] to-[#0B0E14] border border-white/10 text-slate-400 ${className}`}
        aria-label={alt}
      >
        <Disc3 className={iconSizes[size]} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#181F2E] ${className}`}>
      <img
        src={effectiveSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};
