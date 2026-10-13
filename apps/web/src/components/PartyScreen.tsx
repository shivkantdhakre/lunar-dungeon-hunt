'use client';

import React, { useState, useEffect } from 'react';
import type { PrivatePartySnapshot, PublicMatchSnapshot, PublicFighter } from '@dungeon-hunt/shared-contracts';
import { ROLES } from '@dungeon-hunt/game-rules';
import { useSocket } from '../../lib/socket/SocketProvider';
import { sounds } from '../lib/sound/sound-effects';
import { generateUUID } from '../lib/uuid';
import { CharacterSelectTile } from './CharacterSelectTile';
import { CharacterArtwork } from './CharacterArtwork';
import { ActionBar, ActionChoice } from './ActionBar';
import { BattleStage } from './BattleStage';
import { MatchResultOverlay } from './MatchResultOverlay';
import { getCharacterAsset } from '../lib/assets/game-assets';

interface PartyScreenProps {
  partySide: 'A' | 'B';
  partyState: PrivatePartySnapshot | null;
  matchState: PublicMatchSnapshot | null;
  activeFighterA?: PublicFighter | null;
  activeFighterB?: PublicFighter | null;
}

export function PartyScreen({
  partySide,
  partyState,
  matchState,
  activeFighterA,
  activeFighterB,
}: PartyScreenProps) {
  const { socket } = useSocket();
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionChoice>('strike');
  const [selectedSuddenDeathAction, setSelectedSuddenDeathAction] = useState<'strike' | 'guard'>('strike');
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  // Sync tentative selection from server private snapshot
  useEffect(() => {
    if (partyState?.selectedFighterId) {
      setSelectedFighterId(partyState.selectedFighterId);
    }
  }, [partyState?.selectedFighterId]);

  // Live timer tick
  useEffect(() => {
    const deadline =
      partyState?.actionDeadlineAt ??
      partyState?.selectionDeadlineAt ??
      matchState?.actionDeadlineAt ??
      matchState?.selectionDeadlineAt ??
      null;

    if (!deadline || matchState?.status === 'paused') {
      setTimeLeftMs(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimeLeftMs(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [partyState?.actionDeadlineAt, partyState?.selectionDeadlineAt, matchState?.actionDeadlineAt, matchState?.selectionDeadlineAt, matchState?.status]);

  const handleSelectFighter = (fighterId: string) => {
    sounds.playClick();
    setSelectedFighterId(fighterId);
    if (!socket || !partyState || partyState.fighterLocked || matchState?.status === 'paused' || matchState?.status === 'lobby') return;
    const duelId = `duel-${matchState?.currentDuelNumber ?? 1}`;
    socket.emit('duel:selectFighter', {
      matchId: partyState.matchId,
      duelId,
      fighterId,
    });
  };

  const handleLockFighter = () => {
    if (!socket || !partyState || !selectedFighterId || partyState.fighterLocked || matchState?.status === 'paused') return;
    sounds.playClick();
    const duelId = `duel-${matchState?.currentDuelNumber ?? 1}`;
    socket.emit('duel:lockFighter', {
      matchId: partyState.matchId,
      duelId,
      fighterId: selectedFighterId,
    });
  };

  const handleSubmitAction = () => {
    if (!socket || !partyState || partyState.actionLocked || matchState?.status === 'paused') return;
    if (selectedAction === 'guard') sounds.playGuard();
    else if (selectedAction === 'skill') sounds.playSkill();
    else sounds.playStrike();

    const duelId = `duel-${matchState?.currentDuelNumber ?? 1}`;
    socket.emit('duel:submitAction', {
      matchId: partyState.matchId,
      duelId,
      turnNumber: matchState?.currentTurnNumber ?? 1,
      commandId: generateUUID(),
      actionType: selectedAction,
    });
  };

  const handleSubmitSuddenDeathAction = () => {
    if (!socket || !partyState || partyState.suddenDeathActionLocked || matchState?.status === 'paused') return;
    if (selectedSuddenDeathAction === 'guard') sounds.playGuard();
    else sounds.playStrike();

    const duelId = `duel-${matchState?.currentDuelNumber ?? 1}`;
    socket.emit('duel:submitSuddenDeathAction', {
      matchId: partyState.matchId,
      duelId,
      commandId: generateUUID(),
      actionType: selectedSuddenDeathAction,
    });
  };

  if (!partyState) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center border border-white/10 max-w-xl mx-auto my-12 shadow-2xl">
        <span className="text-4xl block mb-3 animate-spin">⏳</span>
        <h3 className="text-xl font-bold text-white mb-1">Awaiting Authoritative Synchronization...</h3>
        <p className="text-sm text-slate-400">
          Connecting to Party {partySide} private sanctum and verifying battle credentials.
        </p>
      </div>
    );
  }

  const isPaused = matchState?.status === 'paused';
  const isPicking = matchState?.status === 'picking' || (isPaused && !partyState.selectedAction && !partyState.selectedSuddenDeathAction && partyState.roster.some(r => !r.used));
  const isDueling = matchState?.status === 'dueling' || (isPaused && partyState.selectedFighterId && !matchState?.status?.includes('picking'));
  const isSuddenDeath = matchState?.status === 'suddenDeath';

  // Identify currently active fighter role definition
  const lockedFighterMember = partyState.roster.find((m) => m.fighterId === partyState.selectedFighterId);
  const activeRoleDef = lockedFighterMember ? ROLES[lockedFighterMember.roleId] : null;

  // Selected fighter member in picking phase
  const previewFighterMember = partyState.roster.find((m) => m.fighterId === selectedFighterId) || partyState.roster.find((m) => !m.used) || partyState.roster[0];
  const previewRoleDef = previewFighterMember ? ROLES[previewFighterMember.roleId] : null;
  const previewRoleAsset = previewFighterMember ? getCharacterAsset(previewFighterMember.roleId) : null;

  const myFighter = partySide === 'A' ? (activeFighterA ?? matchState?.activeFighterA) : (activeFighterB ?? matchState?.activeFighterB);
  const myRoleKey = myFighter?.roleId ?? lockedFighterMember?.roleId;
  const myRoleDef = myRoleKey ? ROLES[myRoleKey] : activeRoleDef;

  const opponentLocked = partySide === 'A' ? matchState?.lockedPartyB : matchState?.lockedPartyA;

  return (
    <div className="space-y-4">
      {/* ── TOP PARTY CONSOLE STATUS CARD ── */}
      <section className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                partySide === 'A'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              }`}
            >
              {partySide === 'A' ? (matchState?.partyAName ?? 'PARTY A') : (matchState?.partyBName ?? 'PARTY B')} CONSOLE
            </span>
            <span className="text-[11px] text-slate-400 font-mono">ID: {partyState.partyId}</span>
          </div>
          <h2 className="text-xl font-black text-white mt-0.5">
            Series Score: <span className="text-amber-400">{matchState?.scoreA ?? 0}</span> —{' '}
            <span className="text-purple-400">{matchState?.scoreB ?? 0}</span>
            {matchState?.partyAName && matchState?.partyBName && (
              <span className="text-xs text-slate-400 block font-normal mt-0.5 font-mono">
                {matchState.partyAName} vs {matchState.partyBName}
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-5">
          {/* Opponent Status Indicator */}
          <div className="text-right border-r border-white/10 pr-5">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-semibold">Opponent State</span>
            <span className={`text-xs font-bold ${opponentLocked ? 'text-emerald-400' : 'text-slate-400'}`}>
              {opponentLocked ? '🔒 Ready' : '🤔 Choosing...'}
            </span>
          </div>

          {/* Time Remaining */}
          {timeLeftMs !== null && !isPaused && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-semibold">Time Remaining</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                {(timeLeftMs / 1000).toFixed(1)}s
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── PAUSED BANNER ── */}
      {isPaused && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏸️</span>
            <div>
              <strong>MATCH TEMPORARILY PAUSED:</strong> {matchState?.pauseReason || 'Tournament desk timeout'}
              <p className="text-xs text-amber-300/70">Console inputs are temporarily disabled until the host resumes play.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 1: FIGHTER SELECTION ── */}
      {(isPicking || (!isDueling && !isSuddenDeath && matchState?.status !== 'completed')) && (
        <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold block">
                {matchState?.status === 'lobby' ? 'PHASE: TOURNAMENT LOBBY' : 'PHASE: SECRET DRAFT'}
              </span>
              <h3 className="text-2xl font-black text-white">Select Your Champion</h3>
              <p className="text-xs text-slate-400">
                {matchState?.status === 'lobby'
                  ? 'Lineup registered. Review your team below before the Host commences Duel 1.'
                  : 'Picks are secret and encrypted on the server until both parties lock in.'}
              </p>
            </div>
            {partyState.fighterLocked && (
              <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                🔒 Fighter Locked In
              </span>
            )}
          </div>

          {matchState?.status === 'lobby' && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2.5">
              <span className="text-base">⏳</span>
              <div>
                <strong>Tournament Lobby Phase:</strong> Rosters are registered. You may preview your champions and skills below. Secret drafting begins as soon as the Host clicks <em>Start Match</em>.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Interactive 5 Roster Champion Tiles */}
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                Party Roster ({partyState.roster.filter(r => !r.used).length} of 5 Ready)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {partyState.roster.map((member) => {
                  const isSelected = selectedFighterId === member.fighterId;
                  const isUsed = member.used;

                  return (
                    <CharacterSelectTile
                      key={member.fighterId}
                      roleId={member.roleId}
                      fighterId={member.fighterId}
                      isSelected={isSelected}
                      isUsed={isUsed}
                      isLocked={partyState.fighterLocked && isSelected}
                      disabled={false}
                      onClick={() => handleSelectFighter(member.fighterId)}
                      onSelect={() => handleSelectFighter(member.fighterId)}
                    />
                  );
                })}
              </div>

              {/* Lock-In Action Button */}
              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {selectedFighterId ? 'Champion selected. Confirm your pick when ready.' : 'Select a champion to preview stats.'}
                </span>
                <button
                  onClick={handleLockFighter}
                  disabled={!selectedFighterId || partyState.fighterLocked || isPaused || matchState?.status === 'lobby'}
                  className="px-8 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
                >
                  {matchState?.status === 'lobby'
                    ? '⏳ Waiting for Match Start...'
                    : partyState.fighterLocked
                    ? 'Locked In! Waiting for Opponent...'
                    : isPaused
                    ? '⏸️ Match Paused'
                    : '🔒 Lock In Fighter'}
                </button>
              </div>
            </div>

            {/* Right Column: Hero Character Preview Display */}
            <div className="lg:col-span-5 rounded-3xl p-6 bg-slate-950/70 border border-white/10 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1">
                Selected Champion Preview
              </span>
              <h4 className="text-2xl font-black text-white capitalize">
                {previewRoleDef?.name ?? 'Champion'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 mb-3">
                {previewRoleAsset?.description}
              </p>

              {/* Full Body Character Artwork */}
              <div className="my-2">
                <CharacterArtwork
                  roleId={previewFighterMember?.roleId}
                  side={partySide}
                  size="hero"
                />
              </div>

              {/* Stat Gauges & Signature Skill Preview */}
              {previewRoleDef && (
                <div className="w-full space-y-2 mt-4 pt-4 border-t border-white/10 text-left">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Maximum Health</span>
                      <span className="font-mono font-bold text-emerald-400">{previewRoleDef.maxHp} HP</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Physical ATK</span>
                      <span className="font-mono font-bold text-rose-400">{previewRoleDef.baseAttack} DMG</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex justify-between items-center text-xs font-bold text-amber-300 mb-1">
                      <span>✨ {previewRoleDef.skill.name}</span>
                      <span className="text-[10px] font-mono text-amber-400/80">{previewRoleDef.skill.usesPerDuel}x / duel</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {previewRoleDef.skill.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── PHASE 2: ACTIVE DUEL COMBAT & ACTION SELECTION ── */}
      {(isDueling || isSuddenDeath) && (
        <section className="space-y-4">
          {/* Live Opposing Battle Stage */}
          {matchState && (
            <BattleStage
              matchState={matchState}
              activeFighterA={activeFighterA}
              activeFighterB={activeFighterB}
              countdownMs={timeLeftMs}
              isPaused={isPaused}
            />
          )}

          {/* Interactive Combat Action Bar */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-cyan-400 tracking-wider">
                  {isSuddenDeath ? '⚡ SUDDEN DEATH ROUND' : `Turn ${matchState?.currentTurnNumber ?? 1} of 6`}
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Select Combat Action {myRoleDef ? `for ${myRoleDef.name}` : ''}
                </h3>
              </div>
              {(partyState.actionLocked || partyState.suddenDeathActionLocked) && (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  🔒 Action Locked In
                </span>
              )}
            </div>

            {!isSuddenDeath ? (
              <div className="space-y-4">
                <ActionBar
                  selectedAction={selectedAction}
                  onSelectAction={setSelectedAction}
                  roleDef={myRoleDef}
                  isActionLocked={partyState.actionLocked}
                  isPaused={isPaused}
                  disabled={partyState.actionLocked || isPaused}
                  onLockAction={handleSubmitAction}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedSuddenDeathAction('strike')}
                    disabled={partyState.suddenDeathActionLocked || isPaused}
                    className={`p-6 rounded-2xl border text-left transition ${
                      selectedSuddenDeathAction === 'strike'
                        ? 'border-rose-400 bg-rose-500/10 shadow-xl shadow-rose-500/20 ring-1 ring-rose-400'
                        : 'border-white/10 bg-slate-900/60 hover:bg-slate-900/80'
                    }`}
                  >
                    <span className="text-3xl block mb-2">⚔️</span>
                    <h4 className="text-lg font-black text-white">Sudden Death Strike</h4>
                    <p className="text-xs text-slate-300 mt-1">Lethal strike to claim the tiebreak. Pierces defense.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSuddenDeathAction('guard')}
                    disabled={partyState.suddenDeathActionLocked || isPaused}
                    className={`p-6 rounded-2xl border text-left transition ${
                      selectedSuddenDeathAction === 'guard'
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400'
                        : 'border-white/10 bg-slate-900/60 hover:bg-slate-900/80'
                    }`}
                  >
                    <span className="text-3xl block mb-2">🛡️</span>
                    <h4 className="text-lg font-black text-white">Sudden Death Guard</h4>
                    <p className="text-xs text-slate-300 mt-1">Defends against incoming strike and counter-attacks.</p>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSubmitSuddenDeathAction}
                    disabled={partyState.suddenDeathActionLocked || isPaused}
                    className="px-8 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xl shadow-rose-500/25 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
                  >
                    {partyState.suddenDeathActionLocked
                      ? 'Locked In! Waiting for Opponent...'
                      : isPaused
                      ? '⏸️ Match Paused'
                      : '⚡ Confirm Sudden Death Action'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── PHASE 3: MATCH COMPLETED / VICTORY OVERLAY ── */}
      {matchState?.status === 'completed' && (
        <MatchResultOverlay matchState={matchState} />
      )}
    </div>
  );
}
