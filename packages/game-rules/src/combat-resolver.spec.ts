import { resolveTurn } from './combat-resolver';
import { resolveSuddenDeath } from './sudden-death-controller';
import { ROLES } from './roles';
import type { DuelState } from './types';

describe('Deterministic Combat Engine', () => {
  // P0.3: Clean typed fixture conforming strictly to DuelState and FighterCombatState
  const mockDuel: DuelState = {
    id: 'test-duel-1',
    status: 'dueling',
    fighterIdA: 'fa-1',
    fighterIdB: 'fb-1',
    roleA: ROLES.swordsman,
    roleB: ROLES.tank,
    stateA: {
      fighterId: 'fa-1',
      roleId: 'swordsman',
      currentHp: 100,
      currentShield: 0,
      skillUsesRemaining: 1,
      statusEffects: [],
    },
    stateB: {
      fighterId: 'fb-1',
      roleId: 'tank',
      currentHp: 120,
      currentShield: 0,
      skillUsesRemaining: 1,
      statusEffects: [],
    },
    resolvedTurns: 0,
    maxTurns: 6,
  };

  it('resolves normal turn damage and decrements skill uses', () => {
    const res = resolveTurn(mockDuel, { actionType: 'skill' }, { actionType: 'strike' });
    expect(res.resolvedTurnNumber).toBe(1);
    expect(res.nextStateA.skillUsesRemaining).toBe(0);
    expect(res.status.kind).toBe('continue');
    // Swordsman deals 32 damage to Tank (120 - 32 = 88 HP); Tank strikes Swordsman for 15 (100 - 15 = 85 HP)
    expect(res.nextStateB.currentHp).toBe(88);
    expect(res.nextStateA.currentHp).toBe(85);
  });

  it('correctly executes Tank Shield Bash (gainShield before damage)', () => {
    const duel: DuelState = {
      ...mockDuel,
      roleA: ROLES.tank,
      roleB: ROLES.swordsman,
      stateA: { ...mockDuel.stateA, roleId: 'tank', currentHp: 120 },
      stateB: { ...mockDuel.stateB, roleId: 'swordsman', currentHp: 100 },
    };
    // Tank uses skill (gains 20 shield, deals 18 damage), Swordsman strikes for 22
    const res = resolveTurn(duel, { actionType: 'skill' }, { actionType: 'strike' });
    // Tank gained 20 shield, Swordsman 22 damage breaks 20 shield and deals 2 HP damage (120 - 2 = 118)
    expect(res.nextStateA.currentHp).toBe(118);
    expect(res.nextStateA.currentShield).toBe(0);
    // Swordsman took 18 damage (100 - 18 = 82)
    expect(res.nextStateB.currentHp).toBe(82);
  });

  it('correctly executes Rogue Shadow Feint (deals damage and primes reduceNextHit)', () => {
    const duel: DuelState = {
      ...mockDuel,
      roleA: ROLES.rogue,
      roleB: ROLES.swordsman,
      stateA: { ...mockDuel.stateA, roleId: 'rogue', currentHp: 95 },
      stateB: { ...mockDuel.stateB, roleId: 'swordsman', currentHp: 100 },
    };
    const res = resolveTurn(duel, { actionType: 'skill' }, { actionType: 'strike' });
    // Rogue dealt 20 damage (100 - 20 = 80), took 22 damage (95 - 22 = 73)
    expect(res.nextStateB.currentHp).toBe(80);
    expect(res.nextStateA.currentHp).toBe(73);
    // Primed reduceNextHit 12 in statusEffects
    expect(res.nextStateA.statusEffects).toEqual([{ type: 'reduceNextHit', amount: 12 }]);
  });

  it('consumes reduceNextHit on subsequent incoming damage', () => {
    const duel: DuelState = {
      ...mockDuel,
      stateA: {
        ...mockDuel.stateA,
        statusEffects: [{ type: 'reduceNextHit', amount: 12 }],
      },
    };
    // Tank strikes for 15; reduceNextHit absorbs 12 -> Swordsman takes only 3 damage
    const res = resolveTurn(duel, { actionType: 'strike' }, { actionType: 'strike' });
    expect(res.nextStateA.currentHp).toBe(97); // 100 - (15 - 12) = 97
    expect(res.nextStateA.statusEffects).toEqual([]); // Consumed
  });

  it('cancels Mage Arcane Burst when interrupted by opponent strike', () => {
    const duel: DuelState = {
      ...mockDuel,
      roleA: ROLES.mage,
      stateA: { ...mockDuel.stateA, roleId: 'mage', currentHp: 85 },
    };
    // Mage uses Arcane Burst (interruptibleBy: ['strike']), Tank uses strike -> Mage skill interrupted!
    const res = resolveTurn(duel, { actionType: 'skill' }, { actionType: 'strike' });
    expect(res.nextStateB.currentHp).toBe(120); // Tank took 0 damage
    expect(res.nextStateA.currentHp).toBe(70);  // Mage took 15 damage (85 - 15 = 70)
  });

  it('reaches turnLimitHP after 6 turns without getting stuck', () => {
    const turn6Duel: DuelState = {
      ...mockDuel,
      resolvedTurns: 5,
      stateA: { ...mockDuel.stateA, currentHp: 80 },
      stateB: { ...mockDuel.stateB, currentHp: 40 },
    };
    const res = resolveTurn(turn6Duel, { actionType: 'guard' }, { actionType: 'guard' });
    expect(res.resolvedTurnNumber).toBe(6);
    expect(res.status.kind).toBe('duelComplete');
    if (res.status.kind === 'duelComplete') {
      expect(res.status.winner).toBe('A');
      expect(res.status.reason).toBe('turnLimitHP');
    }
  });

  it('resolves sudden death deterministically with Shadow Feint mitigation applied', () => {
    const outcome = resolveSuddenDeath(
      ROLES.swordsman,
      ROLES.tank,
      'fa-1',
      'fb-1',
      { ...mockDuel.stateA, statusEffects: [{ type: 'reduceNextHit', amount: 10 }] },
      mockDuel.stateB,
      { actionType: 'guard' },
      { actionType: 'strike' },
    );
    // B strikes for 15, halved by guard to 7, reduced by 10 mitigation to 0!
    expect(outcome.nextStateA.currentHp).toBe(100);
    expect(outcome.nextStateB.currentHp).toBe(120);
    expect(outcome.isComplete).toBe(false);
    if (!outcome.isComplete) {
      expect(outcome.needsDigitalTieBreak).toBe(true);
      expect(outcome.reason).toBe('suddenDeathHpAndShieldEqual');
    }
  });
});
