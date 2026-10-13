'use client';

import React from 'react';
import Image from 'next/image';
import type { PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';
import { GAME_ENVIRONMENTS } from '../lib/assets/game-assets';

interface MatchResultOverlayProps {
  matchState: PublicMatchSnapshot;
  onResetOrDismiss?: () => void;
}

export function MatchResultOverlay({ matchState, onResetOrDismiss }: MatchResultOverlayProps) {
  const winnerSide = matchState.scoreA > matchState.scoreB ? 'A' : 'B';
  const winnerScore = Math.max(matchState.scoreA, matchState.scoreB);
  const loserScore = Math.min(matchState.scoreA, matchState.scoreB);
  const winnerName = winnerSide === 'A' ? (matchState.partyAName ?? 'Party A') : (matchState.partyBName ?? 'Party B');
  const nameA = matchState.partyAName ?? 'Party A';
  const nameB = matchState.partyBName ?? 'Party B';

  return (
    <div className="relative rounded-3xl overflow-hidden border border-amber-400/40 shadow-2xl bg-slate-950 p-8 sm:p-12 text-center">
      {/* Background Sanctum Art */}
      <div className="absolute inset-0 pointer-events-none opacity-45">
        <Image
          src={GAME_ENVIRONMENTS.victoryDefeatBackdrop}
          alt="Victory Backdrop"
          fill
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="object-cover object-center filter brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full mx-auto bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-2xl animate-bounce">
          🏆
        </div>

        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
            SERIES VICTOR: {winnerName}!
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {winnerName} TRIUMPHS!
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            The ancient lunar sanctuary crowns <strong>{winnerName}</strong> as the victorious champions of AAYANSH&apos;26!
          </p>
          <p className="text-base text-amber-300 font-medium mt-1">
            Final Match Score: {matchState.scoreA} &mdash; {matchState.scoreB}
          </p>
        </div>

        {/* Grand Score Display */}
        <div className="inline-flex items-center gap-6 px-8 py-3 rounded-2xl bg-black/70 border border-white/10 shadow-2xl backdrop-blur-md">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">{nameA}</span>
            <span className="text-3xl font-black text-white">{matchState.scoreA}</span>
          </div>
          <span className="text-2xl text-slate-500 font-light">&mdash;</span>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-purple-400 block">{nameB}</span>
            <span className="text-3xl font-black text-white">{matchState.scoreB}</span>
          </div>
        </div>

        {/* Series Summary */}
        <p className="text-xs text-slate-400 font-mono">
          Final Series Result: Best-of-Three concluded at {winnerScore} - {loserScore}
        </p>

        {onResetOrDismiss && (
          <div className="pt-4">
            <button
              onClick={onResetOrDismiss}
              className="px-8 py-3 rounded-xl font-black text-sm uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-95 shadow-xl shadow-amber-500/20"
            >
              Continue to Desk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
