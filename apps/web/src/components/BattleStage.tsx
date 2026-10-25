'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { PublicFighter, PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';
import { ROLES } from '@dungeon-hunt/game-rules';
import { CharacterArtwork, CombatAnimationState } from './CharacterArtwork';
import { GAME_ENVIRONMENTS } from '../lib/assets/game-assets';
import { CombatVisualEffects, FloatingCombatTextItem } from './CombatVisualEffects';
import { sounds } from '../lib/sound/sound-effects';

interface BattleStageProps {
  matchState: PublicMatchSnapshot;
  activeFighterA?: PublicFighter | null;
  activeFighterB?: PublicFighter | null;
  animStateA?: CombatAnimationState;
  animStateB?: CombatAnimationState;
  countdownMs?: number | null;
  isPaused?: boolean;
}

export function BattleStage({
  matchState,
  activeFighterA,
  activeFighterB,
  animStateA = 'idle',
  animStateB = 'idle',
  countdownMs,
  isPaused = false,
}: BattleStageProps) {
  const isSuddenDeath = matchState.status === 'suddenDeath';
  const arenaBg = isSuddenDeath
    ? GAME_ENVIRONMENTS.suddenDeathArena
    : GAME_ENVIRONMENTS.primaryBattleArena;

  // Role definitions
  const roleA = activeFighterA?.roleId ? ROLES[activeFighterA.roleId] : null;
  const roleB = activeFighterB?.roleId ? ROLES[activeFighterB.roleId] : null;

  // HP calculations
  const maxHpA = activeFighterA?.maxHp ?? roleA?.maxHp ?? 100;
  const hpA = activeFighterA?.currentHp ?? maxHpA;
  const hpPctA = Math.max(0, Math.min(100, Math.round((hpA / maxHpA) * 100)));
  const shieldA = activeFighterA?.currentShield ?? 0;

  const maxHpB = activeFighterB?.maxHp ?? roleB?.maxHp ?? 100;
  const hpB = activeFighterB?.currentHp ?? maxHpB;
  const hpPctB = Math.max(0, Math.min(100, Math.round((hpB / maxHpB) * 100)));
  const shieldB = activeFighterB?.currentShield ?? 0;

  // Floating Combat Numbers & VFX State
  const [floatingTexts, setFloatingTexts] = useState<FloatingCombatTextItem[]>([]);
  const [activeVfxA, setActiveVfxA] = useState<'slash' | 'shield' | null>(null);
  const [activeVfxB, setActiveVfxB] = useState<'slash' | 'shield' | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const prevHpARef = useRef(hpA);
  const prevHpBRef = useRef(hpB);
  const prevShieldARef = useRef(shieldA);
  const prevShieldBRef = useRef(shieldB);
  const prevFighterIdARef = useRef(activeFighterA?.id);
  const prevFighterIdBRef = useRef(activeFighterB?.id);

  // Trigger floating combat feedback on HP or Shield changes
  useEffect(() => {
    // If fighter changed on side A (e.g. new duel), re-seed refs without damage diff
    if (activeFighterA?.id !== prevFighterIdARef.current) {
      prevFighterIdARef.current = activeFighterA?.id;
      prevHpARef.current = hpA;
      prevShieldARef.current = shieldA;
      return;
    }
    // If fighter changed on side B (e.g. new duel), re-seed refs without damage diff
    if (activeFighterB?.id !== prevFighterIdBRef.current) {
      prevFighterIdBRef.current = activeFighterB?.id;
      prevHpBRef.current = hpB;
      prevShieldBRef.current = shieldB;
      return;
    }
    // Damage to Party A
    if (prevHpARef.current > hpA) {
      const diff = prevHpARef.current - hpA;
      const isCrit = diff >= 28;
      const id = 'A-' + Date.now() + Math.random();
      setFloatingTexts((prev) => [
        ...prev,
        { id, side: 'A', text: `-${diff} HP`, type: isCrit ? 'crit' : 'damage' },
      ]);
      setActiveVfxA('slash');
      setIsShaking(true);
      if (isCrit) sounds.playCrit();
      else sounds.playHit();

      setTimeout(() => setActiveVfxA(null), 600);
      setTimeout(() => setIsShaking(false), 450);
      setTimeout(() => setFloatingTexts((p) => p.filter((item) => item.id !== id)), 1500);
    }

    // Damage to Party B
    if (prevHpBRef.current > hpB) {
      const diff = prevHpBRef.current - hpB;
      const isCrit = diff >= 28;
      const id = 'B-' + Date.now() + Math.random();
      setFloatingTexts((prev) => [
        ...prev,
        { id, side: 'B', text: `-${diff} HP`, type: isCrit ? 'crit' : 'damage' },
      ]);
      setActiveVfxB('slash');
      setIsShaking(true);
      if (isCrit) sounds.playCrit();
      else sounds.playHit();

      setTimeout(() => setActiveVfxB(null), 600);
      setTimeout(() => setIsShaking(false), 450);
      setTimeout(() => setFloatingTexts((p) => p.filter((item) => item.id !== id)), 1500);
    }

    // Shield Gain to Party A
    if (shieldA > prevShieldARef.current) {
      const diff = shieldA - prevShieldARef.current;
      const id = 'SA-' + Date.now();
      setFloatingTexts((prev) => [
        ...prev,
        { id, side: 'A', text: `+${diff} SHIELD`, type: 'shield' },
      ]);
      setActiveVfxA('shield');
      sounds.playShieldGain();
      setTimeout(() => setActiveVfxA(null), 900);
      setTimeout(() => setFloatingTexts((p) => p.filter((item) => item.id !== id)), 1500);
    }

    // Shield Gain to Party B
    if (shieldB > prevShieldBRef.current) {
      const diff = shieldB - prevShieldBRef.current;
      const id = 'SB-' + Date.now();
      setFloatingTexts((prev) => [
        ...prev,
        { id, side: 'B', text: `+${diff} SHIELD`, type: 'shield' },
      ]);
      setActiveVfxB('shield');
      sounds.playShieldGain();
      setTimeout(() => setActiveVfxB(null), 900);
      setTimeout(() => setFloatingTexts((p) => p.filter((item) => item.id !== id)), 1500);
    }

    prevHpARef.current = hpA;
    prevHpBRef.current = hpB;
    prevShieldARef.current = shieldA;
    prevShieldBRef.current = shieldB;
  }, [hpA, hpB, shieldA, shieldB]);

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl bg-slate-950 transition-transform ${isShaking ? 'animate-screen-shake' : ''}`}>
      {/* Floating Combat VFX Overlay */}
      <CombatVisualEffects
        floatingTexts={floatingTexts}
        activeVfxA={activeVfxA}
        activeVfxB={activeVfxB}
      />
      {/* ── Background Arena Environment ── */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src={arenaBg}
          alt="Battle Arena"
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="object-cover object-center filter brightness-[0.92]"
        />
        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/60" />
      </div>

      {/* ── Top Match Header Bar ── */}
      <div className="relative z-20 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/60 backdrop-blur-md">
        {/* Party A Vitals Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-slate-950 text-xs sm:text-sm shadow-md">
            A
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              {matchState.partyAName ?? 'Party A'} • Score: {matchState.scoreA}
            </span>
            <h4 className="text-sm sm:text-base font-black text-white capitalize leading-tight">
              {roleA?.name ?? activeFighterA?.roleId ?? 'Fighter A'}
            </h4>
          </div>
        </div>

        {/* Center Arena Status & Timer */}
        <div className="text-center px-3 py-1 rounded-xl bg-black/60 border border-white/10">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-slate-400 block">
            DUEL {matchState.currentDuelNumber} OF 3 • {isSuddenDeath ? '⚡ SUDDEN DEATH' : `TURN ${matchState.currentTurnNumber ?? 1}`}
          </span>
          {countdownMs != null && !isPaused && (
            <span className="text-xs sm:text-sm font-mono font-bold text-amber-300">
              {(countdownMs / 1000).toFixed(1)}s
            </span>
          )}
          {isPaused && (
            <span className="text-xs font-bold text-amber-400 animate-pulse">
              ⏸️ PAUSED
            </span>
          )}
        </div>

        {/* Party B Vitals Header */}
        <div className="flex items-center gap-2.5 text-right">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
              {matchState.partyBName ?? 'Party B'} • Score: {matchState.scoreB}
            </span>
            <h4 className="text-sm sm:text-base font-black text-white capitalize leading-tight">
              {roleB?.name ?? activeFighterB?.roleId ?? 'Fighter B'}
            </h4>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-black text-white text-xs sm:text-sm shadow-md">
            B
          </div>
        </div>
      </div>

      {/* ── Main Battlefield Stage with Opposing Characters ── */}
      <div className="relative z-10 min-h-[310px] sm:min-h-[350px] md:min-h-[380px] px-4 sm:px-8 flex items-end justify-between pb-3 sm:pb-4">
        {/* Left Side: Party A Combatant */}
        <div className="flex flex-col items-center sm:items-start w-48 sm:w-60 md:w-68 space-y-2">
          {/* Health Bar A Floating Gauge */}
          <div className="w-full bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-amber-500/30 backdrop-blur-md shadow-xl">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-amber-300 text-[11px] font-mono truncate max-w-[130px]">
                {roleA?.name ?? 'Fighter A'}
              </span>
              <span className={`font-mono text-[11px] ${hpPctA <= 25 ? 'text-rose-400 font-black animate-pulse' : hpPctA <= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {hpA} / {maxHpA} HP
              </span>
            </div>
            {/* HP Bar */}
            <div className="w-full h-2.5 sm:h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hpPctA <= 25
                    ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                    : hpPctA <= 50
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${hpPctA}%` }}
              />
            </div>
            {/* Astral Shield Bar */}
            {shieldA > 0 && (
              <div className="mt-1 pt-0.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                <span>🛡️ Astral Shield</span>
                <span>+{shieldA} Shield</span>
              </div>
            )}
          </div>

          {/* Full Body Character Visual */}
          <CharacterArtwork
            roleId={activeFighterA?.roleId}
            side="A"
            animationState={animStateA}
            size="hero"
          />
        </div>

        {/* Center Clash Emblem with Festive Diya & Lunar Theme */}
        <div className="hidden md:flex flex-col items-center justify-center mb-14 opacity-90 select-none">
          <div className="relative flex items-center justify-center">
            {/* Ambient Diya Glow behind emblem */}
            <div className="absolute w-20 h-20 rounded-full bg-amber-500/25 blur-xl animate-pulse" />
            <div className="w-12 h-12 rounded-2xl border border-amber-400/50 bg-slate-950/80 flex items-center justify-center text-xl font-black text-amber-300 shadow-2xl backdrop-blur-md glow-diya">
              🪔
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold tracking-widest text-amber-300 uppercase mt-1.5 flex items-center gap-1">
            <span>✨</span> LUNAR ARENA <span>✨</span>
          </span>
          <span className="text-[8px] font-mono tracking-wider text-amber-400/70 uppercase">
            AAYANSH&apos;26 FESTIVAL
          </span>
        </div>

        {/* Right Side: Party B Combatant */}
        <div className="flex flex-col items-center sm:items-end w-48 sm:w-60 md:w-68 space-y-2">
          {/* Health Bar B Floating Gauge */}
          <div className="w-full bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-purple-500/30 backdrop-blur-md shadow-xl">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className={`font-mono text-[11px] ${hpPctB <= 25 ? 'text-rose-400 font-black animate-pulse' : hpPctB <= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {hpB} / {maxHpB} HP
              </span>
              <span className="text-purple-300 text-[11px] font-mono truncate max-w-[130px]">
                {roleB?.name ?? 'Fighter B'}
              </span>
            </div>
            {/* HP Bar */}
            <div className="w-full h-2.5 sm:h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hpPctB <= 25
                    ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                    : hpPctB <= 50
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${hpPctB}%` }}
              />
            </div>
            {/* Astral Shield Bar */}
            {shieldB > 0 && (
              <div className="mt-1 pt-0.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                <span>🛡️ Astral Shield</span>
                <span>+{shieldB} Shield</span>
              </div>
            )}
          </div>

          {/* Full Body Character Visual */}
          <CharacterArtwork
            roleId={activeFighterB?.roleId}
            side="B"
            animationState={animStateB}
            size="hero"
          />
        </div>
      </div>
    </div>
  );
}
