'use client';

import React from 'react';
import Image from 'next/image';
import { ROLES } from '@dungeon-hunt/game-rules';
import { getCharacterAsset } from '../lib/assets/game-assets';
import { RoleClassIcon, HealthVitalityIcon, AttackPowerIcon } from './RoleCodexIcons';

export interface CharacterSelectTileProps {
  fighterId: string;
  roleId: string;
  isSelected?: boolean;
  isUsed?: boolean;
  isLocked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onSelect?: () => void;
}

export function CharacterSelectTile({
  fighterId,
  roleId,
  isSelected = false,
  isUsed = false,
  isLocked = false,
  disabled = false,
  onClick,
  onSelect,
}: CharacterSelectTileProps) {
  const asset = getCharacterAsset(roleId);
  const roleDef = ROLES[roleId];

  const handleClick = () => {
    if (onClick) onClick();
    else if (onSelect) onSelect();
  };

  return (
    <button
      type="button"
      disabled={disabled || isUsed || isLocked}
      onClick={handleClick}
      className={`group relative flex flex-col items-center rounded-2xl p-2.5 sm:p-3 transition-all duration-300 text-left border ${
        isUsed
          ? 'opacity-35 grayscale border-slate-800 bg-slate-950/60 cursor-not-allowed'
          : isSelected
          ? 'border-amber-400 bg-slate-900/90 shadow-2xl shadow-amber-500/25 ring-2 ring-amber-400/80 scale-[1.02]'
          : 'border-white/10 bg-slate-900/70 hover:border-cyan-400/60 hover:bg-slate-800/80 hover:shadow-lg'
      }`}
    >
      {/* Used Badge */}
      {isUsed && (
        <span className="absolute top-2 right-2 z-10 text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/50">
          USED
        </span>
      )}

      {/* Selected Indicator */}
      {isSelected && !isUsed && (
        <span className="absolute top-2 right-2 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/50 flex items-center gap-1">
          <span>✓</span> ACTIVE
        </span>
      )}

      {/* Portrait Thumbnail Container */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 bg-slate-950 border border-white/5 shadow-inner">
        <Image
          src={asset.portrait}
          alt={asset.name}
          fill
          priority
          unoptimized
          sizes="(max-width: 768px) 120px, 160px"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Role Title & Stats */}
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <RoleClassIcon roleId={roleId} className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
            <h4 className="font-black text-xs text-white capitalize truncate">{roleDef?.name ?? roleId}</h4>
          </div>
          <span className="text-[9px] font-mono text-slate-400 uppercase flex-shrink-0">#{fighterId.slice(0, 4)}</span>
        </div>

        {roleDef && (
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 pt-0.5 border-t border-white/5 gap-1">
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <HealthVitalityIcon className="w-2.5 h-2.5 flex-shrink-0" />
              {roleDef.maxHp} HP
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-0.5">
              <AttackPowerIcon className="w-2.5 h-2.5 flex-shrink-0" />
              {roleDef.baseAttack} ATK
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
