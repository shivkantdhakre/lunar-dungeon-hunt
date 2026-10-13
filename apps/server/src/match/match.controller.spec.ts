import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('MatchController', () => {
  let controller: MatchController;
  let matchService: MatchService;
  let authService: AuthService;
  const testAdminKey = 'test-admin-key-min32chars-for-test';

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'HOST_ADMIN_KEY') return testAdminKey;
        if (key === 'AUTH_SECRET') return 'test-auth-secret-min32chars-very-secure';
        return def;
      }),
    } as unknown as ConfigService;
    authService = new AuthService(config);
    matchService = {
      createMatch: jest.fn().mockImplementation(({ matchId }) => ({ id: matchId, runId: 1 })),
      registerRetirementHook: jest.fn(),
      getPublicSnapshot: jest.fn().mockImplementation((id: string) => {
        if (id === 'non-existent') throw new Error('Not found');
        return {
          matchId: id,
          status: 'lobby',
          scoreA: 0,
          scoreB: 0,
          currentDuelNumber: 1,
          currentTurnNumber: null,
          selectionDeadlineAt: null,
          actionDeadlineAt: null,
          lockedPartyA: false,
          lockedPartyB: false,
          rosterA: [],
          rosterB: [],
        };
      }),
      getMatch: jest.fn().mockImplementation((id: string) => {
        if (id === 'non-existent') throw new Error('Not found');
        return {
          id,
          runId: 1,
          status: 'completed',
          scoreA: 2,
          scoreB: 1,
          currentDuelNumber: 3,
          winningPartySide: 'A',
          partyA: { id: 'partyA', name: 'Party A' },
          partyB: { id: 'partyB', name: 'Party B' },
          duelHistory: [
            { duelNumber: 1, winner: 'A', reason: 'Defeat', roleIdA: 'swordsman', roleIdB: 'mage', resolvedTurns: 4, completedAt: 1000 },
            { duelNumber: 2, winner: 'B', reason: 'Defeat', roleIdA: 'archer', roleIdB: 'tank', resolvedTurns: 5, completedAt: 2000 },
            { duelNumber: 3, winner: 'A', reason: 'Defeat', roleIdA: 'vanguard', roleIdB: 'assassin', resolvedTurns: 3, completedAt: 3000 },
          ],
          auditLog: [
            { event: 'MATCH_CREATED', timestamp: '2026-10-12T00:00:00Z' },
          ],
        };
      }),
      startMatch: jest.fn(),
      pauseMatch: jest.fn(),
      resumeMatch: jest.fn(),
      resetMatch: jest.fn().mockImplementation((id: string) => ({
        match: { id, runId: 2, status: 'lobby' },
        tokens: { host: 'new-host', partyA: 'new-a', partyB: 'new-b', arena: 'new-arena' },
      })),
      overrideMatch: jest.fn().mockImplementation((id: string) => ({ id, runId: 1, status: 'completed' })),
    } as unknown as MatchService;
    controller = new MatchController(config, authService, matchService);
    controller.onModuleInit();
  });

  it('rejects requests with missing or invalid admin key (401)', () => {
    expect(() => controller.createMatch(undefined, 'k-1', { partyAName: 'A', partyBName: 'B' })).toThrow(UnauthorizedException);
    expect(() => controller.createMatch('wrong-key', 'k-1', { partyAName: 'A', partyBName: 'B' })).toThrow(UnauthorizedException);
  });

  it('provisions match and returns structured tokens', () => {
    const res = controller.createMatch(testAdminKey, 'k-1', { partyAName: 'A', partyBName: 'B' });
    expect(typeof res.matchId).toBe('string');
    expect(res.matchId).toHaveLength(36);
    expect(res.runId).toBe(1);
    expect(res.tokens.host).toBeDefined();
    expect(res.tokens.partyA).toBeDefined();
    expect(res.tokens.partyB).toBeDefined();
    expect(res.tokens.arena).toBeDefined();
  });

  it('returns identical cached response on idempotent replay with same body', () => {
    const res1 = controller.createMatch(testAdminKey, 'k-dup', { partyAName: 'A', partyBName: 'B' });
    const res2 = controller.createMatch(testAdminKey, 'k-dup', { partyAName: 'A', partyBName: 'B' });
    expect(res2).toEqual(res1);
  });

  it('rejects reused idempotency key with changed body (400) without creating match', () => {
    controller.createMatch(testAdminKey, 'k-dup-2', { partyAName: 'A', partyBName: 'B' });
    expect(() => controller.createMatch(testAdminKey, 'k-dup-2', { partyAName: 'Altered', partyBName: 'B' })).toThrow(BadRequestException);
  });

  it('gets public snapshot for existing match and throws 404 for unknown match', () => {
    const snapshot = controller.getPublicSnapshot('test-match-1');
    expect(snapshot.matchId).toBe('test-match-1');
    expect(snapshot.status).toBe('lobby');

    expect(() => controller.getPublicSnapshot('non-existent')).toThrow(NotFoundException);
  });

  it('gets match results summary for completed match', () => {
    const results = controller.getMatchResults('test-match-1');
    expect(results.matchId).toBe('test-match-1');
    expect(results.scoreA).toBe(2);
    expect(results.scoreB).toBe(1);
    expect(results.winner).toBe('A');
    expect(results.duelsCompleted).toBe(3);
  });

  it('allows authenticated host to view audit log and blocks unauthenticated requests', async () => {
    await expect(controller.getAuditLog('test-match-1', 'wrong-key')).rejects.toThrow(UnauthorizedException);

    const audit = await controller.getAuditLog('test-match-1', testAdminKey);
    expect(audit.matchId).toBe('test-match-1');
    expect(audit.auditLog).toHaveLength(1);
  });

  it('allows authenticated host to start, pause, resume, and reset a match', async () => {
    const startRes = await controller.startMatch('test-match-1', testAdminKey);
    expect(startRes).toBeDefined();
    expect(matchService.startMatch).toHaveBeenCalledWith('test-match-1');

    const pauseRes = await controller.pauseMatch('test-match-1', { reason: 'Timeout' }, testAdminKey);
    expect(pauseRes).toBeDefined();
    expect(matchService.pauseMatch).toHaveBeenCalledWith('test-match-1', 'Timeout');

    const resumeRes = await controller.resumeMatch('test-match-1', testAdminKey);
    expect(resumeRes).toBeDefined();
    expect(matchService.resumeMatch).toHaveBeenCalledWith('test-match-1');

    const resetRes = await controller.resetMatch('test-match-1', { reason: 'Rematch' }, testAdminKey);
    expect(resetRes.runId).toBe(2);
    expect(resetRes.tokens.host).toBe('new-host');
  });

  it('allows authenticated host to execute administrative override', async () => {
    await expect(
      controller.overrideMatch('test-match-1', { operation: 'declareDuelWinner', reason: '', winnerSide: 'A' }, testAdminKey)
    ).rejects.toThrow(BadRequestException);

    const overrideRes = await controller.overrideMatch(
      'test-match-1',
      { operation: 'declareDuelWinner', reason: 'Judges decision', winnerSide: 'A' },
      testAdminKey
    );
    expect(overrideRes).toBeDefined();
    expect(matchService.overrideMatch).toHaveBeenCalledWith('test-match-1', 'declareDuelWinner', 'Judges decision', 'host-admin', 'A');
  });
});
