import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as crypto from 'crypto';
import {
  ROLES,
  ActionType,
  RoleDefinition,
  CombatAction,
  SuddenDeathAction,
  FighterCombatState,
  DEFAULT_SELECTION_MS,
  DEFAULT_ACTION_MS,
  resolveTurn,
  resolveSuddenDeath,
} from '@dungeon-hunt/game-rules';
import type {
  PublicMatchSnapshot,
  PrivatePartySnapshot,
  PublicFighter,
} from '@dungeon-hunt/shared-contracts';
import { DuelHistoryStore } from './duel-history.store';
import { TieBreakService } from './tie-break.service';
import { AuthService } from '../auth/auth.service';
import {
  handleNormalTurnResolution,
  handleSuddenDeathResolution,
  TurnCommitResult,
  FinalizeDuelResult,
} from '../combat/duel-finalizer';

export interface RosterMember {
  fighterId: string;
  roleId: string;
  used: boolean;
}

export interface PickingDuelState {
  id: string;
  duelNumber: number;
  status: 'picking';
  lockedA: boolean;
  lockedB: boolean;
  selectedFighterIdA: string | null;
  selectedFighterIdB: string | null;
  fighterIdA?: string;
  fighterIdB?: string;
  resolvedTurns: 0;
  maxTurns: 6;
}

export interface ActiveDuelState {
  id: string;
  duelNumber: number;
  status: 'dueling' | 'suddenDeath';
  lockedA: true;
  lockedB: true;
  fighterIdA: string;
  fighterIdB: string;
  roleA: RoleDefinition;
  roleB: RoleDefinition;
  stateA: FighterCombatState;
  stateB: FighterCombatState;
  resolvedTurns: number;
  maxTurns: 6;
  actionsA: Map<number, CombatAction>;
  actionsB: Map<number, CombatAction>;
  suddenDeathActionA?: SuddenDeathAction;
  suddenDeathActionB?: SuddenDeathAction;
}

export interface CompletedDuelState {
  id: string;
  duelNumber: number;
  status: 'completed';
  winner: 'A' | 'B';
  reason: string;
  resolvedTurns: number;
  maxTurns: 6;
}

export type DuelLifecycleState = PickingDuelState | ActiveDuelState | CompletedDuelState;

export interface DuelHistoryEntry {
  duelId: string;
  duelNumber: number;
  fighterIdA: string;
  fighterIdB: string;
  roleIdA: string;
  roleIdB: string;
  finalStateA: FighterCombatState;
  finalStateB: FighterCombatState;
  winner: 'A' | 'B';
  reason: string;
  resolvedTurns: number;
  completedAt: number;
}

export interface MutableMatchState {
  id: string;
  runId: number;
  status: 'lobby' | 'picking' | 'dueling' | 'suddenDeath' | 'paused' | 'completed';
  scoreA: number;
  scoreB: number;
  currentDuelNumber: number;
  partyA: { id: string; name: string; roster: RosterMember[] };
  partyB: { id: string; name: string; roster: RosterMember[] };
  currentDuel: DuelLifecycleState;
  duelHistory: DuelHistoryEntry[];
  auditLog: Array<Record<string, unknown>>;
  selectionDeadlineAt?: number | null;
  actionDeadlineAt?: number | null;
  remainingSelectionMs?: number | null;
  remainingActionMs?: number | null;
  previousStatus?: 'picking' | 'dueling' | 'suddenDeath';
  pauseReason?: string;
  winningPartySide?: 'A' | 'B';
  winner?: 'A' | 'B';
}

const CANONICAL_ROLE_POOL = [
  'swordsman',
  'archer',
  'mage',
  'tank',
  'rogue',
  'assassin',
  'vanguard',
  'paladin',
] as const;

function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function draftDistinctLineups(): { rosterA: RosterMember[]; rosterB: RosterMember[] } {
  const pick5 = (): string[] => fisherYatesShuffle(CANONICAL_ROLE_POOL).slice(0, 5);

  const rolesA = pick5();
  let rolesB = pick5();
  let attempts = 0;

  while ([...rolesA].sort().join(',') === [...rolesB].sort().join(',') && attempts < 10) {
    rolesB = pick5();
    attempts++;
  }

  if ([...rolesA].sort().join(',') === [...rolesB].sort().join(',')) {
    const unused = CANONICAL_ROLE_POOL.filter(r => !rolesB.includes(r));
    if (unused.length > 0) {
      rolesB[4] = unused[0];
    }
  }

  const rosterA = rolesA.map(r => ({ fighterId: `fighter-A-${r}`, roleId: r, used: false }));
  const rosterB = rolesB.map(r => ({ fighterId: `fighter-B-${r}`, roleId: r, used: false }));
  return { rosterA, rosterB };
}

export interface MatchEventPublisher {
  emitToMatch(matchId: string, event: string, payload: unknown): void;
  emitToParty(matchId: string, partySide: 'A' | 'B', event: string, payload: unknown): void;
  broadcastSnapshots(matchId: string): void;
}

@Injectable()
export class MatchService implements OnModuleDestroy {
  onModuleDestroy(): void {
    // P2.8: Clear all pending match timers and retention timers on application shutdown
    for (const [, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    for (const [, timer] of this.retentionTimers) {
      clearTimeout(timer);
    }
    this.retentionTimers.clear();
  }
  private readonly matches = new Map<string, MutableMatchState>();
  private readonly seenCommands = new Map<string, { accepted: boolean; timestamp: number; payloadHash?: string; cachedOutcome?: unknown }>();
  private readonly stagedCommands = new Map<string, { keyA?: string; keyB?: string }>();
  private readonly activeTimers = new Map<string, NodeJS.Timeout>();
  private readonly matchQueues = new Map<string, Promise<unknown>>();
  private readonly retirementHooks: Array<(matchId: string) => void> = [];
  private eventPublisher: MatchEventPublisher | null = null;

  constructor(
    private readonly duelHistoryStore: DuelHistoryStore,
    private readonly tieBreakService: TieBreakService,
    private readonly authService: AuthService,
  ) {}

  setEventPublisher(publisher: MatchEventPublisher): void {
    this.eventPublisher = publisher;
  }

  /**
   * Per-match serialized transaction boundary queue (P0.7, P1.6).
   * Ensures all incoming actions, timeouts, host controls, and state transitions execute atomically.
   */
  async runMatchTransition<T>(matchId: string, operation: () => Promise<T> | T): Promise<T> {
    const currentQueue = this.matchQueues.get(matchId) ?? Promise.resolve();
    let release: () => void;
    const nextQueue = new Promise<void>(resolve => { release = resolve; });
    this.matchQueues.set(matchId, currentQueue.then(() => nextQueue));

    await currentQueue;
    try {
      return await operation();
    } finally {
      release!();
    }
  }

  clearTimer(matchId: string): void {
    const timer = this.activeTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(matchId);
    }
  }

  // P1.3, P1.4: Centralized terminal match cleanup and retention scheduling
  completeMatch(match: MutableMatchState, winner: 'A' | 'B'): void {
    match.status = 'completed';
    match.winner = winner;
    match.actionDeadlineAt = null;
    match.selectionDeadlineAt = null;
    match.remainingActionMs = null;
    match.remainingSelectionMs = null;
    this.clearTimer(match.id);
    this.scheduleRetention(match.id);
  }

  // P1.3: Production retention scheduler for completed matches (1 hour retention TTL)
  private readonly retentionTimers = new Map<string, NodeJS.Timeout>();
  scheduleRetention(matchId: string, retentionMs = 60 * 60 * 1000): void {
    this.clearRetentionTimer(matchId);
    const timer = setTimeout(async () => {
      await this.retireMatch(matchId);
    }, retentionMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.retentionTimers.set(matchId, timer);
  }

  clearRetentionTimer(matchId: string): void {
    const timer = this.retentionTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.retentionTimers.delete(matchId);
    }
  }

  // P1.1, P2.4: Centralized transition helpers ensuring normalized deadline invariants
  transitionToPicking(match: MutableMatchState, onTimeout?: () => void): void {
    match.status = 'picking';
    match.selectionDeadlineAt = Date.now() + DEFAULT_SELECTION_MS;
    match.actionDeadlineAt = null;
    this.clearTimer(match.id);
    this.armSelectionTimer(match.id, DEFAULT_SELECTION_MS, onTimeout);
  }

  transitionToDueling(
    match: MutableMatchState,
    onActionTimeout?: (result: TurnCommitResult | FinalizeDuelResult) => void,
  ): { publicFighterA: PublicFighter; publicFighterB: PublicFighter } {
    const duel = match.currentDuel as PickingDuelState;
    const fA = match.partyA.roster.find(f => f.fighterId === duel.fighterIdA)!;
    const fB = match.partyB.roster.find(f => f.fighterId === duel.fighterIdB)!;
    const roleA = ROLES[fA.roleId];
    const roleB = ROLES[fB.roleId];

    const activeDuel: ActiveDuelState = {
      id: duel.id,
      duelNumber: duel.duelNumber,
      status: 'dueling',
      lockedA: true,
      lockedB: true,
      fighterIdA: fA.fighterId,
      fighterIdB: fB.fighterId,
      roleA,
      roleB,
      stateA: {
        fighterId: fA.fighterId,
        roleId: roleA.id,
        currentHp: roleA.maxHp,
        currentShield: 0,
        skillUsesRemaining: roleA.skill.usesPerDuel,
        statusEffects: [],
      },
      stateB: {
        fighterId: fB.fighterId,
        roleId: roleB.id,
        currentHp: roleB.maxHp,
        currentShield: 0,
        skillUsesRemaining: roleB.skill.usesPerDuel,
        statusEffects: [],
      },
      resolvedTurns: 0,
      maxTurns: 6,
      actionsA: new Map(),
      actionsB: new Map(),
    };

    match.currentDuel = activeDuel;
    match.status = 'dueling';
    this.clearTimer(match.id);
    match.selectionDeadlineAt = null;
    match.actionDeadlineAt = Date.now() + DEFAULT_ACTION_MS;
    this.armActionTimer(match.id, DEFAULT_ACTION_MS, onActionTimeout);

    return {
      publicFighterA: {
        id: fA.fighterId,
        roleId: roleA.id,
        maxHp: roleA.maxHp,
        currentHp: roleA.maxHp,
        currentShield: 0,
      },
      publicFighterB: {
        id: fB.fighterId,
        roleId: roleB.id,
        maxHp: roleB.maxHp,
        currentHp: roleB.maxHp,
        currentShield: 0,
      },
    };
  }

  advanceToNextTurn(
    match: MutableMatchState,
    onActionTimeout?: (result: TurnCommitResult | FinalizeDuelResult) => void,
  ): void {
    match.actionDeadlineAt = Date.now() + DEFAULT_ACTION_MS;
    this.clearTimer(match.id);
    this.armActionTimer(match.id, DEFAULT_ACTION_MS, onActionTimeout);
  }

  transitionToSuddenDeath(
    match: MutableMatchState,
    onActionTimeout?: (result: TurnCommitResult | FinalizeDuelResult) => void,
  ): void {
    match.status = 'suddenDeath';
    match.selectionDeadlineAt = null;
    match.actionDeadlineAt = Date.now() + DEFAULT_ACTION_MS;
    this.clearTimer(match.id);
    this.armActionTimer(match.id, DEFAULT_ACTION_MS, onActionTimeout);
  }

  // P0.4, P0.7, P1.1: Authoritative selection timeout execution with deadline re-check and event emission
  armSelectionTimer(matchId: string, durationMs = DEFAULT_SELECTION_MS, onTimeout?: () => void): void {
    this.clearTimer(matchId);
    const timer = setTimeout(async () => {
      await this.runMatchTransition(matchId, () => {
        const match = this.matches.get(matchId);
        if (!match || match.status !== 'picking' || match.currentDuel.status !== 'picking') return;
        // P1.1: Re-check deadline inside serialized transition
        if (match.selectionDeadlineAt && Date.now() < match.selectionDeadlineAt - 50) return;

        const duel = match.currentDuel;
        // P2.2: Sort unused roster candidates by canonical pool index (0..7) to enforce "lowest-indexed role" invariant
        const sortUnusedByPoolIndex = (roster: RosterMember[]) => {
          return roster
            .filter(f => !f.used)
            .sort((a, b) => (CANONICAL_ROLE_POOL as readonly string[]).indexOf(a.roleId) - (CANONICAL_ROLE_POOL as readonly string[]).indexOf(b.roleId));
        };

        if (!duel.lockedA) {
          const availA = sortUnusedByPoolIndex(match.partyA.roster)[0];
          if (availA) {
            duel.lockedA = true;
            duel.fighterIdA = availA.fighterId;
            duel.selectedFighterIdA = availA.fighterId;
          }
        }
        if (!duel.lockedB) {
          const availB = sortUnusedByPoolIndex(match.partyB.roster)[0];
          if (availB) {
            duel.lockedB = true;
            duel.fighterIdB = availB.fighterId;
            duel.selectedFighterIdB = availB.fighterId;
          }
        }
        const revealed = this.transitionToDueling(match);
        // P0.3, P0.4: Integrate timeout state change with client notifications using strictly schema-compliant payload
        if (this.eventPublisher) {
          this.eventPublisher.emitToMatch(matchId, 'duel:fightersRevealed', {
            fighterA: revealed.publicFighterA,
            fighterB: revealed.publicFighterB,
          });
          this.eventPublisher.broadcastSnapshots(matchId);
        }
        if (onTimeout) onTimeout();
      });
    }, durationMs);
    this.activeTimers.set(matchId, timer);
  }

  // P0.4, P0.7, P1.1: Authoritative action & sudden death timeout execution with guard fallback and event emission
  armActionTimer(
    matchId: string,
    durationMs = DEFAULT_ACTION_MS,
    onTimeout?: (result: TurnCommitResult | FinalizeDuelResult) => void,
  ): void {
    this.clearTimer(matchId);
    const timer = setTimeout(async () => {
      await this.runMatchTransition(matchId, () => {
        const match = this.matches.get(matchId);
        if (!match) return;

        if (match.status === 'dueling' && match.currentDuel.status === 'dueling') {
          // P1.1: Re-check action deadline inside serialized transition
          if (match.actionDeadlineAt && Date.now() < match.actionDeadlineAt - 50) return;

          const duel = match.currentDuel as ActiveDuelState;
          const activeTurn = duel.resolvedTurns + 1;

          // §0.8, P0.7: Action fallback default on timeout is GUARD (not strike)
          if (!duel.actionsA.has(activeTurn)) {
            duel.actionsA.set(activeTurn, { actionType: 'guard' });
          }
          if (!duel.actionsB.has(activeTurn)) {
            duel.actionsB.set(activeTurn, { actionType: 'guard' });
          }

          // Authoritatively resolve and commit the turn
          const resolution = resolveTurn(duel, duel.actionsA.get(activeTurn)!, duel.actionsB.get(activeTurn)!);
          const commitResult = handleNormalTurnResolution(match, resolution, this.tieBreakService, this.duelHistoryStore);

          if (commitResult.type === 'continued') {
            this.advanceToNextTurn(match, onTimeout);
            if (this.eventPublisher) {
              this.eventPublisher.emitToMatch(matchId, 'duel:turnResolved', {
                turnNumber: commitResult.turnNumber,
                stateA: {
                  id: duel.fighterIdA,
                  roleId: duel.roleA.id,
                  maxHp: duel.roleA.maxHp,
                  currentHp: commitResult.nextStateA.currentHp,
                  currentShield: commitResult.nextStateA.currentShield,
                },
                stateB: {
                  id: duel.fighterIdB,
                  roleId: duel.roleB.id,
                  maxHp: duel.roleB.maxHp,
                  currentHp: commitResult.nextStateB.currentHp,
                  currentShield: commitResult.nextStateB.currentShield,
                },
                combatLog: commitResult.combatLog,
              });
              this.eventPublisher.broadcastSnapshots(matchId);
            }
          } else if (commitResult.type === 'suddenDeathStarted') {
            this.transitionToSuddenDeath(match, onTimeout);
            if (this.eventPublisher) {
              this.eventPublisher.emitToMatch(matchId, 'duel:suddenDeathStarted', {
                fighterA: {
                  id: duel.fighterIdA,
                  roleId: duel.roleA.id,
                  maxHp: duel.roleA.maxHp,
                  currentHp: commitResult.rollbackStateA.currentHp,
                  currentShield: commitResult.rollbackStateA.currentShield,
                },
                fighterB: {
                  id: duel.fighterIdB,
                  roleId: duel.roleB.id,
                  maxHp: duel.roleB.maxHp,
                  currentHp: commitResult.rollbackStateB.currentHp,
                  currentShield: commitResult.rollbackStateB.currentShield,
                },
              });
              this.eventPublisher.broadcastSnapshots(matchId);
            }
          } else if (commitResult.type === 'duelCompleted') {
            if (this.eventPublisher) {
              this.eventPublisher.emitToMatch(matchId, 'duel:completed', {
                winnerPartySide: commitResult.result.winner,
                reason: commitResult.result.reason ?? 'normalDecisive',
                scoreA: commitResult.result.scoreA,
                scoreB: commitResult.result.scoreB,
              });
              if (commitResult.result.matchCompleted) {
                this.eventPublisher.emitToMatch(matchId, 'match:completed', {
                  winningPartySide: commitResult.result.winner,
                  finalScoreA: commitResult.result.scoreA,
                  finalScoreB: commitResult.result.scoreB,
                });
              }
              this.eventPublisher.broadcastSnapshots(matchId);
            }
            if (!commitResult.result.matchCompleted) {
              this.transitionToPicking(match);
            }
          }

          if (onTimeout) onTimeout(commitResult);
        } else if (match.status === 'suddenDeath' && match.currentDuel.status === 'suddenDeath') {
          // P1.1: Re-check sudden death action deadline inside serialized transition
          if (match.actionDeadlineAt && Date.now() < match.actionDeadlineAt - 50) return;

          const duel = match.currentDuel as ActiveDuelState;

          // §0.8, P0.7: Sudden death fallback default on timeout is GUARD
          if (!duel.suddenDeathActionA) {
            duel.suddenDeathActionA = { actionType: 'guard' };
          }
          if (!duel.suddenDeathActionB) {
            duel.suddenDeathActionB = { actionType: 'guard' };
          }

          const outcome = resolveSuddenDeath(
            duel.roleA,
            duel.roleB,
            duel.fighterIdA,
            duel.fighterIdB,
            duel.stateA,
            duel.stateB,
            duel.suddenDeathActionA,
            duel.suddenDeathActionB,
          );

          const finalResult = handleSuddenDeathResolution(match, outcome, this.tieBreakService, this.duelHistoryStore);
          if (this.eventPublisher) {
            this.eventPublisher.emitToMatch(matchId, 'duel:completed', {
              winnerPartySide: finalResult.winner,
              reason: finalResult.reason ?? 'suddenDeathDecisive',
              scoreA: finalResult.scoreA,
              scoreB: finalResult.scoreB,
            });
            if (finalResult.matchCompleted) {
              this.eventPublisher.emitToMatch(matchId, 'match:completed', {
                winningPartySide: finalResult.winner,
                finalScoreA: finalResult.scoreA,
                finalScoreB: finalResult.scoreB,
              });
            }
            this.eventPublisher.broadcastSnapshots(matchId);
          }

          if (!finalResult.matchCompleted) {
            this.transitionToPicking(match);
          }

          if (onTimeout) onTimeout(finalResult);
        }
      });
    }, durationMs);
    this.activeTimers.set(matchId, timer);
  }

  createMatch(params: {
    matchId: string;
    partyAName: string;
    partyBName: string;
    rosterRolesA?: string[];
    rosterRolesB?: string[];
  }): MutableMatchState {
    const { matchId, partyAName, partyBName, rosterRolesA, rosterRolesB } = params;

    let rosterA: RosterMember[];
    let rosterB: RosterMember[];

    if (rosterRolesA && rosterRolesB) {
      if (rosterRolesA.length !== 5 || rosterRolesB.length !== 5) {
        throw new WsException({ code: 'INVALID_ROSTER', message: 'Each party must have exactly 5 fighters' });
      }
      if (new Set(rosterRolesA).size !== 5 || new Set(rosterRolesB).size !== 5) {
        throw new WsException({ code: 'INVALID_ROSTER', message: 'Duplicate roles within a party roster are prohibited' });
      }
      for (const role of [...rosterRolesA, ...rosterRolesB]) {
        if (!ROLES[role]) {
          throw new WsException({ code: 'INVALID_ROLE', message: `Unknown role: ${role}` });
        }
      }
      rosterA = rosterRolesA.map(r => ({ fighterId: `fighter-A-${r}`, roleId: r, used: false }));
      rosterB = rosterRolesB.map(r => ({ fighterId: `fighter-B-${r}`, roleId: r, used: false }));
    } else {
      const drafted = draftDistinctLineups();
      rosterA = drafted.rosterA;
      rosterB = drafted.rosterB;
    }

    const initialDuelId = 'duel-1';
    const matchState: MutableMatchState = {
      id: matchId,
      runId: 1,
      status: 'lobby',
      scoreA: 0,
      scoreB: 0,
      currentDuelNumber: 1,
      partyA: { id: `partyA-${partyAName}`, name: partyAName, roster: rosterA },
      partyB: { id: `partyB-${partyBName}`, name: partyBName, roster: rosterB },
      currentDuel: {
        id: initialDuelId,
        duelNumber: 1,
        status: 'picking',
        lockedA: false,
        lockedB: false,
        selectedFighterIdA: null,
        selectedFighterIdB: null,
        resolvedTurns: 0,
        maxTurns: 6,
      },
      duelHistory: [],
      auditLog: [{
        event: 'MATCH_CREATED',
        matchId,
        runId: 1,
        partyAName,
        partyBName,
        timestamp: new Date().toISOString(),
      }],
    };

    this.matches.set(matchId, matchState);
    return matchState;
  }

  getMatch(matchId: string): MutableMatchState {
    const match = this.matches.get(matchId);
    if (!match) {
      throw new WsException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} not found` });
    }
    return match;
  }

  getLatestMatch(): MutableMatchState | null {
    if (this.matches.size === 0) return null;
    const allMatches = Array.from(this.matches.values());
    return allMatches[allMatches.length - 1];
  }

  getPublicSnapshot(matchId: string): PublicMatchSnapshot {
    const match = this.getMatch(matchId);
    const duel = match.currentDuel;
    const currentTurn = (duel.status === 'dueling' || duel.status === 'suddenDeath')
      ? duel.resolvedTurns + 1
      : null;

    let activeFighterA: PublicFighter | null = null;
    let activeFighterB: PublicFighter | null = null;
    if (duel.status === 'dueling' || duel.status === 'suddenDeath') {
      activeFighterA = {
        id: duel.fighterIdA,
        roleId: duel.roleA.id,
        maxHp: duel.roleA.maxHp,
        currentHp: duel.stateA.currentHp,
        currentShield: duel.stateA.currentShield,
      };
      activeFighterB = {
        id: duel.fighterIdB,
        roleId: duel.roleB.id,
        maxHp: duel.roleB.maxHp,
        currentHp: duel.stateB.currentHp,
        currentShield: duel.stateB.currentShield,
      };
    }

    return {
      matchId: match.id,
      status: match.status,
      partyAName: match.partyA.name,
      partyBName: match.partyB.name,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      currentDuelNumber: match.currentDuelNumber,
      currentTurnNumber: currentTurn,
      selectionDeadlineAt: match.selectionDeadlineAt ?? null,
      actionDeadlineAt: match.actionDeadlineAt ?? null,
      lockedPartyA: duel.status === 'picking' ? duel.lockedA : true,
      lockedPartyB: duel.status === 'picking' ? duel.lockedB : true,
      pauseReason: match.pauseReason,
      rosterA: match.partyA.roster.map(f => ({ fighterId: f.fighterId, roleId: f.roleId, used: f.used })),
      rosterB: match.partyB.roster.map(f => ({ fighterId: f.fighterId, roleId: f.roleId, used: f.used })),
      activeFighterA,
      activeFighterB,
    };
  }

  getPrivatePartySnapshot(matchId: string, partySide: 'A' | 'B'): PrivatePartySnapshot {
    const match = this.getMatch(matchId);
    const party = partySide === 'A' ? match.partyA : match.partyB;
    const duel = match.currentDuel;

    let isLocked = false;
    let selectedFighterId: string | null = null;
    let selectedAction: ActionType | null = null;
    let actionLocked = false;
    let selectedSuddenDeathAction: 'strike' | 'guard' | null = null;
    let suddenDeathActionLocked = false;

    if (duel.status === 'picking') {
      isLocked = partySide === 'A' ? duel.lockedA : duel.lockedB;
      selectedFighterId = partySide === 'A' ? duel.selectedFighterIdA : duel.selectedFighterIdB;
    } else if (duel.status === 'dueling') {
      isLocked = true;
      selectedFighterId = partySide === 'A' ? duel.fighterIdA : duel.fighterIdB;
      const activeTurn = duel.resolvedTurns + 1;
      const actionsMap = partySide === 'A' ? duel.actionsA : duel.actionsB;
      const action = actionsMap.get(activeTurn);
      selectedAction = action ? action.actionType : null;
      actionLocked = !!action;
    } else if (duel.status === 'suddenDeath') {
      isLocked = true;
      selectedFighterId = partySide === 'A' ? duel.fighterIdA : duel.fighterIdB;
      const sdAction = partySide === 'A' ? duel.suddenDeathActionA : duel.suddenDeathActionB;
      selectedSuddenDeathAction = sdAction ? sdAction.actionType : null;
      suddenDeathActionLocked = !!sdAction;
    }

    return {
      matchId: match.id,
      partyId: party.id,
      partySide,
      roster: party.roster.map(f => ({ fighterId: f.fighterId, roleId: f.roleId, used: f.used })),
      selectedFighterId,
      fighterLocked: isLocked,
      selectedAction,
      actionLocked,
      selectedSuddenDeathAction,
      suddenDeathActionLocked,
      selectionDeadlineAt: match.selectionDeadlineAt ?? null,
      actionDeadlineAt: match.actionDeadlineAt ?? null,
    };
  }

  selectFighter(matchId: string, partySide: 'A' | 'B', duelId: string, fighterId: string) {
    const match = this.getMatch(matchId);
    if (match.status !== 'picking' || match.currentDuel.status !== 'picking') {
      throw new WsException({ code: 'INVALID_PHASE', message: 'Fighter selection only allowed during active picking phase' });
    }
    // P1.1: Authoritative selection deadline check
    if (match.selectionDeadlineAt && Date.now() > match.selectionDeadlineAt) {
      throw new WsException({ code: 'SELECTION_TIMEOUT', message: 'Fighter selection deadline exceeded' });
    }
    const duel = match.currentDuel;
    const duelMatches = duel.id === duelId || duelId === `duel-${match.currentDuelNumber}` || duelId === `duel-${duel.duelNumber}` || duel.id.endsWith(duelId);
    if (!duelMatches) {
      throw new WsException({ code: 'DUEL_MISMATCH', message: 'Duel ID mismatch' });
    }
    if (partySide === 'A' && duel.lockedA) {
      throw new WsException({ code: 'ALREADY_LOCKED', message: 'Party A fighter is already locked' });
    }
    if (partySide === 'B' && duel.lockedB) {
      throw new WsException({ code: 'ALREADY_LOCKED', message: 'Party B fighter is already locked' });
    }

    const party = partySide === 'A' ? match.partyA : match.partyB;
    const fighter = party.roster.find(f => f.fighterId === fighterId);
    if (!fighter) {
      throw new WsException({ code: 'ROSTER_MISMATCH', message: `Fighter ${fighterId} not found in Party ${partySide} roster` });
    }
    if (fighter.used) {
      throw new WsException({ code: 'FIGHTER_USED', message: `Fighter ${fighterId} has already been used in this match` });
    }

    if (partySide === 'A') {
      duel.selectedFighterIdA = fighterId;
    } else {
      duel.selectedFighterIdB = fighterId;
    }

    return { success: true };
  }

  lockFighter(matchId: string, partySide: 'A' | 'B', duelId: string, fighterId: string) {
    const match = this.getMatch(matchId);
    if (match.status !== 'picking' || match.currentDuel.status !== 'picking') {
      throw new WsException({ code: 'INVALID_PHASE', message: 'Fighter lock only allowed during active picking phase' });
    }
    // P1.1: Authoritative selection deadline check
    if (match.selectionDeadlineAt && Date.now() > match.selectionDeadlineAt) {
      throw new WsException({ code: 'SELECTION_TIMEOUT', message: 'Fighter selection deadline exceeded' });
    }
    const duel = match.currentDuel;
    const duelMatches = duel.id === duelId || duelId === `duel-${match.currentDuelNumber}` || duelId === `duel-${duel.duelNumber}` || duel.id.endsWith(duelId);
    if (!duelMatches) {
      throw new WsException({ code: 'DUEL_MISMATCH', message: 'Duel ID mismatch' });
    }
    if (partySide === 'A' && duel.lockedA) {
      throw new WsException({ code: 'ALREADY_LOCKED', message: 'Party A already locked a fighter' });
    }
    if (partySide === 'B' && duel.lockedB) {
      throw new WsException({ code: 'ALREADY_LOCKED', message: 'Party B already locked a fighter' });
    }

    const party = partySide === 'A' ? match.partyA : match.partyB;
    const fighter = party.roster.find(f => f.fighterId === fighterId);
    if (!fighter) {
      throw new WsException({ code: 'ROSTER_MISMATCH', message: `Fighter ${fighterId} not in Party ${partySide} roster` });
    }
    if (fighter.used) {
      throw new WsException({ code: 'FIGHTER_USED', message: `Fighter ${fighterId} is already marked used` });
    }

    if (partySide === 'A') {
      duel.lockedA = true;
      duel.fighterIdA = fighterId;
    } else {
      duel.lockedB = true;
      duel.fighterIdB = fighterId;
    }

    let duelStarted = false;
    let publicFighterA: PublicFighter | null = null;
    let publicFighterB: PublicFighter | null = null;

    if (duel.lockedA && duel.lockedB && duel.fighterIdA && duel.fighterIdB) {
      const fighters = this.transitionToDueling(match);
      duelStarted = true;
      publicFighterA = fighters.publicFighterA;
      publicFighterB = fighters.publicFighterB;
    }

    return { success: true, duelStarted, fighterA: publicFighterA, fighterB: publicFighterB, match };
  }

  submitAction(
    matchId: string,
    partySide: 'A' | 'B',
    duelId: string,
    turnNumber: number,
    commandId: string,
    actionType: ActionType,
  ) {
    const match = this.getMatch(matchId);
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ actionType })).digest('hex');
    const idempotencyKey = `${matchId}:${match.runId}:${duelId}:t${turnNumber}:${partySide}:${commandId}`;

    // P1.1, P1.2: Check scoped idempotency BEFORE validating active duel/phase to allow safe terminal replay
    const cachedEntry = this.seenCommands.get(idempotencyKey);
    if (cachedEntry) {
      if (cachedEntry.payloadHash !== payloadHash) {
        throw new WsException({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message: 'Command ID reused with conflicting action payload' });
      }
      return {
        duplicate: true,
        bothLocked: true,
        cachedOutcome: cachedEntry.cachedOutcome,
        match,
        recordOutcome: () => {},
        rollback: () => {},
      };
    }

    if (match.status !== 'dueling' || match.currentDuel.status !== 'dueling') {
      throw new WsException({ code: 'INVALID_PHASE', message: 'Combat action only allowed during active dueling phase' });
    }

    const duel = match.currentDuel as ActiveDuelState;
    const duelMatches = duel.id === duelId || duelId === `duel-${match.currentDuelNumber}` || duelId === `duel-${duel.duelNumber}` || duel.id.endsWith(duelId);
    if (!duelMatches) {
      throw new WsException({ code: 'DUEL_MISMATCH', message: 'Duel ID mismatch' });
    }

    const expectedTurn = duel.resolvedTurns + 1;
    if (turnNumber !== expectedTurn) {
      throw new WsException({ code: 'TURN_MISMATCH', message: `Active turn is ${expectedTurn}, received ${turnNumber}` });
    }

    // P1.1: Authoritative action deadline check
    if (match.actionDeadlineAt && Date.now() > match.actionDeadlineAt) {
      throw new WsException({ code: 'ACTION_TIMEOUT', message: 'Action submission deadline exceeded' });
    }

    const actionsMap = partySide === 'A' ? duel.actionsA : duel.actionsB;
    if (actionsMap.has(turnNumber)) {
      throw new WsException({ code: 'ACTION_ALREADY_LOCKED', message: `Action already locked for turn ${turnNumber}` });
    }

    const state = partySide === 'A' ? duel.stateA : duel.stateB;
    if (actionType === 'skill' && state.skillUsesRemaining <= 0) {
      throw new WsException({ code: 'NO_SKILL_USES', message: 'No skill uses remaining for this fighter' });
    }

    // P0.5: Track staged commands per turn to enable atomic dual-peer rollback
    const turnStageKey = `${matchId}:${match.runId}:${duelId}:t${turnNumber}`;
    let staged = this.stagedCommands.get(turnStageKey);
    if (!staged) {
      staged = {};
      this.stagedCommands.set(turnStageKey, staged);
    }
    if (partySide === 'A') staged.keyA = idempotencyKey;
    else staged.keyB = idempotencyKey;

    this.seenCommands.set(idempotencyKey, { accepted: true, timestamp: Date.now(), payloadHash });
    actionsMap.set(turnNumber, { actionType });

    const hasA = duel.actionsA.has(turnNumber);
    const hasB = duel.actionsB.has(turnNumber);
    const bothLocked = hasA && hasB;

    return {
      duplicate: false,
      bothLocked,
      actionA: duel.actionsA.get(turnNumber)!,
      actionB: duel.actionsB.get(turnNumber)!,
      match,
      recordOutcome: (outcome: unknown) => {
        const entry = this.seenCommands.get(idempotencyKey);
        if (entry) entry.cachedOutcome = outcome;
        if (staged?.keyA) {
          const entryA = this.seenCommands.get(staged.keyA);
          if (entryA) entryA.cachedOutcome = outcome;
        }
        if (staged?.keyB) {
          const entryB = this.seenCommands.get(staged.keyB);
          if (entryB) entryB.cachedOutcome = outcome;
        }
        this.stagedCommands.delete(turnStageKey);
      },
      rollback: () => {
        // P0.5: Atomic dual-peer rollback deletes both sides' staged actions and idempotency records
        duel.actionsA.delete(turnNumber);
        duel.actionsB.delete(turnNumber);
        if (staged?.keyA) this.seenCommands.delete(staged.keyA);
        if (staged?.keyB) this.seenCommands.delete(staged.keyB);
        this.stagedCommands.delete(turnStageKey);
      },
    };
  }

  submitSuddenDeathAction(
    matchId: string,
    partySide: 'A' | 'B',
    duelId: string,
    commandId: string,
    actionType: 'strike' | 'guard',
  ) {
    const match = this.getMatch(matchId);
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ actionType })).digest('hex');
    const idempotencyKey = `${matchId}:${match.runId}:${duelId}:sd:${partySide}:${commandId}`;

    // P1.1, P1.2: Check scoped idempotency BEFORE validating active duel/phase to allow safe terminal replay
    const cachedEntry = this.seenCommands.get(idempotencyKey);
    if (cachedEntry) {
      if (cachedEntry.payloadHash !== payloadHash) {
        throw new WsException({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message: 'Command ID reused with conflicting action payload' });
      }
      return {
        duplicate: true,
        bothLocked: true,
        cachedOutcome: cachedEntry.cachedOutcome,
        match,
        recordOutcome: () => {},
        rollback: () => {},
      };
    }

    if (match.status !== 'suddenDeath' || match.currentDuel.status !== 'suddenDeath') {
      throw new WsException({ code: 'INVALID_PHASE', message: 'Sudden death action only allowed during suddenDeath phase' });
    }

    const duel = match.currentDuel as ActiveDuelState;
    const duelMatches = duel.id === duelId || duelId === `duel-${match.currentDuelNumber}` || duelId === `duel-${duel.duelNumber}` || duel.id.endsWith(duelId);
    if (!duelMatches) {
      throw new WsException({ code: 'DUEL_MISMATCH', message: 'Duel ID mismatch' });
    }

    // P1.1: Authoritative sudden death action deadline check
    if (match.actionDeadlineAt && Date.now() > match.actionDeadlineAt) {
      throw new WsException({ code: 'ACTION_TIMEOUT', message: 'Sudden death action deadline exceeded' });
    }

    if (partySide === 'A') {
      if (duel.suddenDeathActionA) {
        throw new WsException({ code: 'ACTION_ALREADY_LOCKED', message: 'Party A sudden death action already locked' });
      }
      duel.suddenDeathActionA = { actionType };
    } else {
      if (duel.suddenDeathActionB) {
        throw new WsException({ code: 'ACTION_ALREADY_LOCKED', message: 'Party B sudden death action already locked' });
      }
      duel.suddenDeathActionB = { actionType };
    }

    const sdStageKey = `${matchId}:${match.runId}:${duelId}:sd`;
    let staged = this.stagedCommands.get(sdStageKey);
    if (!staged) {
      staged = {};
      this.stagedCommands.set(sdStageKey, staged);
    }
    if (partySide === 'A') staged.keyA = idempotencyKey;
    else staged.keyB = idempotencyKey;

    this.seenCommands.set(idempotencyKey, { accepted: true, timestamp: Date.now(), payloadHash });

    const bothLocked = duel.suddenDeathActionA !== undefined && duel.suddenDeathActionB !== undefined;
    return {
      duplicate: false,
      bothLocked,
      actionA: duel.suddenDeathActionA!,
      actionB: duel.suddenDeathActionB!,
      match,
      recordOutcome: (outcome: unknown) => {
        const entry = this.seenCommands.get(idempotencyKey);
        if (entry) entry.cachedOutcome = outcome;
        if (staged?.keyA) {
          const entryA = this.seenCommands.get(staged.keyA);
          if (entryA) entryA.cachedOutcome = outcome;
        }
        if (staged?.keyB) {
          const entryB = this.seenCommands.get(staged.keyB);
          if (entryB) entryB.cachedOutcome = outcome;
        }
        this.stagedCommands.delete(sdStageKey);
      },
      rollback: () => {
        // P0.5: Atomic dual-peer rollback deletes both sides' staged sudden death actions and idempotency records
        delete duel.suddenDeathActionA;
        delete duel.suddenDeathActionB;
        if (staged?.keyA) this.seenCommands.delete(staged.keyA);
        if (staged?.keyB) this.seenCommands.delete(staged.keyB);
        this.stagedCommands.delete(sdStageKey);
      },
    };
  }

  startMatch(matchId: string) {
    const match = this.getMatch(matchId);
    if (match.status !== 'lobby') {
      throw new WsException({ code: 'INVALID_PHASE', message: `Cannot start match in status "${match.status}"` });
    }
    match.auditLog.push({
      event: 'MATCH_STARTED',
      matchId,
      runId: match.runId,
      timestamp: new Date().toISOString(),
    });
    this.transitionToPicking(match);
    return match;
  }

  pauseMatch(matchId: string, reason = 'Host paused match') {
    const match = this.getMatch(matchId);
    if (match.status === 'paused' || match.status === 'completed' || match.status === 'lobby') {
      throw new WsException({ code: 'INVALID_PHASE', message: `Cannot pause match in status "${match.status}"` });
    }
    this.clearTimer(matchId);

    // P1.1, P2.4: Preserve remaining duration across pause
    const now = Date.now();
    if (match.selectionDeadlineAt) {
      match.remainingSelectionMs = Math.max(0, match.selectionDeadlineAt - now);
      match.selectionDeadlineAt = null;
    }
    if (match.actionDeadlineAt) {
      match.remainingActionMs = Math.max(0, match.actionDeadlineAt - now);
      match.actionDeadlineAt = null;
    }

    match.previousStatus = match.status;
    match.status = 'paused';
    match.pauseReason = reason;

    match.auditLog.push({
      event: 'MATCH_PAUSED',
      matchId,
      runId: match.runId,
      reason,
      timestamp: new Date().toISOString(),
    });
    return match;
  }

  resumeMatch(matchId: string) {
    const match = this.getMatch(matchId);
    if (match.status !== 'paused') {
      throw new WsException({ code: 'INVALID_PHASE', message: 'Match is not paused' });
    }
    match.status = match.previousStatus ?? 'picking';

    // P1.1, P2.4: Restore deadlines from preserved duration and re-arm timers
    const now = Date.now();
    if (typeof match.remainingSelectionMs === 'number') {
      match.selectionDeadlineAt = now + match.remainingSelectionMs;
      this.armSelectionTimer(matchId, match.remainingSelectionMs);
      delete match.remainingSelectionMs;
    }
    if (typeof match.remainingActionMs === 'number') {
      match.actionDeadlineAt = now + match.remainingActionMs;
      this.armActionTimer(matchId, match.remainingActionMs);
      delete match.remainingActionMs;
    }

    delete match.previousStatus;
    delete match.pauseReason;

    match.auditLog.push({
      event: 'MATCH_RESUMED',
      matchId,
      runId: match.runId,
      timestamp: new Date().toISOString(),
    });
    return match;
  }

  resetMatch(matchId: string, reason: string): { match: MutableMatchState; tokens: { host: string; partyA: string; partyB: string; arena: string } } {
    const match = this.getMatch(matchId);
    this.clearTimer(matchId);
    match.runId += 1;

    // Purge completed duels for this match from history store (P1.7)
    this.duelHistoryStore.purgeMatchHistory(matchId);
    // P1.3: Clean match-scoped tie-break records on reset
    this.tieBreakService.clearMatch(matchId);

    // Bounded cleanup: clear seen commands and staged commands for this match (H5, P0.5)
    for (const key of this.seenCommands.keys()) {
      if (key.startsWith(`${matchId}:`)) {
        this.seenCommands.delete(key);
      }
    }
    for (const key of this.stagedCommands.keys()) {
      if (key.startsWith(`${matchId}:`)) {
        this.stagedCommands.delete(key);
      }
    }

    match.status = 'lobby';
    match.scoreA = 0;
    match.scoreB = 0;
    match.currentDuelNumber = 1;
    match.partyA.roster.forEach(f => { f.used = false; });
    match.partyB.roster.forEach(f => { f.used = false; });
    match.duelHistory = [];
    match.selectionDeadlineAt = null;
    match.actionDeadlineAt = null;
    delete match.remainingSelectionMs;
    delete match.remainingActionMs;
    delete match.previousStatus;
    delete match.pauseReason;
    delete match.winningPartySide;

    match.currentDuel = {
      id: crypto.randomUUID(),
      duelNumber: 1,
      status: 'picking',
      lockedA: false,
      lockedB: false,
      selectedFighterIdA: null,
      selectedFighterIdB: null,
      resolvedTurns: 0,
      maxTurns: 6,
    };

    match.auditLog.push({
      event: 'MATCH_RESET',
      matchId,
      runId: match.runId,
      reason,
      timestamp: new Date().toISOString(),
    });

    // P1.3: Generate rotated replacement tokens bound to the new numeric runId
    const tokens = {
      host: this.authService.generateToken({ matchId, runId: match.runId, userId: 'host-desk', role: 'host' }),
      partyA: this.authService.generateToken({ matchId, runId: match.runId, userId: match.partyA.id, role: 'party', partySide: 'A' }),
      partyB: this.authService.generateToken({ matchId, runId: match.runId, userId: match.partyB.id, role: 'party', partySide: 'B' }),
      arena: this.authService.generateToken({ matchId, runId: match.runId, userId: 'arena-display', role: 'arena' }),
    };

    return { match, tokens };
  }

  overrideMatch(
    matchId: string,
    operation: 'forcePhase' | 'forceNextDuel' | 'declareDuelWinner',
    reason: string,
    hostId: string,
    winnerSide?: 'A' | 'B',
  ): MutableMatchState {
    const match = this.getMatch(matchId);
    const previousStatus = match.status;

    match.auditLog.push({
      event: 'HOST_OVERRIDE',
      matchId,
      operation,
      reason,
      hostId,
      winnerSide,
      previousStatus,
      runId: match.runId,
      timestamp: new Date().toISOString(),
    });

    if (operation === 'declareDuelWinner' && winnerSide) {
      this.clearTimer(matchId);
      if (winnerSide === 'A') {
        match.scoreA += 1;
      } else {
        match.scoreB += 1;
      }

      const matchCompleted = match.scoreA >= 2 || match.scoreB >= 2 || match.currentDuelNumber >= 3;
      if (matchCompleted) {
        const winner = match.scoreA > match.scoreB ? 'A' : 'B';
        this.completeMatch(match, winner);
      } else {
        match.currentDuelNumber += 1;
        this.transitionToPicking(match);
      }
    } else if (operation === 'forceNextDuel') {
      if (match.status !== 'completed' && match.currentDuelNumber < 3) {
        this.clearTimer(matchId);
        match.currentDuelNumber += 1;
        this.transitionToPicking(match);
      }
    }

    return match;
  }

  // P1.8: Register match retirement hooks (e.g. controller idempotency cache purge)
  registerRetirementHook(hook: (matchId: string) => void): void {
    this.retirementHooks.push(hook);
  }

  /**
   * Complete memory retirement of match and all transient state (P1.3, P1.8).
   * Serialized through runMatchTransition before releasing match queue so active transitions cannot race.
   */
  async retireMatch(matchId: string): Promise<void> {
    await this.runMatchTransition(matchId, () => {
      this.clearTimer(matchId);
      this.matches.delete(matchId);
      for (const key of this.seenCommands.keys()) {
        if (key.startsWith(`${matchId}:`)) {
          this.seenCommands.delete(key);
        }
      }
      for (const key of this.stagedCommands.keys()) {
        if (key.startsWith(`${matchId}:`)) {
          this.stagedCommands.delete(key);
        }
      }
      this.duelHistoryStore.purgeMatchHistory(matchId);
      this.tieBreakService.clearMatch(matchId);

      // Invoke registered cache and state purgers
      for (const hook of this.retirementHooks) {
        hook(matchId);
      }
    });
    this.matchQueues.delete(matchId);
  }
}
