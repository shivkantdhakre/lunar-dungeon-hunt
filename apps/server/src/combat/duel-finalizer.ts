import {
  TurnResolution,
  SuddenDeathOutcome,
  FighterCombatState,
  CombatLogEntry,
  cloneCombatState,
} from '@dungeon-hunt/game-rules';
import type { MutableMatchState, ActiveDuelState } from '../match/match.service';
import { DuelHistoryStore } from '../match/duel-history.store';
import { TieBreakService } from '../match/tie-break.service';

export interface FinalizeDuelParams {
  matchState: MutableMatchState;
  duelId: string;
  winner: 'A' | 'B';
  reason:
    | 'knockout'
    | 'turnLimitHP'
    | 'turnLimitShield'
    | 'tiebreakDigital'
    | 'suddenDeathKnockout'
    | 'suddenDeathHP'
    | 'suddenDeathShield'
    | 'suddenDeathDoubleKnockoutShield'
    | 'suddenDeathTiebreakDigital';
  finalStates: {
    nextStateA: FighterCombatState;
    nextStateB: FighterCombatState;
  };
  historyStore: DuelHistoryStore;
}

export interface FinalizeDuelResult {
  success: boolean;
  alreadyFinalized: boolean;
  winner: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  matchCompleted: boolean;
  reason?: string;
}

export function finalizeDuel(params: FinalizeDuelParams): FinalizeDuelResult {
  const { matchState, duelId, winner, reason, finalStates, historyStore } = params;
  const historyKey = `${matchState.id}:${matchState.runId}:${duelId}`;

  // 1. True Idempotency Guard (B4, P1.7): return cached result from injected store
  const existing = historyStore.get(historyKey);
  if (existing) {
    return { ...existing, alreadyFinalized: true };
  }

  // 2. Strict Precondition & Lifecycle Validation (H7)
  if (matchState.status !== 'dueling' && matchState.status !== 'suddenDeath') {
    throw new Error(`Cannot finalize duel when match status is "${matchState.status}"`);
  }
  const duelMatches = matchState.currentDuel.id === duelId || duelId === `duel-${matchState.currentDuelNumber}` || matchState.currentDuel.id.endsWith(duelId);
  if (!duelMatches) {
    throw new Error(`Duel ID mismatch: active=${matchState.currentDuel.id}, finalizing=${duelId}`);
  }
  if (matchState.scoreA >= 2 || matchState.scoreB >= 2) {
    throw new Error(`Invariant violation: series score already terminated (${matchState.scoreA}-${matchState.scoreB})`);
  }

  const activeDuel = matchState.currentDuel as ActiveDuelState;
  const fighterA = matchState.partyA.roster.find(f => f.fighterId === activeDuel.fighterIdA);
  const fighterB = matchState.partyB.roster.find(f => f.fighterId === activeDuel.fighterIdB);
  if (!fighterA || !fighterB) {
    throw new Error(`Fighter lookup failed for duel ${duelId}`);
  }
  if (fighterA.used || fighterB.used) {
    throw new Error(`Invariant violation: fighter already marked used prior to finalization`);
  }

  // 3. Commit Final Resolved Fighter States (B4)
  activeDuel.stateA = finalStates.nextStateA;
  activeDuel.stateB = finalStates.nextStateB;

  fighterA.used = true;
  fighterB.used = true;

  if (winner === 'A') matchState.scoreA += 1;
  else matchState.scoreB += 1;

  // 4. Terminal Audit Event & Historical Persistence (M12)
  matchState.auditLog.push({
    event: 'DUEL_COMPLETED',
    matchId: matchState.id,
    runId: matchState.runId,
    duelId,
    winner,
    reason,
    scoreA: matchState.scoreA,
    scoreB: matchState.scoreB,
    timestamp: new Date().toISOString(),
  });

  // P2.4: Deep clone final combat states to enforce absolute history immutability
  const deepFinalStateA = cloneCombatState(finalStates.nextStateA);
  const deepFinalStateB = cloneCombatState(finalStates.nextStateB);
  Object.freeze(deepFinalStateA);
  Object.freeze(deepFinalStateB);

  matchState.duelHistory = matchState.duelHistory ?? [];
  matchState.duelHistory.push({
    duelId,
    duelNumber: matchState.currentDuelNumber,
    fighterIdA: fighterA.fighterId,
    fighterIdB: fighterB.fighterId,
    roleIdA: fighterA.roleId,
    roleIdB: fighterB.roleId,
    finalStateA: deepFinalStateA,
    finalStateB: deepFinalStateB,
    winner,
    reason,
    resolvedTurns: activeDuel.resolvedTurns,
    completedAt: Date.now(),
  });

  // 5. Best of Three Match Invariant
  const matchCompleted = matchState.scoreA >= 2 || matchState.scoreB >= 2;

  if (matchCompleted) {
    matchState.status = 'completed';
    matchState.winningPartySide = matchState.scoreA >= 2 ? 'A' : 'B';
    matchState.currentDuel = {
      id: duelId,
      duelNumber: matchState.currentDuelNumber,
      status: 'completed',
      winner,
      reason,
      resolvedTurns: activeDuel.resolvedTurns,
      maxTurns: 6,
    };
  } else {
    // Initialize fresh currentDuel with PickingDuelState for next duel in Best-of-Three
    matchState.status = 'picking';
    matchState.currentDuelNumber += 1;
    matchState.selectionDeadlineAt = Date.now() + 25000;
    matchState.actionDeadlineAt = null;
    matchState.currentDuel = {
      id: `duel-${matchState.currentDuelNumber}`,
      duelNumber: matchState.currentDuelNumber,
      status: 'picking',
      lockedA: false,
      lockedB: false,
      selectedFighterIdA: null,
      selectedFighterIdB: null,
      resolvedTurns: 0,
      maxTurns: 6,
    };
  }

  const result: FinalizeDuelResult = {
    success: true,
    alreadyFinalized: false,
    winner,
    scoreA: matchState.scoreA,
    scoreB: matchState.scoreB,
    matchCompleted,
    reason,
  };

  historyStore.set(historyKey, Object.freeze({ ...result }));
  return result;
}

export type TurnCommitResult =
  | {
      type: 'continued';
      turnNumber: number;
      nextStateA: FighterCombatState;
      nextStateB: FighterCombatState;
      combatLog: CombatLogEntry[];
    }
  | {
      type: 'suddenDeathStarted';
      rollbackStateA: FighterCombatState;
      rollbackStateB: FighterCombatState;
    }
  | {
      type: 'duelCompleted';
      result: FinalizeDuelResult;
    };

export function handleNormalTurnResolution(
  matchState: MutableMatchState,
  resolution: TurnResolution,
  tieBreakService: TieBreakService,
  historyStore: DuelHistoryStore,
): TurnCommitResult {
  const { status, nextStateA, nextStateB } = resolution;
  const activeDuel = matchState.currentDuel as ActiveDuelState;

  switch (status.kind) {
    case 'continue': {
      activeDuel.stateA = nextStateA;
      activeDuel.stateB = nextStateB;
      activeDuel.resolvedTurns = resolution.resolvedTurnNumber;
      return {
        type: 'continued',
        turnNumber: resolution.resolvedTurnNumber,
        nextStateA,
        nextStateB,
        combatLog: resolution.combatLog,
      };
    }
    case 'duelComplete': {
      activeDuel.resolvedTurns = resolution.resolvedTurnNumber; // P1.7: Commit terminal turn count before adding history
      const result = finalizeDuel({
        matchState,
        duelId: activeDuel.id,
        winner: status.winner,
        reason: status.reason,
        finalStates: { nextStateA, nextStateB },
        historyStore,
      });
      return { type: 'duelCompleted', result };
    }
    case 'needsDigitalTieBreak': {
      activeDuel.resolvedTurns = resolution.resolvedTurnNumber; // P1.7: Commit terminal turn count before adding history
      const tieRecord = tieBreakService.resolveTieBreak(
        matchState.id,
        activeDuel.id,
        'turn_limit',
      );
      const result = finalizeDuel({
        matchState,
        duelId: activeDuel.id,
        winner: tieRecord.winner,
        reason: 'tiebreakDigital',
        finalStates: { nextStateA, nextStateB },
        historyStore,
      });
      return { type: 'duelCompleted', result };
    }
    case 'enterSuddenDeath': {
      // Lethal 0 HP states are NEVER committed to active state or broadcast as turn resolution
      activeDuel.resolvedTurns = resolution.resolvedTurnNumber; // P1.7: Update turn count before sudden death
      activeDuel.stateA = status.rollbackStateA;
      activeDuel.stateB = status.rollbackStateB;
      activeDuel.status = 'suddenDeath';
      matchState.status = 'suddenDeath';
      return {
        type: 'suddenDeathStarted',
        rollbackStateA: status.rollbackStateA,
        rollbackStateB: status.rollbackStateB,
      };
    }
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled turn status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function handleSuddenDeathResolution(
  matchState: MutableMatchState,
  outcome: SuddenDeathOutcome,
  tieBreakService: TieBreakService,
  historyStore: DuelHistoryStore,
): FinalizeDuelResult {
  const activeDuel = matchState.currentDuel as ActiveDuelState;
  const duelId = activeDuel.id;
  const finalStates = { nextStateA: outcome.nextStateA, nextStateB: outcome.nextStateB };

  if (outcome.isComplete) {
    return finalizeDuel({
      matchState,
      duelId,
      winner: outcome.winner,
      reason: outcome.reason,
      finalStates,
      historyStore,
    });
  } else {
    const tieRecord = tieBreakService.resolveTieBreak(
      matchState.id,
      duelId,
      'sudden_death',
    );
    return finalizeDuel({
      matchState,
      duelId,
      winner: tieRecord.winner,
      reason: 'suddenDeathTiebreakDigital',
      finalStates,
      historyStore,
    });
  }
}
