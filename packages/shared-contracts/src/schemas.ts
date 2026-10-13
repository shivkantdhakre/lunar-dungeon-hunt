import { z } from 'zod';

// ── Client-to-Server Event Schemas ──────────────────────────────────────────

export const PingPayloadSchema = z.object({
  requestId: z.string().uuid(),
  sentAt: z.number().int().positive(),
}).strict();

export const MatchJoinPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
}).strict();

export const MatchCreatePayloadSchema = z.object({
  partyAName: z.string().min(1).max(32),
  partyBName: z.string().min(1).max(32),
  rosterRolesA: z.array(z.string().min(1).max(32)).length(5).optional(),
  rosterRolesB: z.array(z.string().min(1).max(32)).length(5).optional(),
}).strict();

export const MatchStartPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
}).strict();

export const MatchPausePayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  reason: z.string().max(100).optional(),
}).strict();

export const MatchResumePayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
}).strict();

export const MatchResetPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  reason: z.string().min(1).max(100),
}).strict();

export const SelectFighterPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  duelId: z.string().min(1).max(64),
  fighterId: z.string().min(1).max(64),
}).strict();

export const LockFighterPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  duelId: z.string().min(1).max(64),
  fighterId: z.string().min(1).max(64),
}).strict();

export const SubmitActionPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  duelId: z.string().min(1).max(64),
  turnNumber: z.number().int().min(1).max(6),
  actionType: z.enum(['strike', 'guard', 'skill']),
  commandId: z.string().uuid(),
}).strict();

export const SubmitSuddenDeathActionPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  duelId: z.string().min(1).max(64),
  actionType: z.enum(['strike', 'guard']),
  commandId: z.string().uuid(),
}).strict();

export const HostOverridePayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  operation: z.enum(['forcePhase', 'forceNextDuel', 'declareDuelWinner']),
  winnerSide: z.enum(['A', 'B']).optional(),
  reason: z.string().min(1).max(256),
}).strict();

// ── Shared Domain Data Models ───────────────────────────────────────────────

export const StatusEffectSchema = z.object({
  type: z.literal('reduceNextHit'),
  amount: z.number().int().min(1).max(100),
}).strict();

export const FighterStateSchema = z.object({
  fighterId: z.string().min(1).max(64),
  roleId: z.string().min(1).max(32),
  currentHp: z.number().int().min(0).max(150),
  maxHp: z.number().int().min(1).max(150),
  currentShield: z.number().int().min(0).max(200),
  skillUsesRemaining: z.number().int().min(0).max(5),
  statusEffects: z.array(StatusEffectSchema),
  used: z.boolean(),
}).strict().refine(f => f.currentHp <= f.maxHp, {
  message: 'currentHp cannot exceed maxHp',
});

export const PublicFighterSchema = z.object({
  id: z.string().min(1).max(64),
  roleId: z.string().min(1).max(32),
  maxHp: z.number().int().positive(),
  currentHp: z.number().int().nonnegative(),
  currentShield: z.number().int().min(0).max(200),
}).strict().refine(f => f.currentHp <= f.maxHp, {
  message: 'currentHp cannot exceed maxHp',
});

export const PublicRosterMemberSchema = z.object({
  fighterId: z.string().min(1).max(64),
  roleId: z.string().min(1).max(32),
  used: z.boolean(),
}).strict();

export const PublicMatchSnapshotSchema = z.object({
  matchId: z.string().min(1).max(64),
  status: z.enum(['lobby', 'picking', 'dueling', 'suddenDeath', 'paused', 'completed']),
  partyAName: z.string().min(1).max(32).optional(),
  partyBName: z.string().min(1).max(32).optional(),
  scoreA: z.number().int().min(0).max(2),
  scoreB: z.number().int().min(0).max(2),
  currentDuelNumber: z.number().int().min(1).max(3),
  currentTurnNumber: z.number().int().min(1).max(6).nullable(),
  selectionDeadlineAt: z.number().int().positive().nullable(),
  actionDeadlineAt: z.number().int().positive().nullable(),
  lockedPartyA: z.boolean(),
  lockedPartyB: z.boolean(),
  pauseReason: z.string().optional(),
  rosterA: z.array(PublicRosterMemberSchema),
  rosterB: z.array(PublicRosterMemberSchema),
  activeFighterA: PublicFighterSchema.optional().nullable(),
  activeFighterB: PublicFighterSchema.optional().nullable(),
}).strict();

export const PrivatePartySnapshotSchema = z.object({
  matchId: z.string().min(1).max(64),
  partyId: z.string().min(1).max(64),
  partySide: z.enum(['A', 'B']),
  roster: z.array(PublicRosterMemberSchema),
  selectedFighterId: z.string().min(1).max(64).nullable(),
  fighterLocked: z.boolean(),
  selectedAction: z.enum(['strike', 'guard', 'skill']).nullable(),
  actionLocked: z.boolean(),
  selectedSuddenDeathAction: z.enum(['strike', 'guard']).nullable(),
  suddenDeathActionLocked: z.boolean(),
  selectionDeadlineAt: z.number().int().positive().nullable(),
  actionDeadlineAt: z.number().int().positive().nullable(),
}).strict();

// ── Outbound Server-to-Client Event Schemas ─────────────────────────────────

export const PongPayloadSchema = z.object({
  requestId: z.string().uuid(),
  serverReceivedAt: z.number().int().positive(),
}).strict();

export const MatchErrorPayloadSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(256),
  commandId: z.string().uuid().optional(),
}).strict();

export const DuelFighterLockedPayloadSchema = z.object({
  partySide: z.enum(['A', 'B']),
}).strict();

export const DuelFightersRevealedPayloadSchema = z.object({
  fighterA: PublicFighterSchema,
  fighterB: PublicFighterSchema,
}).strict();

export const DuelActionLockedPayloadSchema = z.object({
  partySide: z.enum(['A', 'B']),
}).strict();

export const CombatLogEntrySchema = z.object({
  actor: z.enum(['A', 'B', 'system']),
  event: z.string().max(256),
}).strict();

export const DuelTurnResolvedPayloadSchema = z.object({
  turnNumber: z.number().int().positive(),
  stateA: PublicFighterSchema,
  stateB: PublicFighterSchema,
  combatLog: z.array(CombatLogEntrySchema),
}).strict();

export const DuelSuddenDeathStartedPayloadSchema = z.object({
  fighterA: PublicFighterSchema,
  fighterB: PublicFighterSchema,
}).strict();

export const DuelCompletedPayloadSchema = z.object({
  winnerPartySide: z.enum(['A', 'B']),
  reason: z.string().min(1).max(64),
  scoreA: z.number().int().min(0).max(2),
  scoreB: z.number().int().min(0).max(2),
}).strict();

export const MatchCompletedPayloadSchema = z.object({
  winningPartySide: z.enum(['A', 'B']),
  finalScoreA: z.number().int().min(0).max(2),
  finalScoreB: z.number().int().min(0).max(2),
}).strict();

// P0.2, P1.3: Rotated credentials payload schema for authorized match session re-keying
export const MatchTokensRotatedPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  runId: z.number().int().positive(),
  tokens: z.object({
    host: z.string().min(1),
    partyA: z.string().min(1),
    partyB: z.string().min(1),
    arena: z.string().min(1),
  }).strict(),
}).strict();
