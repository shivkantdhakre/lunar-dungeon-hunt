import type { RoleDefinition } from './types';

export const ROLES: Record<string, RoleDefinition> = {
  swordsman: {
    id: 'swordsman',
    name: 'Swordsman',
    maxHp: 100,
    baseAttack: 22,
    skill: {
      id: 'blade_breaker',
      name: 'Blade Breaker',
      usesPerDuel: 1,
      effects: [{ type: 'damage', amount: 32, guardInteraction: 'guardable' }],
      interruptibleBy: [],
      description: 'Deal 32 guardable damage (16 vs Guard). Once per duel.',
    },
  },

  archer: {
    id: 'archer',
    name: 'Archer',
    maxHp: 90,
    baseAttack: 20,
    skill: {
      id: 'piercing_shot',
      name: 'Piercing Shot',
      usesPerDuel: 1,
      effects: [{ type: 'damage', amount: 26, guardInteraction: 'bypass' }],
      interruptibleBy: [],
      description: 'Deal 26 piercing damage. Completely ignores Guard. Once per duel.',
    },
  },

  mage: {
    id: 'mage',
    name: 'Mage',
    maxHp: 85,
    baseAttack: 17,
    skill: {
      id: 'arcane_burst',
      name: 'Arcane Burst',
      usesPerDuel: 1,
      effects: [{ type: 'damage', amount: 30, guardInteraction: 'bypass' }],
      interruptibleBy: ['strike'],
      description: 'Deal 30 piercing damage. Cancelled if opponent uses Strike. Once per duel.',
    },
  },

  tank: {
    id: 'tank',
    name: 'Tank',
    maxHp: 120,
    baseAttack: 15,
    skill: {
      id: 'shield_bash',
      name: 'Shield Bash',
      usesPerDuel: 1,
      effects: [
        { type: 'gainShield', amount: 20, timing: 'beforeDamage' },
        { type: 'damage', amount: 18, guardInteraction: 'guardable' },
      ],
      interruptibleBy: [],
      description: 'Gain 20 shield before incoming damage, then deal 18 guardable damage. Once per duel.',
    },
  },

  rogue: {
    id: 'rogue',
    name: 'Rogue',
    maxHp: 95,
    baseAttack: 21,
    skill: {
      id: 'shadow_feint',
      name: 'Shadow Feint',
      usesPerDuel: 1,
      effects: [
        { type: 'damage', amount: 20, guardInteraction: 'guardable' },
        { type: 'reduceNextHit', amount: 12 },
      ],
      interruptibleBy: [],
      description: 'Deal 20 guardable damage. Grants reduceNextHit 12 active on future turns. Once per duel.',
    },
  },

  assassin: {
    id: 'assassin',
    name: 'Assassin',
    maxHp: 80,
    baseAttack: 24,
    skill: {
      id: 'shadow_execution',
      name: 'Shadow Execution',
      usesPerDuel: 1,
      effects: [
        {
          type: 'conditionalDamage',
          baseAmount: 24,
          bonusAmount: 36,
          condition: 'targetHpPercentLte',
          thresholdPercent: 40,
          baseGuard: 'guardable',
          bonusGuard: 'bypass',
        },
      ],
      interruptibleBy: [],
      description: 'Deal 24 guardable damage. If target starts turn at or below 40% max HP, deal 36 execution bypass damage instead. Once per duel.',
    },
  },

  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    maxHp: 110,
    baseAttack: 19,
    skill: {
      id: 'crushing_blow',
      name: 'Crushing Blow',
      usesPerDuel: 1,
      effects: [{ type: 'damage', amount: 28, guardInteraction: 'partial' }],
      interruptibleBy: [],
      description: 'Deal 28 heavy damage. Partially pierces Guard (reduced by 25% instead of 50%, dealing 21). Once per duel.',
    },
  },

  paladin: {
    id: 'paladin',
    name: 'Paladin',
    maxHp: 115,
    baseAttack: 16,
    skill: {
      id: 'aegis_smite',
      name: 'Aegis Smite',
      usesPerDuel: 1,
      effects: [
        { type: 'damage', amount: 22, guardInteraction: 'guardable' },
        { type: 'gainShield', amount: 15, timing: 'afterDamage' },
      ],
      interruptibleBy: [],
      description: 'Deal 22 guardable damage. If Paladin survives this turn, gains 15 shield protecting future turns. Once per duel.',
    },
  },
};

export const GUARD_STANDARD_REDUCTION = 0.50;
export const GUARD_PARTIAL_REDUCTION  = 0.25;
export const DEFAULT_MAX_TURNS        = 6;
export const DEFAULT_SELECTION_MS     = 25_000;
export const DEFAULT_ACTION_MS        = 12_000;

/**
 * Validates domain role definitions on startup (M1):
 * Asserts exactly 8 roles, matching keys, bounded integer stats,
 * and exhaustive validation of skill effects, amounts, guard interactions,
 * and interruptible actions.
 */
export function validateRoleRegistry(registry: Record<string, RoleDefinition>): void {
  const roleKeys = Object.keys(registry);
  if (roleKeys.length !== 8) {
    throw new Error(`Role registry must contain exactly 8 roles, found ${roleKeys.length}`);
  }
  const VALID_GUARD_INTERACTIONS = new Set(['guardable', 'bypass', 'partial']);
  const VALID_ACTION_TYPES = new Set(['strike', 'guard', 'skill']);
  const seenSkillIds = new Set<string>();

  for (const [key, role] of Object.entries(registry)) {
    if (key !== role.id) {
      throw new Error(`Role registry key mismatch: "${key}" !== "${role.id}"`);
    }
    if (!/^[a-z]+$/.test(role.id)) {
      throw new Error(`Role id "${role.id}" must contain lowercase letters only`);
    }
    if (typeof role.name !== 'string' || role.name.trim().length === 0) {
      throw new Error(`Role "${role.id}" missing valid display name`);
    }
    if (!Number.isSafeInteger(role.maxHp) || role.maxHp < 50 || role.maxHp > 200) {
      throw new Error(`Invalid maxHp for role "${role.id}": ${role.maxHp}`);
    }
    if (!Number.isSafeInteger(role.baseAttack) || role.baseAttack < 5 || role.baseAttack > 50) {
      throw new Error(`Invalid baseAttack for role "${role.id}": ${role.baseAttack}`);
    }
    if (!role.skill || typeof role.skill.id !== 'string' || !role.skill.id.trim()) {
      throw new Error(`Missing or invalid skill.id for role "${role.id}"`);
    }
    if (seenSkillIds.has(role.skill.id)) {
      throw new Error(`Duplicate skill.id "${role.skill.id}" across role registry`);
    }
    seenSkillIds.add(role.skill.id);
    if (typeof role.skill.name !== 'string' || role.skill.name.trim().length === 0) {
      throw new Error(`Role "${role.id}" skill missing valid display name`);
    }
    if (typeof role.skill.description !== 'string' || role.skill.description.trim().length === 0) {
      throw new Error(`Role "${role.id}" skill missing description`);
    }
    if (role.skill.usesPerDuel !== 1) {
      throw new Error(`Invalid usesPerDuel for role "${role.id}": must be 1`);
    }
    if (!Array.isArray(role.skill.interruptibleBy)) {
      throw new Error(`interruptibleBy must be an array for role "${role.id}"`);
    }
    if (new Set(role.skill.interruptibleBy).size !== role.skill.interruptibleBy.length) {
      throw new Error(`Duplicate interruptibleBy actions in role "${role.id}"`);
    }
    for (const action of role.skill.interruptibleBy) {
      if (!VALID_ACTION_TYPES.has(action)) {
        throw new Error(`Invalid interruptible action "${action}" in role "${role.id}"`);
      }
    }
    if (!Array.isArray(role.skill.effects) || role.skill.effects.length === 0) {
      throw new Error(`Role "${role.id}" must have at least one skill effect`);
    }

    for (const effect of role.skill.effects) {
      switch (effect.type) {
        case 'damage': {
          if (!Number.isSafeInteger(effect.amount) || effect.amount <= 0 || effect.amount > 100) {
            throw new Error(`Invalid damage amount in role "${role.id}": ${effect.amount}`);
          }
          if (!VALID_GUARD_INTERACTIONS.has(effect.guardInteraction)) {
            throw new Error(`Invalid guardInteraction "${effect.guardInteraction}" in role "${role.id}"`);
          }
          break;
        }
        case 'conditionalDamage': {
          if (!Number.isSafeInteger(effect.baseAmount) || effect.baseAmount <= 0 || effect.baseAmount > 100) {
            throw new Error(`Invalid conditional baseAmount in role "${role.id}": ${effect.baseAmount}`);
          }
          if (!Number.isSafeInteger(effect.bonusAmount) || effect.bonusAmount <= 0 || effect.bonusAmount > 100) {
            throw new Error(`Invalid conditional bonusAmount in role "${role.id}": ${effect.bonusAmount}`);
          }
          if (
            effect.condition !== 'targetHpPercentLte' ||
            !Number.isSafeInteger(effect.thresholdPercent) ||
            effect.thresholdPercent < 1 ||
            effect.thresholdPercent > 99
          ) {
            throw new Error(`Invalid condition or threshold in role "${role.id}": ${effect.thresholdPercent}`);
          }
          if (!VALID_GUARD_INTERACTIONS.has(effect.baseGuard) || !VALID_GUARD_INTERACTIONS.has(effect.bonusGuard)) {
            throw new Error(`Invalid guard interaction in conditional damage for role "${role.id}"`);
          }
          break;
        }
        case 'gainShield': {
          if (!Number.isSafeInteger(effect.amount) || effect.amount <= 0 || effect.amount > 100) {
            throw new Error(`Invalid shield amount in role "${role.id}": ${effect.amount}`);
          }
          if (effect.timing !== 'beforeDamage' && effect.timing !== 'afterDamage') {
            throw new Error(`Invalid shield timing "${effect.timing}" in role "${role.id}"`);
          }
          break;
        }
        case 'reduceNextHit': {
          if (!Number.isSafeInteger(effect.amount) || effect.amount <= 0 || effect.amount > 100) {
            throw new Error(`Invalid reduceNextHit amount in role "${role.id}": ${effect.amount}`);
          }
          break;
        }
        default: {
          throw new Error(`Unknown skill effect type in role "${role.id}"`);
        }
      }
    }
  }
}

export function validateActiveFighterInput(
  state: Readonly<import('./types').FighterCombatState>,
  role: Readonly<RoleDefinition>,
  expectedFighterId: string,
  side: 'A' | 'B',
): void {
  if (state.fighterId !== expectedFighterId) {
    throw new Error(`Side ${side}: state fighterId "${state.fighterId}" does not match duel fighterId "${expectedFighterId}"`);
  }
  if (state.roleId !== role.id) {
    throw new Error(`Side ${side}: roleId "${state.roleId}" does not match definition "${role.id}"`);
  }
  if (!Number.isSafeInteger(state.currentHp) || state.currentHp < 1 || state.currentHp > role.maxHp) {
    throw new Error(`Side ${side}: currentHp ${state.currentHp} invalid (must be safe integer 1..${role.maxHp})`);
  }
  if (!Number.isSafeInteger(state.currentShield) || state.currentShield < 0 || state.currentShield > 200) {
    throw new Error(`Side ${side}: currentShield ${state.currentShield} invalid (must be safe integer 0..200)`);
  }
  if (!Number.isSafeInteger(state.skillUsesRemaining) || state.skillUsesRemaining < 0 || state.skillUsesRemaining > role.skill.usesPerDuel) {
    throw new Error(`Side ${side}: skillUsesRemaining ${state.skillUsesRemaining} invalid (0..${role.skill.usesPerDuel})`);
  }
  if (!Array.isArray(state.statusEffects)) {
    throw new Error(`Side ${side}: statusEffects must be an array`);
  }
  for (const status of state.statusEffects) {
    if (status.type !== 'reduceNextHit' || !Number.isSafeInteger(status.amount) || status.amount <= 0 || status.amount > 100) {
      throw new Error(`Side ${side}: invalid statusEffect ${JSON.stringify(status)}`);
    }
  }
}
