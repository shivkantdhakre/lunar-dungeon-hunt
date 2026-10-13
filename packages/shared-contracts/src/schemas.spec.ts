import {
  PingPayloadSchema,
  SubmitActionPayloadSchema,
  PrivatePartySnapshotSchema,
} from './schemas';

describe('Shared Contracts Zod Schemas', () => {
  it('validates a valid PingPayload', () => {
    const valid = { requestId: '123e4567-e89b-12d3-a456-426614174000', sentAt: Date.now() };
    expect(PingPayloadSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an invalid actionType in SubmitActionPayload', () => {
    const invalid = {
      matchId: 'm1',
      duelId: 'd1',
      turnNumber: 1,
      actionType: 'invalid_action',
      commandId: '123e4567-e89b-12d3-a456-426614174000',
    };
    expect(() => SubmitActionPayloadSchema.parse(invalid)).toThrow();
  });

  it('validates PrivatePartySnapshot with sudden-death and deadline fields', () => {
    const snapshot = {
      matchId: 'm1',
      partyId: 'pA',
      partySide: 'A' as const,
      roster: [{ fighterId: 'f1', roleId: 'swordsman', used: false }],
      selectedFighterId: 'f1',
      fighterLocked: true,
      selectedAction: 'strike' as const,
      actionLocked: true,
      selectedSuddenDeathAction: null,
      suddenDeathActionLocked: false,
      selectionDeadlineAt: null,
      actionDeadlineAt: Date.now() + 12000,
    };
    expect(PrivatePartySnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });
});
