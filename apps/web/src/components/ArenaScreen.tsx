'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { PublicMatchSnapshot, PublicFighter } from '@dungeon-hunt/shared-contracts';
import { sounds } from '../lib/sound/sound-effects';
import { BattleStage } from './BattleStage';
import { MatchResultOverlay } from './MatchResultOverlay';
import { CharacterSelectTile } from './CharacterSelectTile';
import { GAME_ENVIRONMENTS, LUNAR_ICONS } from '../lib/assets/game-assets';
import type { CombatAnimationState } from './CharacterArtwork';
import { RoleClassIcon } from './RoleCodexIcons';

interface ArenaScreenProps {
  matchState: PublicMatchSnapshot | null;
  activeFighterA?: PublicFighter | null;
  activeFighterB?: PublicFighter | null;
  combatLogs?: Array<{ actor: string; event: string }>;
  onNavigateToHost?: () => void;
}

export function ArenaScreen({
  matchState,
  activeFighterA,
  activeFighterB,
  combatLogs = [],
  onNavigateToHost,
}: ArenaScreenProps) {
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const [animStateA, setAnimStateA] = useState<CombatAnimationState>('idle');
  const [animStateB, setAnimStateB] = useState<CombatAnimationState>('idle');
  const lastLogLengthRef = useRef(combatLogs.length);

  // Play audio and trigger visual combat animations on events
  useEffect(() => {
    if (combatLogs.length > lastLogLengthRef.current) {
      const latest = combatLogs[0];
      if (latest) {
        const text = (latest.event || '').toLowerCase();
        const actor = latest.actor;

        if (text.includes('guard') || text.includes('shield')) {
          sounds.playGuard();
          if (actor === 'A') setAnimStateA('guard');
          else if (actor === 'B') setAnimStateB('guard');
        } else if (text.includes('skill') || text.includes('magic')) {
          sounds.playSkill();
          if (actor === 'A') {
            setAnimStateA('skill');
            setAnimStateB('hit');
          } else if (actor === 'B') {
            setAnimStateB('skill');
            setAnimStateA('hit');
          }
        } else if (text.includes('defeat') || text.includes('knockout') || text.includes('slain')) {
          sounds.playStrike();
          if (actor === 'A') setAnimStateA('defeat');
          else if (actor === 'B') setAnimStateB('defeat');
        } else {
          sounds.playStrike();
          if (actor === 'A') {
            setAnimStateA('strike');
            setAnimStateB('hit');
          } else if (actor === 'B') {
            setAnimStateB('strike');
            setAnimStateA('hit');
          }
        }

        // Return to idle after animation pulse
        const timeout = setTimeout(() => {
          setAnimStateA('idle');
          setAnimStateB('idle');
        }, 1100);

        return () => clearTimeout(timeout);
      }
    }
    lastLogLengthRef.current = combatLogs.length;
  }, [combatLogs]);

  // Play fanfare on match victory
  useEffect(() => {
    if (matchState?.status === 'completed' && (matchState.scoreA >= 2 || matchState.scoreB >= 2)) {
      sounds.playVictory();
    }
  }, [matchState?.status, matchState?.scoreA, matchState?.scoreB]);

  // Live countdown ticker
  useEffect(() => {
    const deadline = matchState?.actionDeadlineAt ?? matchState?.selectionDeadlineAt ?? null;
    if (!deadline || matchState?.status === 'paused') {
      setCountdownMs(null);
      return;
    }

    setCountdownMs(Math.max(0, deadline - Date.now()));

    const interval = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setCountdownMs(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [matchState?.actionDeadlineAt, matchState?.selectionDeadlineAt, matchState?.status]);

  if (!matchState) {
    return (
      <div className="relative rounded-3xl overflow-hidden border border-amber-400/20 shadow-2xl text-center bg-slate-950 min-h-[420px]">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#1e1340_0%,_#050814_100%)]" />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 20% 30%, #f59e0b44 0%, transparent 50%), radial-gradient(circle at 80% 70%, #7c3aed44 0%, transparent 50%)',
          }} />
        </div>
        {/* Floating decorative orbs */}
        <div className="absolute top-8 left-12 w-3 h-3 rounded-full bg-amber-400/60 animate-pulse blur-sm" />
        <div className="absolute top-20 right-16 w-2 h-2 rounded-full bg-purple-400/50 animate-ping" style={{ animationDuration: '2.5s' }} />
        <div className="absolute bottom-16 left-20 w-2 h-2 rounded-full bg-cyan-400/40 animate-ping" style={{ animationDuration: '3.2s' }} />
        <div className="absolute bottom-8 right-12 w-3 h-3 rounded-full bg-amber-500/40 animate-pulse" style={{ animationDuration: '1.8s' }} />

        <div className="relative z-10 flex flex-col items-center justify-center py-20 px-8 gap-6">
          {/* Moon / Diya icon cluster */}
          <div className="relative mb-2">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-150" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-900/60 to-slate-900/80 border border-amber-400/30 flex items-center justify-center text-5xl shadow-2xl backdrop-blur-md">
              🌙
            </div>
          </div>

          <div className="space-y-2 max-w-lg">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
              ✦ AAYANSH&apos;26 • Lunar Night Festival ✦
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Tournament Arena
            </h2>
            <h3 className="text-lg font-bold text-amber-300/80">
              Awaiting Match Initialization
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              The public arena projector will auto-synchronize once tournament operations commence from the Host Desk.
              Champions stand ready in the lunar sanctum.
            </p>
          </div>

          {/* Decorative role icons */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-2">
            {['swordsman', 'archer', 'mage', 'tank', 'rogue', 'assassin', 'vanguard', 'paladin'].map((roleId, i) => (
              <div
                key={roleId}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/80 border border-amber-500/20 text-amber-300 flex items-center justify-center shadow-md hover:border-amber-400 hover:scale-105 transition"
                title={roleId}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <RoleClassIcon roleId={roleId} className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              </div>
            ))}
          </div>

          {onNavigateToHost && (
            <button
              onClick={onNavigateToHost}
              className="mt-2 px-8 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2"
            >
              <span>🎛️</span> Go to Host Desk to Provision
            </button>
          )}
        </div>
      </div>
    );
  }

  const isCompleted = matchState.status === 'completed';
  const isPaused = matchState.status === 'paused';
  const isLobby = matchState.status === 'lobby';
  const isPicking = matchState.status === 'picking';
  const isDueling = matchState.status === 'dueling' || matchState.status === 'suddenDeath';

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ── TOP BEST-OF-THREE GRAND SCOREBOARD ── */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Party A Banner */}
          <div className="flex items-center gap-4 text-left w-full md:w-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-2xl font-black text-slate-950 shadow-lg shadow-amber-500/30">
              A
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">Party A</span>
              <h3 className="text-xl sm:text-2xl font-black text-white">{matchState.partyAName ?? 'Party A'}</h3>
              <span className={`text-[11px] font-bold uppercase mt-0.5 inline-block ${matchState.lockedPartyA ? 'text-emerald-400' : 'text-slate-400'}`}>
                {matchState.lockedPartyA ? '🔒 Locked In' : '🤔 Choosing...'}
              </span>
            </div>
          </div>

          {/* Center Series Score & Status */}
          <div className="text-center px-6 py-2.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
              BEST OF THREE • DUEL {matchState.currentDuelNumber}
            </span>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-4">
              <span className="text-amber-400">{matchState.scoreA}</span>
              <span className="text-slate-600 font-light">—</span>
              <span className="text-purple-400">{matchState.scoreB}</span>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider mt-1 inline-block ${
              isPaused
                ? 'text-amber-300 animate-pulse'
                : matchState.status === 'suddenDeath'
                ? 'text-rose-400 animate-pulse'
                : 'text-cyan-400'
            }`}>
              {isPaused ? '⏸️ MATCH PAUSED' : matchState.status === 'suddenDeath' ? '⚡ SUDDEN DEATH ⚡' : `PHASE: ${matchState.status.toUpperCase()}`}
            </span>
          </div>

          {/* Party B Banner */}
          <div className="flex items-center gap-4 text-right w-full md:w-auto justify-end">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-purple-400">Party B</span>
              <h3 className="text-xl sm:text-2xl font-black text-white">{matchState.partyBName ?? 'Party B'}</h3>
              <span className={`text-[11px] font-bold uppercase mt-0.5 inline-block ${matchState.lockedPartyB ? 'text-emerald-400' : 'text-slate-400'}`}>
                {matchState.lockedPartyB ? '🔒 Locked In' : '🤔 Choosing...'}
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-purple-500/30">
              B
            </div>
          </div>
        </div>

        {/* Live Timer Gauge */}
        {countdownMs !== null && !isPaused && (
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span className="uppercase font-semibold tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              {matchState.status === 'picking' ? 'Selection Timer' : 'Action Timer'}
            </span>
            <span className="font-mono font-bold text-amber-300 text-sm">
              {(countdownMs / 1000).toFixed(1)}s remaining
            </span>
          </div>
        )}
      </section>

      {/* ── PAUSE BANNER ── */}
      {isPaused && (
        <section className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center text-amber-200 animate-pulse space-y-1">
          <div className="flex items-center justify-center gap-2 text-base font-bold">
            <span>⏸️</span> MATCH TEMPORARILY PAUSED
          </div>
          <p className="text-xs text-amber-300/80">
            Reason: {matchState.pauseReason || 'Tournament desk timeout / referee ruling'}
          </p>
        </section>
      )}

      {/* ── LOBBY STAGE ── */}
      {isLobby && (
        <section className="relative rounded-3xl overflow-hidden border border-white/15 p-12 text-center shadow-2xl bg-slate-950">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <Image
              src={GAME_ENVIRONMENTS.mainLunarBackdrop}
              alt="Lunar Tournament Arena"
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          </div>
          <div className="relative z-10 max-w-lg mx-auto space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center p-3 shadow-xl backdrop-blur-md">
              <Image
                src={LUNAR_ICONS.crest}
                alt="Lunar Crest"
                width={56}
                height={56}
                className="w-14 h-14"
              />
            </div>
            <h3 className="text-2xl font-black text-white tracking-wide">
              Tournament Lobby Stage
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Both parties have registered their 5-champion lineups. The clash will commence when the Tournament Host triggers the start sequence.
            </p>
          </div>
        </section>
      )}

      {/* ── PICKING PHASE / SECRET DRAFT STAGE ── */}
      {isPicking && (
        <section className="relative rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl p-6 sm:p-8 bg-slate-950 space-y-6">
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <Image
              src={GAME_ENVIRONMENTS.characterSelectionArena}
              alt="Character Selection Arena"
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          </div>

          <div className="relative z-10 text-center max-w-md mx-auto space-y-1">
            <span className="text-xs uppercase font-mono font-bold tracking-widest text-cyan-400">
              SECRET CHAMPION SELECTION
            </span>
            <h3 className="text-xl font-black text-white">Duel {matchState.currentDuelNumber} Draft in Progress</h3>
            <p className="text-xs text-slate-400">
              Picks remain encrypted. Both fighters will be revealed simultaneously once locked.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Party A Roster Status */}
            <div className="rounded-2xl p-5 bg-slate-950/80 border border-amber-500/20 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="font-bold text-sm text-amber-300">Party A Champions</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  matchState.lockedPartyA ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {matchState.lockedPartyA ? '🔒 READY' : '🤔 SELECTING...'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {matchState.rosterA.map((member) => (
                  <CharacterSelectTile
                    key={member.fighterId}
                    roleId={member.roleId}
                    fighterId={member.fighterId}
                    isUsed={member.used}
                    disabled
                  />
                ))}
              </div>
            </div>

            {/* Party B Roster Status */}
            <div className="rounded-2xl p-5 bg-slate-950/80 border border-purple-500/20 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="font-bold text-sm text-purple-300">Party B Champions</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  matchState.lockedPartyB ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {matchState.lockedPartyB ? '🔒 READY' : '🤔 SELECTING...'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {matchState.rosterB.map((member) => (
                  <CharacterSelectTile
                    key={member.fighterId}
                    roleId={member.roleId}
                    fighterId={member.fighterId}
                    isUsed={member.used}
                    disabled
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CENTRAL DUEL STAGE (ACTIVE COMBATANTS WITH REAL 2.5D ARTWORK) ── */}
      {isDueling && (
        <BattleStage
          matchState={matchState}
          activeFighterA={activeFighterA ?? matchState.activeFighterA}
          activeFighterB={activeFighterB ?? matchState.activeFighterB}
          animStateA={animStateA}
          animStateB={animStateB}
          countdownMs={countdownMs}
          isPaused={isPaused}
        />
      )}

      {/* ── CHAMPION VICTORY MODAL OVERLAY ── */}
      {isCompleted && (
        <MatchResultOverlay matchState={matchState} onResetOrDismiss={onNavigateToHost} />
      )}

      {/* ── COMBAT RESOLUTION EVENT LOG ── */}
      <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span>📜</span> Live Arena Combat Chronicle
        </h3>

        <div className="bg-slate-950/70 rounded-2xl p-4 border border-white/5 max-h-56 overflow-y-auto space-y-2 text-xs font-mono">
          {combatLogs.length === 0 ? (
            <p className="text-slate-500 italic">No combat events recorded yet. Awaiting action resolution.</p>
          ) : (
            combatLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.actor === 'A'
                      ? 'bg-amber-500/20 text-amber-300'
                      : log.actor === 'B'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {log.actor}
                </span>
                <span className="text-slate-300">{log.event}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
