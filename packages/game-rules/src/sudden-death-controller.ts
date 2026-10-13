import type {
  RoleDefinition,
  FighterCombatState,
  SuddenDeathAction,
  SuddenDeathOutcome,
  CombatLogEntry,
} from './types';
import { validateActiveFighterInput } from './roles';

/**
 * Pure, deterministic sudden-death exchange resolver (§0.6.1).
 * Enforces input validation and Shadow Feint mitigation absorption (P1.2).
 * Fulfills frozen SuddenDeathOutcome union with needsDigitalTieBreak: true on equal branches (P0.2).
 */
export function resolveSuddenDeath(
  roleA: Readonly<RoleDefinition>,
  roleB: Readonly<RoleDefinition>,
  fighterIdA: string,
  fighterIdB: string,
  restoredStateA: Readonly<FighterCombatState>,
  restoredStateB: Readonly<FighterCombatState>,
  actionA: Readonly<SuddenDeathAction>,
  actionB: Readonly<SuddenDeathAction>,
): SuddenDeathOutcome {
  // Domain boundary input validation (P1.2, P2.1)
  validateActiveFighterInput(restoredStateA, roleA, fighterIdA, 'A');
  validateActiveFighterInput(restoredStateB, roleB, fighterIdB, 'B');

  if (actionA.actionType !== 'strike' && actionA.actionType !== 'guard') {
    throw new Error(`Invalid sudden death action for Party A: ${actionA.actionType}`);
  }
  if (actionB.actionType !== 'strike' && actionB.actionType !== 'guard') {
    throw new Error(`Invalid sudden death action for Party B: ${actionB.actionType}`);
  }

  const combatLog: CombatLogEntry[] = [
    { actor: 'system', event: `Sudden death exchange: A=${actionA.actionType}, B=${actionB.actionType}` },
  ];

  const stateA: FighterCombatState = {
    ...restoredStateA,
    statusEffects: restoredStateA.statusEffects.map(e => ({ ...e })),
  };
  const stateB: FighterCombatState = {
    ...restoredStateB,
    statusEffects: restoredStateB.statusEffects.map(e => ({ ...e })),
  };

  let rawDmgA = actionA.actionType === 'strike' ? roleA.baseAttack : 0;
  let rawDmgB = actionB.actionType === 'strike' ? roleB.baseAttack : 0;

  if (actionB.actionType === 'guard' && rawDmgA > 0) {
    rawDmgA = Math.floor(rawDmgA * 0.5);
  }
  if (actionA.actionType === 'guard' && rawDmgB > 0) {
    rawDmgB = Math.floor(rawDmgB * 0.5);
  }

  // P1.2: Apply reduceNextHit mitigation to incoming damage in sudden death
  const redB = stateB.statusEffects.findIndex(e => e.type === 'reduceNextHit');
  if (redB !== -1 && rawDmgA > 0) {
    const red = stateB.statusEffects[redB];
    rawDmgA = Math.max(0, rawDmgA - red.amount);
    stateB.statusEffects.splice(redB, 1);
    combatLog.push({ actor: 'B', event: `Shadow Feint absorbed ${red.amount} damage in sudden death.` });
  }

  const redA = stateA.statusEffects.findIndex(e => e.type === 'reduceNextHit');
  if (redA !== -1 && rawDmgB > 0) {
    const red = stateA.statusEffects[redA];
    rawDmgB = Math.max(0, rawDmgB - red.amount);
    stateA.statusEffects.splice(redA, 1);
    combatLog.push({ actor: 'A', event: `Shadow Feint absorbed ${red.amount} damage in sudden death.` });
  }

  // Apply damage to shield then HP
  if (rawDmgA > 0) {
    if (stateB.currentShield >= rawDmgA) {
      stateB.currentShield -= rawDmgA;
    } else {
      const rem = rawDmgA - stateB.currentShield;
      stateB.currentShield = 0;
      stateB.currentHp = Math.max(0, stateB.currentHp - rem);
    }
  }

  if (rawDmgB > 0) {
    if (stateA.currentShield >= rawDmgB) {
      stateA.currentShield -= rawDmgB;
    } else {
      const rem = rawDmgB - stateA.currentShield;
      stateA.currentShield = 0;
      stateA.currentHp = Math.max(0, stateA.currentHp - rem);
    }
  }

  const deadA = stateA.currentHp === 0;
  const deadB = stateB.currentHp === 0;

  if (deadA && !deadB) {
    return {
      isComplete: true,
      winner: 'B',
      reason: 'suddenDeathKnockout',
      combatLog,
      nextStateA: stateA,
      nextStateB: stateB,
    };
  }
  if (deadB && !deadA) {
    return {
      isComplete: true,
      winner: 'A',
      reason: 'suddenDeathKnockout',
      combatLog,
      nextStateA: stateA,
      nextStateB: stateB,
    };
  }

  if (deadA && deadB) {
    // Both dead: compare pre-exchange snapshot shields (§0.6.1, P1.16)
    if (restoredStateA.currentShield !== restoredStateB.currentShield) {
      const winner = restoredStateA.currentShield > restoredStateB.currentShield ? 'A' : 'B';
      return {
        isComplete: true,
        winner,
        reason: 'suddenDeathDoubleKnockoutShield',
        combatLog,
        nextStateA: stateA,
        nextStateB: stateB,
      };
    }
    return {
      isComplete: false,
      needsDigitalTieBreak: true, // P0.2: Required by frozen SuddenDeathOutcome union
      reason: 'suddenDeathDoubleKnockoutShieldEqual',
      combatLog,
      nextStateA: stateA,
      nextStateB: stateB,
    };
  }

  // Neither dead: compare post-exchange metrics
  const crossA = stateA.currentHp * roleB.maxHp;
  const crossB = stateB.currentHp * roleA.maxHp;
  if (crossA !== crossB) {
    const winner = crossA > crossB ? 'A' : 'B';
    return {
      isComplete: true,
      winner,
      reason: 'suddenDeathHP',
      combatLog,
      nextStateA: stateA,
      nextStateB: stateB,
    };
  }

  if (stateA.currentShield !== stateB.currentShield) {
    const winner = stateA.currentShield > stateB.currentShield ? 'A' : 'B';
    return {
      isComplete: true,
      winner,
      reason: 'suddenDeathShield',
      combatLog,
      nextStateA: stateA,
      nextStateB: stateB,
    };
  }

  return {
    isComplete: false,
    needsDigitalTieBreak: true, // P0.2: Required by frozen SuddenDeathOutcome union
    reason: 'suddenDeathHpAndShieldEqual',
    combatLog,
    nextStateA: stateA,
    nextStateB: stateB,
  };
}
