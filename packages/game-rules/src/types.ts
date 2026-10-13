export type ActionType = 'strike' | 'guard' | 'skill';
export type GuardInteraction = 'guardable' | 'bypass' | 'partial';

// ── Skill Effects ─────────────────────────────────────────────────────────────

export type SkillEffect =
  | {
      type: 'damage';
      amount: number;
      guardInteraction: GuardInteraction;
    }
  | {
      type: 'conditionalDamage';
      baseAmount: number;
      bonusAmount: number;
      condition: 'targetHpPercentLte';
      thresholdPercent: number; // e.g. 40 for 40%
      baseGuard: GuardInteraction;
      bonusGuard: GuardInteraction;
    }
  | {
      type: 'gainShield';
      amount: number;
      timing: 'beforeDamage' | 'afterDamage';
    }
  | {
      type: 'reduceNextHit';
      amount: number;
    };

export interface RoleSkill {
  id: string;
  name: string;
  usesPerDuel: number;
  effects: SkillEffect[];
  interruptibleBy: ActionType[];
  description: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  maxHp: number;
  baseAttack: number;
  skill: RoleSkill;
}

// ── Combat State & Actions ───────────────────────────────────────────────────

export interface StatusEffect {
  type: 'reduceNextHit';
  amount: number;
}

export interface FighterCombatState {
  fighterId: string;
  roleId: string;
  currentHp: number;
  currentShield: number;
  skillUsesRemaining: number;
  statusEffects: StatusEffect[];
}

export interface CombatAction {
  actionType: ActionType;
}

export interface SuddenDeathAction {
  actionType: 'strike' | 'guard';
}

// ── Turn & Duel Resolution ────────────────────────────────────────────────────

export type TurnStatus =
  | {
      kind: 'continue';
    }
  | {
      kind: 'enterSuddenDeath';
      rollbackStateA: FighterCombatState;
      rollbackStateB: FighterCombatState;
    }
  | {
      kind: 'needsDigitalTieBreak';
      reason: 'turnLimitHpAndShieldEqual';
    }
  | {
      kind: 'duelComplete';
      winner: 'A' | 'B';
      reason: 'knockout' | 'turnLimitHP' | 'turnLimitShield';
    };

export interface CombatLogEntry {
  actor: 'A' | 'B' | 'system';
  event: string;
}

export interface TurnResolution {
  nextStateA: FighterCombatState;
  nextStateB: FighterCombatState;
  combatLog: CombatLogEntry[];
  status: TurnStatus;
  resolvedTurnNumber: number; // 1-indexed count of normal turns completed
}

export type SuddenDeathOutcome =
  | {
      isComplete: true;
      winner: 'A' | 'B';
      reason: 'suddenDeathKnockout' | 'suddenDeathHP' | 'suddenDeathShield' | 'suddenDeathDoubleKnockoutShield';
      combatLog: CombatLogEntry[];
      nextStateA: FighterCombatState;
      nextStateB: FighterCombatState;
    }
  | {
      isComplete: false;
      needsDigitalTieBreak: true;
      reason: 'suddenDeathHpAndShieldEqual' | 'suddenDeathDoubleKnockoutShieldEqual';
      combatLog: CombatLogEntry[];
      nextStateA: FighterCombatState;
      nextStateB: FighterCombatState;
    };

export interface DuelState {
  id: string;
  roleA: RoleDefinition;
  roleB: RoleDefinition;
  fighterIdA: string;
  fighterIdB: string;
  stateA: FighterCombatState;
  stateB: FighterCombatState;
  resolvedTurns: number;
  maxTurns: number;
  status: 'picking' | 'dueling' | 'suddenDeath' | 'completed';
  winner?: 'A' | 'B';
  finalizedAt?: number;
}

export function cloneCombatState(state: FighterCombatState): FighterCombatState {
  return {
    ...state,
    statusEffects: state.statusEffects.map((effect) => ({ ...effect })),
  };
}

