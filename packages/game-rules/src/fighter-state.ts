import type { FighterCombatState, RoleDefinition } from './types';
import { ROLES } from './roles';

/**
 * Creates an authoritative initial combat state for a fighter based on role definitions.
 */
export function createFighterCombatState(
  fighterId: string,
  roleId: string,
  customRole?: RoleDefinition,
): FighterCombatState {
  const roleDef = customRole ?? ROLES[roleId];
  if (!roleDef) {
    throw new Error(`Unknown roleId: "${roleId}"`);
  }
  return {
    fighterId,
    roleId,
    currentHp: roleDef.maxHp,
    currentShield: 0,
    skillUsesRemaining: roleDef.skill.usesPerDuel,
    statusEffects: [],
  };
}

/**
 * Validates that a fighter's runtime combat state adheres to domain bounds.
 */
export function validateFighterStateBounds(
  state: FighterCombatState,
  roleDef: RoleDefinition,
): void {
  if (state.currentHp < 0 || state.currentHp > roleDef.maxHp) {
    throw new Error(
      `Fighter "${state.fighterId}" currentHp (${state.currentHp}) out of bounds [0, ${roleDef.maxHp}]`,
    );
  }
  if (state.currentShield < 0) {
    throw new Error(
      `Fighter "${state.fighterId}" currentShield (${state.currentShield}) cannot be negative`,
    );
  }
  if (
    state.skillUsesRemaining < 0 ||
    state.skillUsesRemaining > roleDef.skill.usesPerDuel
  ) {
    throw new Error(
      `Fighter "${state.fighterId}" skillUsesRemaining (${state.skillUsesRemaining}) out of bounds [0, ${roleDef.skill.usesPerDuel}]`,
    );
  }
}
