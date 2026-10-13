import {
  createSeries,
  validateFighterSelection,
  startSeriesDuel,
  completeSeriesDuel,
} from './series-controller';
import { resolveTurn } from './combat-resolver';
import type { DuelState } from './types';

describe('Best-of-Three Series Controller & Match Simulation (Phase 2)', () => {
  const validRosterA = [
    { fighterId: 'fa-1', roleId: 'swordsman' },
    { fighterId: 'fa-2', roleId: 'archer' },
    { fighterId: 'fa-3', roleId: 'mage' },
    { fighterId: 'fa-4', roleId: 'tank' },
    { fighterId: 'fa-5', roleId: 'rogue' },
  ];

  const validRosterB = [
    { fighterId: 'fb-1', roleId: 'assassin' },
    { fighterId: 'fb-2', roleId: 'vanguard' },
    { fighterId: 'fb-3', roleId: 'paladin' },
    { fighterId: 'fb-4', roleId: 'swordsman' },
    { fighterId: 'fb-5', roleId: 'mage' },
  ];

  describe('Series Creation & Roster Invariants', () => {
    it('creates a series with valid 5-fighter distinct rosters', () => {
      const series = createSeries('s-1', 'Alpha', 'Bravo', validRosterA, validRosterB);
      expect(series.seriesId).toBe('s-1');
      expect(series.scoreA).toBe(0);
      expect(series.scoreB).toBe(0);
      expect(series.currentDuelNumber).toBe(1);
      expect(series.status).toBe('picking');
      expect(series.partyA.fighters).toHaveLength(5);
      expect(series.partyB.fighters).toHaveLength(5);
    });

    it('rejects rosters with fewer or more than 5 fighters', () => {
      expect(() =>
        createSeries('s-1', 'Alpha', 'Bravo', validRosterA.slice(0, 4), validRosterB),
      ).toThrow(/must have exactly 5 fighters/);
    });

    it('rejects rosters with duplicate roles within the party', () => {
      const duplicateRoles = [
        { fighterId: 'fa-1', roleId: 'swordsman' },
        { fighterId: 'fa-2', roleId: 'swordsman' }, // duplicate
        { fighterId: 'fa-3', roleId: 'mage' },
        { fighterId: 'fa-4', roleId: 'tank' },
        { fighterId: 'fa-5', roleId: 'rogue' },
      ];
      expect(() =>
        createSeries('s-1', 'Alpha', 'Bravo', duplicateRoles, validRosterB),
      ).toThrow(/duplicate roles/);
    });

    it('rejects rosters with invalid role identifiers', () => {
      const invalidRole = [
        { fighterId: 'fa-1', roleId: 'nonexistent-class' },
        { fighterId: 'fa-2', roleId: 'archer' },
        { fighterId: 'fa-3', roleId: 'mage' },
        { fighterId: 'fa-4', roleId: 'tank' },
        { fighterId: 'fa-5', roleId: 'rogue' },
      ];
      expect(() =>
        createSeries('s-1', 'Alpha', 'Bravo', invalidRole, validRosterB),
      ).toThrow(/Invalid roleId/);
    });
  });

  describe('Fighter Selection & Reuse Enforcement', () => {
    it('allows selection of unused fighters and marks them as used when duel starts', () => {
      const series = createSeries('s-1', 'Alpha', 'Bravo', validRosterA, validRosterB);
      const fighterA = validateFighterSelection(series, 'A', 'fa-1');
      expect(fighterA.used).toBe(false);

      const duel = startSeriesDuel(series, 'fa-1', 'fb-1');
      expect(duel.duelNumber).toBe(1);
      expect(series.status).toBe('dueling');
      expect(series.partyA.fighters.find((f) => f.fighterId === 'fa-1')?.used).toBe(true);
      expect(series.partyB.fighters.find((f) => f.fighterId === 'fb-1')?.used).toBe(true);
    });

    it('strictly prevents reusing a fighter in a subsequent duel', () => {
      const series = createSeries('s-1', 'Alpha', 'Bravo', validRosterA, validRosterB);
      startSeriesDuel(series, 'fa-1', 'fb-1');
      completeSeriesDuel(series, 'A', 'knockout', 'fa-1', 'fb-1', 'swordsman', 'assassin');

      expect(series.scoreA).toBe(1);
      expect(series.currentDuelNumber).toBe(2);

      // Attempting to select 'fa-1' again in Duel 2 must throw
      expect(() => validateFighterSelection(series, 'A', 'fa-1')).toThrow(
        /has already been used/,
      );
      expect(() => startSeriesDuel(series, 'fa-1', 'fb-2')).toThrow(
        /has already been used/,
      );
    });
  });

  describe('Best-of-Three Series Progression & 2-0 Termination', () => {
    it('ends the series immediately on a 2-0 sweep without allowing Duel 3', () => {
      const series = createSeries('s-1', 'Alpha', 'Bravo', validRosterA, validRosterB);

      // Duel 1: Alpha wins
      startSeriesDuel(series, 'fa-1', 'fb-1');
      const res1 = completeSeriesDuel(series, 'A', 'knockout', 'fa-1', 'fb-1', 'swordsman', 'assassin');
      expect(res1.seriesCompleted).toBe(false);
      expect(res1.nextDuelNumber).toBe(2);
      expect(series.scoreA).toBe(1);
      expect(series.scoreB).toBe(0);

      // Duel 2: Alpha wins again -> 2-0
      startSeriesDuel(series, 'fa-2', 'fb-2');
      const res2 = completeSeriesDuel(series, 'A', 'turnLimitHP', 'fa-2', 'fb-2', 'archer', 'vanguard');
      expect(res2.seriesCompleted).toBe(true);
      expect(res2.winner).toBe('A');
      expect(res2.finalScoreA).toBe(2);
      expect(res2.finalScoreB).toBe(0);
      expect(series.status).toBe('completed');
      expect(series.winner).toBe('A');

      // Attempting to start Duel 3 after 2-0 must throw
      expect(() => startSeriesDuel(series, 'fa-3', 'fb-3')).toThrow(
        /series has already completed/,
      );
    });

    it('advances to Duel 3 only when the score is tied 1-1', () => {
      const series = createSeries('s-1', 'Alpha', 'Bravo', validRosterA, validRosterB);

      // Duel 1: Alpha wins -> 1-0
      startSeriesDuel(series, 'fa-1', 'fb-1');
      completeSeriesDuel(series, 'A', 'knockout', 'fa-1', 'fb-1', 'swordsman', 'assassin');

      // Duel 2: Bravo wins -> 1-1
      startSeriesDuel(series, 'fa-2', 'fb-2');
      const res2 = completeSeriesDuel(series, 'B', 'knockout', 'fa-2', 'fb-2', 'archer', 'vanguard');
      expect(res2.seriesCompleted).toBe(false);
      expect(res2.nextDuelNumber).toBe(3);
      expect(series.currentDuelNumber).toBe(3);
      expect(series.status).toBe('picking');

      // Duel 3: Bravo wins -> 1-2, Bravo takes the series
      startSeriesDuel(series, 'fa-3', 'fb-3');
      const res3 = completeSeriesDuel(series, 'B', 'knockout', 'fa-3', 'fb-3', 'mage', 'paladin');
      expect(res3.seriesCompleted).toBe(true);
      expect(res3.winner).toBe('B');
      expect(res3.finalScoreA).toBe(1);
      expect(res3.finalScoreB).toBe(2);
      expect(series.status).toBe('completed');
      expect(series.winner).toBe('B');
    });
  });

  describe('End-to-End Pure Rule-Engine Match Simulation', () => {
    it('simulates a complete Best-of-Three match with deterministic turn resolution', () => {
      const series = createSeries('sim-series-1', 'Solar', 'Lunar', validRosterA, validRosterB);

      // --- DUEL 1: Swordsman vs Assassin ---
      const d1 = startSeriesDuel(series, 'fa-1', 'fb-1');
      const duelState1: DuelState = {
        id: 'd1',
        roleA: d1.roleA,
        roleB: d1.roleB,
        fighterIdA: 'fa-1',
        fighterIdB: 'fb-1',
        stateA: d1.fighterA,
        stateB: d1.fighterB,
        resolvedTurns: 0,
        maxTurns: 6,
        status: 'dueling',
      };

      // Turn 1: Strike vs Guard
      const turn1 = resolveTurn(duelState1, { actionType: 'strike' }, { actionType: 'guard' });
      expect(turn1.status.kind).toBe('continue');
      duelState1.stateA = turn1.nextStateA;
      duelState1.stateB = turn1.nextStateB;
      duelState1.resolvedTurns = 1;

      // Finish Duel 1 in favor of Solar
      completeSeriesDuel(series, 'A', 'knockout', 'fa-1', 'fb-1', 'swordsman', 'assassin');
      expect(series.scoreA).toBe(1);

      // --- DUEL 2: Archer vs Vanguard ---
      const d2 = startSeriesDuel(series, 'fa-2', 'fb-2');
      const duelState2: DuelState = {
        id: 'd2',
        roleA: d2.roleA,
        roleB: d2.roleB,
        fighterIdA: 'fa-2',
        fighterIdB: 'fb-2',
        stateA: d2.fighterA,
        stateB: d2.fighterB,
        resolvedTurns: 0,
        maxTurns: 6,
        status: 'dueling',
      };

      // Turn 1: Skill vs Strike
      const turn2 = resolveTurn(duelState2, { actionType: 'skill' }, { actionType: 'strike' });
      expect(turn2.status.kind).toBe('continue');

      // Finish Duel 2 in favor of Solar -> 2-0 sweep
      const finalOutcome = completeSeriesDuel(
        series,
        'A',
        'turnLimitHP',
        'fa-2',
        'fb-2',
        'archer',
        'vanguard',
      );

      expect(finalOutcome.seriesCompleted).toBe(true);
      expect(finalOutcome.winner).toBe('A');
      expect(series.duelHistory).toHaveLength(2);
      expect(series.duelHistory[0].winner).toBe('A');
      expect(series.duelHistory[1].winner).toBe('A');
      expect(series.status).toBe('completed');
    });
  });
});
