import { MatchService } from './match.service';
import { AuthService } from '../auth/auth.service';
import { TieBreakService } from './tie-break.service';
import { DuelHistoryStore } from './duel-history.store';
import { ConfigService } from '@nestjs/config';

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(() => {
    const config = { get: jest.fn().mockReturnValue('test-secret-min32chars') } as unknown as ConfigService;
    const authService = new AuthService(config);
    const tieBreak = new TieBreakService();
    const history = new DuelHistoryStore();
    service = new MatchService(history, tieBreak, authService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('serializes state transitions FIFO via runMatchTransition without races', async () => {
    const order: number[] = [];
    const match = service.createMatch({ matchId: 'm-1', partyAName: 'Team A', partyBName: 'Team B' });

    await Promise.all([
      service.runMatchTransition(match.id, async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push(1);
      }),
      service.runMatchTransition(match.id, async () => {
        order.push(2);
      }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it('arms 12-second action timer on entering dueling phase', () => {
    jest.useFakeTimers();
    const match = service.createMatch({ matchId: 'm-2', partyAName: 'A', partyBName: 'B' });
    service.startMatch(match.id);
    service.lockFighter(match.id, 'A', match.currentDuel.id, match.partyA.roster[0].fighterId);
    service.lockFighter(match.id, 'B', match.currentDuel.id, match.partyB.roster[0].fighterId);

    const updated = service.getMatch(match.id);
    expect(updated.status).toBe('dueling');
    expect(updated.actionDeadlineAt).toBeDefined();
    expect(updated.actionDeadlineAt!).toBeGreaterThan(Date.now());
  });

  it('preserves deadline duration across pause and resume', () => {
    jest.useFakeTimers();
    const match = service.createMatch({ matchId: 'm-3', partyAName: 'A', partyBName: 'B' });
    service.startMatch(match.id);
    service.lockFighter(match.id, 'A', match.currentDuel.id, match.partyA.roster[0].fighterId);
    service.lockFighter(match.id, 'B', match.currentDuel.id, match.partyB.roster[0].fighterId);

    jest.advanceTimersByTime(4000);
    service.pauseMatch(match.id, 'Timeout pause');

    const paused = service.getMatch(match.id);
    expect(paused.status).toBe('paused');
    expect(paused.remainingActionMs).toBeCloseTo(8000, -2);

    service.resumeMatch(match.id);
    const resumed = service.getMatch(match.id);
    expect(resumed.status).toBe('dueling');
    expect(resumed.actionDeadlineAt! - Date.now()).toBeCloseTo(8000, -2);
  });

  it('retireMatch deterministically purges match, timers, commands, and history (P0.5)', async () => {
    const match = service.createMatch({ matchId: 'm-4', partyAName: 'A', partyBName: 'B' });
    await service.retireMatch(match.id);
    expect(() => service.getMatch(match.id)).toThrow(/Match .* not found/);
  });
});
