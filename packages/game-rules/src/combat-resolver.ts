import type {
  DuelState,
  CombatAction,
  TurnResolution,
  FighterCombatState,
  CombatLogEntry,
} from './types';
import { ROLES, validateActiveFighterInput } from './roles';

interface DamagePacket {
  amount: number;
  guardInteraction: 'guardable' | 'bypass' | 'partial';
}

function resolveIncomingDamage(
  targetState: FighterCombatState,
  incomingPackets: DamagePacket[],
  isGuarding: boolean,
  targetSide: 'A' | 'B',
  combatLog: CombatLogEntry[],
): void {
  for (const packet of incomingPackets) {
    let dmg = packet.amount;

    // STEP 4: Guard mitigation
    if (isGuarding) {
      if (packet.guardInteraction === 'guardable') {
        dmg = Math.floor(dmg * 0.5);
      } else if (packet.guardInteraction === 'partial') {
        dmg = Math.floor(dmg * 0.75);
      }
      // 'bypass' pierces guard with 0% reduction
    }

    // STEP 5: Status effect absorption (Shadow Feint reduceNextHit on first positive damage packet)
    const redIdx = targetState.statusEffects.findIndex(e => e.type === 'reduceNextHit');
    if (redIdx !== -1 && dmg > 0) {
      const red = targetState.statusEffects[redIdx];
      dmg = Math.max(0, dmg - red.amount);
      targetState.statusEffects.splice(redIdx, 1);
      combatLog.push({ actor: targetSide, event: `Shadow Feint absorbed ${red.amount} damage.` });
    }

    if (dmg <= 0) continue;

    // Shield absorbs damage first, overflow damages HP
    if (targetState.currentShield > 0) {
      const absorb = Math.min(targetState.currentShield, dmg);
      targetState.currentShield -= absorb;
      const remainingDmg = dmg - absorb;
      targetState.currentHp = Math.max(0, targetState.currentHp - remainingDmg);
      combatLog.push({
        actor: 'system',
        event: `Party ${targetSide} shield absorbed ${absorb}, took ${remainingDmg} HP damage.`,
      });
    } else {
      targetState.currentHp = Math.max(0, targetState.currentHp - dmg);
      combatLog.push({ actor: 'system', event: `Party ${targetSide} took ${dmg} HP damage.` });
    }
  }
}

/**
 * Pure, deterministic combat turn resolver (Step 0 to Step 10).
 * Implements canonical SkillEffect[] iteration across all 8 roles (P0.1).
 * Zero side-effects, zero time/random calls. Fully playable combat execution.
 */
export function resolveTurn(
  duel: Readonly<DuelState>,
  actionA: Readonly<CombatAction>,
  actionB: Readonly<CombatAction>,
): TurnResolution {
  const roleA = ROLES[duel.stateA.roleId];
  const roleB = ROLES[duel.stateB.roleId];
  if (!roleA || !roleB) {
    throw new Error(`Invalid role in duel: A=${duel.stateA.roleId}, B=${duel.stateB.roleId}`);
  }

  // Role identity consistency check (P0.1, P2.2) - fully typed without any casts
  if (duel.roleA && duel.roleA.id !== duel.stateA.roleId) {
    throw new Error(`Role definition mismatch for party A: duel.roleA.id="${duel.roleA.id}" !== stateA.roleId="${duel.stateA.roleId}"`);
  }
  if (duel.roleB && duel.roleB.id !== duel.stateB.roleId) {
    throw new Error(`Role definition mismatch for party B: duel.roleB.id="${duel.roleB.id}" !== stateB.roleId="${duel.stateB.roleId}"`);
  }

  // Domain boundary input validation (P2.1)
  validateActiveFighterInput(duel.stateA, roleA, duel.fighterIdA, 'A');
  validateActiveFighterInput(duel.stateB, roleB, duel.fighterIdB, 'B');

  const validActions = new Set(['strike', 'guard', 'skill']);
  if (!validActions.has(actionA.actionType) || !validActions.has(actionB.actionType)) {
    throw new Error(`Invalid action type: A=${actionA.actionType}, B=${actionB.actionType}`);
  }

  const combatLog: CombatLogEntry[] = [];
  const stateA: FighterCombatState = {
    ...duel.stateA,
    statusEffects: duel.stateA.statusEffects.map(e => ({ ...e })),
  };
  const stateB: FighterCombatState = {
    ...duel.stateB,
    statusEffects: duel.stateB.statusEffects.map(e => ({ ...e })),
  };

  // STEP 1 — Consume skill uses or fail validation if exhausted (P2.3)
  const effActionA = actionA.actionType;
  if (effActionA === 'skill') {
    if (stateA.skillUsesRemaining <= 0) {
      throw new Error('Party A attempted skill action with 0 skill uses remaining');
    }
    stateA.skillUsesRemaining -= 1;
  }

  const effActionB = actionB.actionType;
  if (effActionB === 'skill') {
    if (stateB.skillUsesRemaining <= 0) {
      throw new Error('Party B attempted skill action with 0 skill uses remaining');
    }
    stateB.skillUsesRemaining -= 1;
  }

  // STEP 2 — Simultaneous interrupt evaluation
  const interruptedA = effActionA === 'skill' && roleA.skill.interruptibleBy.includes(effActionB);
  const interruptedB = effActionB === 'skill' && roleB.skill.interruptibleBy.includes(effActionA);
  if (interruptedA) {
    combatLog.push({ actor: 'system', event: `Party A ${roleA.skill.name} interrupted by Party B ${effActionB}!` });
  }
  if (interruptedB) {
    combatLog.push({ actor: 'system', event: `Party B ${roleB.skill.name} interrupted by Party A ${effActionA}!` });
  }

  // STEP 3 — Pre-damage shield buffs (Tank Shield Bash beforeDamage)
  if (effActionA === 'skill' && !interruptedA) {
    for (const effect of roleA.skill.effects) {
      if (effect.type === 'gainShield' && effect.timing === 'beforeDamage') {
        stateA.currentShield = Math.min(200, stateA.currentShield + effect.amount);
        combatLog.push({ actor: 'A', event: `${roleA.skill.name} granted +${effect.amount} shield before damage.` });
      }
    }
  }
  if (effActionB === 'skill' && !interruptedB) {
    for (const effect of roleB.skill.effects) {
      if (effect.type === 'gainShield' && effect.timing === 'beforeDamage') {
        stateB.currentShield = Math.min(200, stateB.currentShield + effect.amount);
        combatLog.push({ actor: 'B', event: `${roleB.skill.name} granted +${effect.amount} shield before damage.` });
      }
    }
  }

  // STEP 4 — Compute outgoing damage packets from each declared SkillEffect
  const packetsAtoB: DamagePacket[] = [];
  if (effActionA === 'strike') {
    packetsAtoB.push({ amount: roleA.baseAttack, guardInteraction: 'guardable' });
  } else if (effActionA === 'skill' && !interruptedA) {
    for (const effect of roleA.skill.effects) {
      if (effect.type === 'damage') {
        packetsAtoB.push({ amount: effect.amount, guardInteraction: effect.guardInteraction });
      } else if (effect.type === 'conditionalDamage') {
        const isExecution = (duel.stateB.currentHp * 100) <= (effect.thresholdPercent * roleB.maxHp);
        if (isExecution) {
          packetsAtoB.push({ amount: effect.bonusAmount, guardInteraction: effect.bonusGuard });
        } else {
          packetsAtoB.push({ amount: effect.baseAmount, guardInteraction: effect.baseGuard });
        }
      }
    }
  }

  const packetsBtoA: DamagePacket[] = [];
  if (effActionB === 'strike') {
    packetsBtoA.push({ amount: roleB.baseAttack, guardInteraction: 'guardable' });
  } else if (effActionB === 'skill' && !interruptedB) {
    for (const effect of roleB.skill.effects) {
      if (effect.type === 'damage') {
        packetsBtoA.push({ amount: effect.amount, guardInteraction: effect.guardInteraction });
      } else if (effect.type === 'conditionalDamage') {
        const isExecution = (duel.stateA.currentHp * 100) <= (effect.thresholdPercent * roleA.maxHp);
        if (isExecution) {
          packetsBtoA.push({ amount: effect.bonusAmount, guardInteraction: effect.bonusGuard });
        } else {
          packetsBtoA.push({ amount: effect.baseAmount, guardInteraction: effect.baseGuard });
        }
      }
    }
  }

  // STEP 5 — Resolve incoming damage packets, guard mitigation, and status effects
  resolveIncomingDamage(stateB, packetsAtoB, effActionB === 'guard', 'B', combatLog);
  resolveIncomingDamage(stateA, packetsBtoA, effActionA === 'guard', 'A', combatLog);

  // STEP 6 — Post-damage shield grants & status effects (Paladin Aegis Smite + Rogue Shadow Feint)
  if (stateA.currentHp > 0 && effActionA === 'skill' && !interruptedA) {
    for (const effect of roleA.skill.effects) {
      if (effect.type === 'gainShield' && effect.timing === 'afterDamage') {
        stateA.currentShield = Math.min(200, stateA.currentShield + effect.amount);
        combatLog.push({ actor: 'A', event: `${roleA.skill.name} granted +${effect.amount} shield after hit.` });
      } else if (effect.type === 'reduceNextHit') {
        stateA.statusEffects.push({ type: 'reduceNextHit', amount: effect.amount });
        combatLog.push({ actor: 'A', event: `${roleA.skill.name} primed damage reduction for future hit.` });
      }
    }
  }
  if (stateB.currentHp > 0 && effActionB === 'skill' && !interruptedB) {
    for (const effect of roleB.skill.effects) {
      if (effect.type === 'gainShield' && effect.timing === 'afterDamage') {
        stateB.currentShield = Math.min(200, stateB.currentShield + effect.amount);
        combatLog.push({ actor: 'B', event: `${roleB.skill.name} granted +${effect.amount} shield after hit.` });
      } else if (effect.type === 'reduceNextHit') {
        stateB.statusEffects.push({ type: 'reduceNextHit', amount: effect.amount });
        combatLog.push({ actor: 'B', event: `${roleB.skill.name} primed damage reduction for future hit.` });
      }
    }
  }

  // STEP 7 — Clamp values to domain bounds
  stateA.currentHp = Math.max(0, Math.min(roleA.maxHp, stateA.currentHp));
  stateB.currentHp = Math.max(0, Math.min(roleB.maxHp, stateB.currentHp));
  stateA.currentShield = Math.max(0, Math.min(200, stateA.currentShield));
  stateB.currentShield = Math.max(0, Math.min(200, stateB.currentShield));

  // STEP 8 — Evaluate Terminal Conditions
  const deadA = stateA.currentHp === 0;
  const deadB = stateB.currentHp === 0;
  const resolvedTurnNumber = duel.resolvedTurns + 1;

  if (deadA && deadB) {
    // Simultaneous defeat: deep-copy pre-exchange snapshot and enter sudden death (P2.3)
    const rollbackStateA: FighterCombatState = {
      ...duel.stateA,
      statusEffects: duel.stateA.statusEffects.map(e => ({ ...e })),
    };
    const rollbackStateB: FighterCombatState = {
      ...duel.stateB,
      statusEffects: duel.stateB.statusEffects.map(e => ({ ...e })),
    };
    combatLog.push({ actor: 'system', event: 'Simultaneous knockout! Annulling lethal states and entering Sudden Death.' });
    return {
      nextStateA: { ...rollbackStateA, statusEffects: rollbackStateA.statusEffects.map(e => ({ ...e })) },
      nextStateB: { ...rollbackStateB, statusEffects: rollbackStateB.statusEffects.map(e => ({ ...e })) },
      combatLog,
      status: {
        kind: 'enterSuddenDeath',
        rollbackStateA,
        rollbackStateB,
      },
      resolvedTurnNumber,
    };
  }

  if (deadA || deadB) {
    const winner = deadA ? 'B' : 'A';
    combatLog.push({ actor: 'system', event: `Party ${winner} wins by knockout.` });
    return {
      nextStateA: stateA,
      nextStateB: stateB,
      combatLog,
      status: { kind: 'duelComplete', winner, reason: 'knockout' },
      resolvedTurnNumber,
    };
  }

  // Turn limit evaluation (6 turns)
  if (resolvedTurnNumber >= duel.maxTurns) {
    const crossA = stateA.currentHp * roleB.maxHp;
    const crossB = stateB.currentHp * roleA.maxHp;

    if (crossA !== crossB) {
      const winner = crossA > crossB ? 'A' : 'B';
      combatLog.push({ actor: 'system', event: `Turn limit reached (6 turns). Party ${winner} wins on HP percentage.` });
      return {
        nextStateA: stateA,
        nextStateB: stateB,
        combatLog,
        status: { kind: 'duelComplete', winner, reason: 'turnLimitHP' },
        resolvedTurnNumber,
      };
    }

    if (stateA.currentShield !== stateB.currentShield) {
      const winner = stateA.currentShield > stateB.currentShield ? 'A' : 'B';
      combatLog.push({ actor: 'system', event: `Turn limit reached with equal HP. Party ${winner} wins on shield.` });
      return {
        nextStateA: stateA,
        nextStateB: stateB,
        combatLog,
        status: { kind: 'duelComplete', winner, reason: 'turnLimitShield' },
        resolvedTurnNumber,
      };
    }

    combatLog.push({ actor: 'system', event: 'Turn limit reached with identical HP% and shields. Routing to digital tie-break.' });
    return {
      nextStateA: stateA,
      nextStateB: stateB,
      combatLog,
      status: { kind: 'needsDigitalTieBreak', reason: 'turnLimitHpAndShieldEqual' },
      resolvedTurnNumber,
    };
  }

  return {
    nextStateA: stateA,
    nextStateB: stateB,
    combatLog,
    status: { kind: 'continue' },
    resolvedTurnNumber,
  };
}
