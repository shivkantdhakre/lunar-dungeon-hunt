'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import type { RoleDefinition } from '@dungeon-hunt/game-rules';
import { GAME_UI } from '../lib/assets/game-assets';

export type ActionChoice = 'strike' | 'guard' | 'skill';

export interface ActionBarProps {
  selectedAction: ActionChoice;
  onSelectAction: (action: ActionChoice) => void;
  onSubmitAction?: () => void;
  onLockAction?: () => void;
  isActionLocked?: boolean;
  disabled?: boolean;
  isPaused?: boolean;
  activeRoleDef?: RoleDefinition | null;
  roleDef?: RoleDefinition | null;
  turnNumber?: number;
}

export function ActionBar({
  selectedAction,
  onSelectAction,
  onSubmitAction,
  onLockAction,
  isActionLocked = false,
  disabled = false,
  isPaused = false,
  activeRoleDef,
  roleDef,
  turnNumber: _turnNumber = 1,
}: ActionBarProps) {
  const effectiveRoleDef = activeRoleDef || roleDef;
  const isLockedOrDisabled = isActionLocked || disabled || isPaused;

  const handleConfirm = () => {
    if (onSubmitAction) onSubmitAction();
    else if (onLockAction) onLockAction();
  };

  // Keyboard shortcuts: 1 for Strike, 2 for Guard, 3 for Skill, Enter to Lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLockedOrDisabled) return;
      if (e.key === '1') onSelectAction('strike');
      else if (e.key === '2') onSelectAction('guard');
      else if (e.key === '3') onSelectAction('skill');
      else if (e.key === 'Enter') handleConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLockedOrDisabled, onSelectAction, onSubmitAction, onLockAction]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Strike Action */}
        <button
          type="button"
          onClick={() => onSelectAction('strike')}
          disabled={isLockedOrDisabled}
          className={`group relative p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 flex items-start gap-3 ${
            selectedAction === 'strike'
              ? 'border-rose-400 bg-rose-950/40 shadow-xl shadow-rose-500/25 ring-2 ring-rose-400 scale-[1.01]'
              : 'border-white/10 bg-slate-900/80 hover:border-rose-400/50 hover:bg-slate-800/80'
          }`}
        >
          <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center p-1 shadow-inner">
            <Image
              src={GAME_UI.strikeIcon}
              alt="Strike"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm sm:text-base">Strike</h4>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                [1] Fast
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug line-clamp-2">
              Standard physical attack. Deals {effectiveRoleDef?.baseAttack ?? 20} DMG. Interrupts Mage Arcane Burst.
            </p>
          </div>
        </button>

        {/* Guard Action */}
        <button
          type="button"
          onClick={() => onSelectAction('guard')}
          disabled={isLockedOrDisabled}
          className={`group relative p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 flex items-start gap-3 ${
            selectedAction === 'guard'
              ? 'border-cyan-400 bg-cyan-950/40 shadow-xl shadow-cyan-500/25 ring-2 ring-cyan-400 scale-[1.01]'
              : 'border-white/10 bg-slate-900/80 hover:border-cyan-400/50 hover:bg-slate-800/80'
          }`}
        >
          <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center p-1 shadow-inner">
            <Image
              src={GAME_UI.guardIcon}
              alt="Guard"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm sm:text-base">Guard</h4>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                [2] Defense
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug line-clamp-2">
              Defensive barrier stance. Reduces incoming guardable damage by 50% (25% vs Vanguard).
            </p>
          </div>
        </button>

        {/* Signature Skill Action */}
        <button
          type="button"
          onClick={() => onSelectAction('skill')}
          disabled={isLockedOrDisabled}
          className={`group relative p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 flex items-start gap-3 ${
            selectedAction === 'skill'
              ? 'border-amber-400 bg-amber-950/40 shadow-xl shadow-amber-500/25 ring-2 ring-amber-400 scale-[1.01]'
              : 'border-white/10 bg-slate-900/80 hover:border-amber-400/50 hover:bg-slate-800/80'
          }`}
        >
          <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center p-1 shadow-inner">
            <Image
              src={GAME_UI.skillIcon}
              alt="Signature Skill"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm sm:text-base truncate">
                {effectiveRoleDef?.skill.name ?? 'Signature Skill'}
              </h4>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                [3] Skill
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug line-clamp-2">
              {effectiveRoleDef?.skill.description ?? 'Unique high-impact champion ability.'}
            </p>
            {effectiveRoleDef && (
              <span className="mt-0.5 text-[9px] font-mono text-amber-300 block">
                Charges: {effectiveRoleDef.skill.usesPerDuel}x per duel
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Lock In Confirmation Button */}
      {(onSubmitAction || onLockAction) && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Press [1], [2], [3] or click an action, then press [Enter] to submit.
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLockedOrDisabled}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          >
            {isActionLocked
              ? 'Action Locked In! Waiting for Opponent...'
              : isPaused
              ? '⏸️ Match Paused'
              : '🔒 Lock In Action'}
          </button>
        </div>
      )}
    </div>
  );
}
