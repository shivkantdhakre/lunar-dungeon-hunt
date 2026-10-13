import { z } from 'zod';
import * as schemas from './schemas';

export * from './schemas';

// ── Inferred Payload Types (100% Schema Parity) ──────────────────────────────

export type PingPayload = z.infer<typeof schemas.PingPayloadSchema>;
export type MatchJoinPayload = z.infer<typeof schemas.MatchJoinPayloadSchema>;
export type MatchCreatePayload = z.infer<typeof schemas.MatchCreatePayloadSchema>;
export type MatchStartPayload = z.infer<typeof schemas.MatchStartPayloadSchema>;
export type MatchPausePayload = z.infer<typeof schemas.MatchPausePayloadSchema>;
export type MatchResumePayload = z.infer<typeof schemas.MatchResumePayloadSchema>;
export type MatchResetPayload = z.infer<typeof schemas.MatchResetPayloadSchema>;
export type SelectFighterPayload = z.infer<typeof schemas.SelectFighterPayloadSchema>;
export type LockFighterPayload = z.infer<typeof schemas.LockFighterPayloadSchema>;
export type SubmitActionPayload = z.infer<typeof schemas.SubmitActionPayloadSchema>;
export type SubmitSuddenDeathActionPayload = z.infer<typeof schemas.SubmitSuddenDeathActionPayloadSchema>;
export type HostOverridePayload = z.infer<typeof schemas.HostOverridePayloadSchema>;

export type PublicFighter = z.infer<typeof schemas.PublicFighterSchema>;
export type PublicMatchSnapshot = z.infer<typeof schemas.PublicMatchSnapshotSchema>;
export type PrivatePartySnapshot = z.infer<typeof schemas.PrivatePartySnapshotSchema>;

export type PongPayload = z.infer<typeof schemas.PongPayloadSchema>;
export type MatchErrorPayload = z.infer<typeof schemas.MatchErrorPayloadSchema>;
export type DuelFighterLockedPayload = z.infer<typeof schemas.DuelFighterLockedPayloadSchema>;
export type DuelFightersRevealedPayload = z.infer<typeof schemas.DuelFightersRevealedPayloadSchema>;
export type DuelActionLockedPayload = z.infer<typeof schemas.DuelActionLockedPayloadSchema>;
export type CombatLogEntry = z.infer<typeof schemas.CombatLogEntrySchema>;
export type DuelTurnResolvedPayload = z.infer<typeof schemas.DuelTurnResolvedPayloadSchema>;
export type DuelSuddenDeathStartedPayload = z.infer<typeof schemas.DuelSuddenDeathStartedPayloadSchema>;
export type DuelCompletedPayload = z.infer<typeof schemas.DuelCompletedPayloadSchema>;
export type MatchCompletedPayload = z.infer<typeof schemas.MatchCompletedPayloadSchema>;
export type MatchTokensRotatedPayload = z.infer<typeof schemas.MatchTokensRotatedPayloadSchema>;

export interface ClientToServerEvents {
  ping: (payload: PingPayload) => void;
  'match:join': (payload: MatchJoinPayload) => void;
  'match:start': (payload: MatchStartPayload) => void;
  'match:pause': (payload: MatchPausePayload) => void;
  'match:resume': (payload: MatchResumePayload) => void;
  'match:reset': (payload: MatchResetPayload) => void;
  'host:override': (payload: HostOverridePayload) => void;
  'duel:selectFighter': (payload: SelectFighterPayload) => void;
  'duel:lockFighter': (payload: LockFighterPayload) => void;
  'duel:submitAction': (payload: SubmitActionPayload) => void;
  'duel:submitSuddenDeathAction': (payload: SubmitSuddenDeathActionPayload) => void;
  // Documented event aliases (FRD / PRD parity)
  'pick:submit': (payload: SelectFighterPayload) => void;
  'pick:lock': (payload: LockFighterPayload) => void;
  'action:submit': (payload: SubmitActionPayload) => void;
  'action:lock': (payload: SubmitActionPayload) => void;
  'host:pause': (payload: MatchPausePayload) => void;
  'host:resume': (payload: MatchResumePayload) => void;
  'host:reset': (payload: MatchResetPayload) => void;
}

export interface ServerToClientEvents {
  pong: (payload: PongPayload) => void;
  'match:error': (payload: MatchErrorPayload) => void;
  'match:state': (payload: PublicMatchSnapshot) => void;
  'party:state': (payload: PrivatePartySnapshot) => void;
  'duel:fighterLocked': (payload: DuelFighterLockedPayload) => void;
  'duel:fightersRevealed': (payload: DuelFightersRevealedPayload) => void;
  'duel:actionLocked': (payload: DuelActionLockedPayload) => void;
  'duel:turnResolved': (payload: DuelTurnResolvedPayload) => void;
  'duel:suddenDeathStarted': (payload: DuelSuddenDeathStartedPayload) => void;
  'duel:completed': (payload: DuelCompletedPayload) => void;
  'match:completed': (payload: MatchCompletedPayload) => void;
  'match:tokensRotated': (payload: MatchTokensRotatedPayload) => void;
}

// ── Outbound Event Runtime Validation Map (P2.2) ─────────────────────────────
export const SERVER_TO_CLIENT_EVENT_SCHEMAS = {
  pong: schemas.PongPayloadSchema,
  'match:error': schemas.MatchErrorPayloadSchema,
  'match:state': schemas.PublicMatchSnapshotSchema,
  'party:state': schemas.PrivatePartySnapshotSchema,
  'duel:fighterLocked': schemas.DuelFighterLockedPayloadSchema,
  'duel:fightersRevealed': schemas.DuelFightersRevealedPayloadSchema,
  'duel:actionLocked': schemas.DuelActionLockedPayloadSchema,
  'duel:turnResolved': schemas.DuelTurnResolvedPayloadSchema,
  'duel:suddenDeathStarted': schemas.DuelSuddenDeathStartedPayloadSchema,
  'duel:completed': schemas.DuelCompletedPayloadSchema,
  'match:completed': schemas.MatchCompletedPayloadSchema,
  'match:tokensRotated': schemas.MatchTokensRotatedPayloadSchema,
} as const;

export function validateServerEvent<K extends keyof ServerToClientEvents>(
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0],
): Parameters<ServerToClientEvents[K]>[0] {
  const schema = SERVER_TO_CLIENT_EVENT_SCHEMAS[event as keyof typeof SERVER_TO_CLIENT_EVENT_SCHEMAS];
  if (!schema) {
    throw new Error(`Undeclared outbound event: ${String(event)}`);
  }
  return schema.parse(payload) as Parameters<ServerToClientEvents[K]>[0];
}
