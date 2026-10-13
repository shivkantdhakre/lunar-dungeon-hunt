import type { RoleDefinition, FighterCombatState } from './types';
import { ROLES } from './roles';
import { createFighterCombatState } from './fighter-state';

export interface RosterFighter {
  fighterId: string;
  roleId: string;
  used: boolean;
}

export interface PartyRoster {
  partyId: string;
  partyName: string;
  fighters: RosterFighter[];
}

export interface DuelRecord {
  duelNumber: number;
  fighterIdA: string;
  fighterIdB: string;
  roleIdA: string;
  roleIdB: string;
  winner: 'A' | 'B';
  reason: string;
  scoreAfterDuelA: number;
  scoreAfterDuelB: number;
}

export interface SeriesState {
  seriesId: string;
  status: 'picking' | 'dueling' | 'completed';
  scoreA: number;
  scoreB: number;
  currentDuelNumber: 1 | 2 | 3;
  readonly targetWins: 2;
  partyA: PartyRoster;
  partyB: PartyRoster;
  duelHistory: DuelRecord[];
  winner?: 'A' | 'B';
}

export interface StartDuelResult {
  duelNumber: number;
  fighterA: FighterCombatState;
  fighterB: FighterCombatState;
  roleA: RoleDefinition;
  roleB: RoleDefinition;
}

export interface CompleteDuelResult {
  seriesCompleted: boolean;
  winner?: 'A' | 'B';
  finalScoreA: number;
  finalScoreB: number;
  nextDuelNumber?: 2 | 3;
}

/**
 * Creates and initializes a Best-of-Three series between two parties.
 */
export function createSeries(
  seriesId: string,
  partyAName: string,
  partyBName: string,
  rosterA: Array<{ fighterId: string; roleId: string }>,
  rosterB: Array<{ fighterId: string; roleId: string }>,
): SeriesState {
  if (rosterA.length !== 5) {
    throw new Error(`Party A must have exactly 5 fighters; received ${rosterA.length}`);
  }
  if (rosterB.length !== 5) {
    throw new Error(`Party B must have exactly 5 fighters; received ${rosterB.length}`);
  }

  // Validate distinct roles within each roster
  const rolesA = new Set(rosterA.map((f) => f.roleId));
  if (rolesA.size !== 5) {
    throw new Error('Party A roster contains duplicate roles; all 5 roles must be distinct');
  }
  const rolesB = new Set(rosterB.map((f) => f.roleId));
  if (rolesB.size !== 5) {
    throw new Error('Party B roster contains duplicate roles; all 5 roles must be distinct');
  }

  // Validate role existence
  for (const f of [...rosterA, ...rosterB]) {
    if (!ROLES[f.roleId]) {
      throw new Error(`Invalid roleId: "${f.roleId}"`);
    }
  }

  return {
    seriesId,
    status: 'picking',
    scoreA: 0,
    scoreB: 0,
    currentDuelNumber: 1,
    targetWins: 2,
    partyA: {
      partyId: 'party-A',
      partyName: partyAName,
      fighters: rosterA.map((f) => ({ ...f, used: false })),
    },
    partyB: {
      partyId: 'party-B',
      partyName: partyBName,
      fighters: rosterB.map((f) => ({ ...f, used: false })),
    },
    duelHistory: [],
  };
}

/**
 * Validates that a fighter is eligible to be picked by their party.
 */
export function validateFighterSelection(
  series: SeriesState,
  partySide: 'A' | 'B',
  fighterId: string,
): RosterFighter {
  if (series.status === 'completed') {
    throw new Error('Cannot select fighter: series has already completed');
  }

  const party = partySide === 'A' ? series.partyA : series.partyB;
  const fighter = party.fighters.find((f) => f.fighterId === fighterId);

  if (!fighter) {
    throw new Error(`Fighter "${fighterId}" not found in Party ${partySide} roster`);
  }

  if (fighter.used) {
    throw new Error(`Fighter "${fighterId}" has already been used in this series`);
  }

  return fighter;
}

/**
 * Commits fighter selections and starts a duel in the series.
 */
export function startSeriesDuel(
  series: SeriesState,
  fighterIdA: string,
  fighterIdB: string,
): StartDuelResult {
  if (series.status === 'completed') {
    throw new Error('Cannot start duel: series has already completed');
  }
  if (series.status === 'dueling') {
    throw new Error('Cannot start duel: a duel is already in progress');
  }

  const fighterA = validateFighterSelection(series, 'A', fighterIdA);
  const fighterB = validateFighterSelection(series, 'B', fighterIdB);

  // Mark fighters as used
  fighterA.used = true;
  fighterB.used = true;

  series.status = 'dueling';

  const roleA = ROLES[fighterA.roleId];
  const roleB = ROLES[fighterB.roleId];

  return {
    duelNumber: series.currentDuelNumber,
    fighterA: createFighterCombatState(fighterIdA, fighterA.roleId, roleA),
    fighterB: createFighterCombatState(fighterIdB, fighterB.roleId, roleB),
    roleA,
    roleB,
  };
}

/**
 * Records the outcome of a duel and advances or finalizes the series.
 */
export function completeSeriesDuel(
  series: SeriesState,
  winner: 'A' | 'B',
  reason: string,
  fighterIdA: string,
  fighterIdB: string,
  roleIdA: string,
  roleIdB: string,
): CompleteDuelResult {
  if (series.status !== 'dueling') {
    throw new Error(`Cannot complete duel: series is in status "${series.status}", expected "dueling"`);
  }

  if (winner === 'A') {
    series.scoreA++;
  } else {
    series.scoreB++;
  }

  series.duelHistory.push({
    duelNumber: series.currentDuelNumber,
    fighterIdA,
    fighterIdB,
    roleIdA,
    roleIdB,
    winner,
    reason,
    scoreAfterDuelA: series.scoreA,
    scoreAfterDuelB: series.scoreB,
  });

  // Check if someone reached 2 wins
  if (series.scoreA >= 2) {
    series.status = 'completed';
    series.winner = 'A';
    return {
      seriesCompleted: true,
      winner: 'A',
      finalScoreA: series.scoreA,
      finalScoreB: series.scoreB,
    };
  }

  if (series.scoreB >= 2) {
    series.status = 'completed';
    series.winner = 'B';
    return {
      seriesCompleted: true,
      winner: 'B',
      finalScoreA: series.scoreA,
      finalScoreB: series.scoreB,
    };
  }

  // Series continues: advance duel number
  if (series.currentDuelNumber === 1) {
    series.currentDuelNumber = 2;
    series.status = 'picking';
    return {
      seriesCompleted: false,
      finalScoreA: series.scoreA,
      finalScoreB: series.scoreB,
      nextDuelNumber: 2,
    };
  }

  if (series.currentDuelNumber === 2) {
    // Score must be 1-1 to reach Duel 3
    series.currentDuelNumber = 3;
    series.status = 'picking';
    return {
      seriesCompleted: false,
      finalScoreA: series.scoreA,
      finalScoreB: series.scoreB,
      nextDuelNumber: 3,
    };
  }

  // If already at duel 3 and nobody reached 2 wins (impossible mathematically with 2 parties)
  throw new Error(`Invalid series state after duel 3: scoreA=${series.scoreA}, scoreB=${series.scoreB}`);
}
