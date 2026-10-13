'use client';

import React from 'react';
import Image from 'next/image';
import { getCharacterAsset } from '../lib/assets/game-assets';

export type CombatAnimationState =
  | 'idle'
  | 'striking-left'
  | 'striking-right'
  | 'strike'
  | 'hit'
  | 'guarding'
  | 'guard'
  | 'skill'
  | 'defeated'
  | 'defeat';

interface CharacterArtworkProps {
  roleId?: string | null;
  side?: 'A' | 'B';
  animationState?: CombatAnimationState;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'preview';
}

export function CharacterArtwork({
  roleId,
  side = 'A',
  animationState = 'idle',
  className = '',
  size = 'lg',
}: CharacterArtworkProps) {
  const asset = getCharacterAsset(roleId);

  // Height mappings
  const heightClasses: Record<'sm' | 'md' | 'lg' | 'hero' | 'preview', string> = {
    sm: 'h-40 sm:h-48 w-28 sm:w-32',
    md: 'h-56 sm:h-64 w-40 sm:w-44',
    preview: 'h-64 sm:h-72 w-44 sm:w-48',
    lg: 'h-72 sm:h-80 w-52 sm:w-60',
    hero: 'h-[300px] sm:h-[350px] md:h-[390px] w-52 sm:w-60 md:w-68',
  };

  // Combat animation classes
  let animClass = 'animate-float-gentle';
  if (animationState === 'striking-left' || animationState === 'strike') {
    animClass = side === 'A' ? 'animate-strike-left' : 'animate-strike-right';
  } else if (animationState === 'striking-right') {
    animClass = 'animate-strike-right';
  } else if (animationState === 'hit') {
    animClass = 'animate-hit-shake';
  } else if (animationState === 'guarding' || animationState === 'guard') {
    animClass = 'animate-guard-pulse';
  } else if (animationState === 'skill') {
    animClass = 'scale-105 brightness-125 transition-all duration-500';
  } else if (animationState === 'defeated' || animationState === 'defeat') {
    animClass = 'opacity-30 grayscale transition-all duration-700';
  }

  const isFlipped = side === 'B';

  return (
    <div
      className={`relative flex items-end justify-center select-none pointer-events-none ${heightClasses[size]} ${className}`}
    >
      {/* Ground Runic Pedestal Glow */}
      <div
        className="absolute -bottom-2 w-36 sm:w-48 h-6 rounded-full blur-md opacity-70"
        style={{
          background: `radial-gradient(ellipse, ${asset.glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* Main Character Illustration - Flip isolated from keyframe transforms */}
      <div
        className="relative w-full h-full"
        style={{
          transform: isFlipped ? 'scaleX(-1)' : undefined,
        }}
      >
        <div className={`relative w-full h-full transition-transform duration-300 ${animClass}`}>
          <Image
            src={asset.fullBody}
            alt={asset.name}
            fill
            priority
            unoptimized
            sizes="(max-width: 768px) 240px, 380px"
            className="object-contain object-bottom filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
          />
        </div>
      </div>
    </div>
  );
}
