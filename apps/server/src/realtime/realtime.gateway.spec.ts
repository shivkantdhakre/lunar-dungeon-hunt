import { RealtimeGateway } from './realtime.gateway';
import { MatchService } from '../match/match.service';
import { TieBreakService } from '../match/tie-break.service';
import { DuelHistoryStore } from '../match/duel-history.store';
import { PinoLogger } from 'nestjs-pino';

describe('RealtimeGateway Transaction Boundaries & Event Aliases', () => {
  let gateway: RealtimeGateway;
  let matchService: MatchService;
  let mockServer: {
    to: jest.Mock;
    in: jest.Mock;
    emit: jest.Mock;
    disconnectSockets: jest.Mock;
  };

  beforeEach(() => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      disconnectSockets: jest.fn(),
    };
    matchService = {
      getMatch: jest.fn().mockReturnValue({ runId: 1 }),
      runMatchTransition: jest.fn((id, fn) => fn()),
      submitAction: jest.fn(),
      selectFighter: jest.fn(),
      lockFighter: jest.fn().mockReturnValue({ duelStarted: false }),
      pauseMatch: jest.fn(),
      resumeMatch: jest.fn(),
      resetMatch: jest.fn().mockReturnValue({
        match: { runId: 2 },
        tokens: { host: 'h2', partyA: 'a2', partyB: 'b2', arena: 'ar2' },
      }),
      overrideMatch: jest.fn(),
      getPrivatePartySnapshot: jest.fn((id, side) => ({
        matchId: 'm-1',
        partyId: `party-${side}`,
        partySide: side || 'A',
        roster: [],
        selectedFighterId: null,
        fighterLocked: false,
        selectedAction: null,
        actionLocked: false,
        selectedSuddenDeathAction: null,
        suddenDeathActionLocked: false,
        selectionDeadlineAt: null,
        actionDeadlineAt: null,
      })),
      getPublicSnapshot: jest.fn().mockReturnValue({
        matchId: 'm-1',
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
      }),
    } as unknown as MatchService;
    const tieBreak = new TieBreakService();
    const history = new DuelHistoryStore();

    gateway = new RealtimeGateway(logger, matchService, tieBreak, history);
    gateway.server = mockServer as unknown as typeof gateway.server;
  });

  it('does NOT emit duel:actionLocked if combat resolution throws an exception', async () => {
    const rollbackSpy = jest.fn();
    (matchService.submitAction as jest.Mock).mockReturnValue({
      duplicate: false,
      bothLocked: true,
      match: { currentDuel: { status: 'dueling' } },
      actionA: 'strike',
      actionB: 'strike',
      rollback: rollbackSpy,
    });

    const mockSocket = {
      data: { matchId: 'm-1', runId: 1, role: 'party', partySide: 'A' },
      emit: jest.fn(),
    } as unknown as Parameters<typeof gateway.handleSubmitAction>[1];

    await expect(
      gateway.handleSubmitAction(
        {
          matchId: 'm-1',
          duelId: 'd-1',
          turnNumber: 1,
          commandId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          actionType: 'strike',
        },
        mockSocket,
      ),
    ).rejects.toThrow();

    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(mockServer.emit).not.toHaveBeenCalledWith('duel:actionLocked', expect.anything());
  });

  it('routes pick:submit, pick:lock, and action:submit aliases correctly', async () => {
    const mockSocket = {
      data: { matchId: 'm-1', runId: 1, role: 'party', partySide: 'A' },
      emit: jest.fn(),
    } as unknown as Parameters<typeof gateway.handleSelectFighter>[1];

    await gateway.handlePickSubmitAlias(
      { matchId: 'm-1', duelId: 'd-1', fighterId: 'f-1' },
      mockSocket,
    );
    expect(matchService.selectFighter).toHaveBeenCalledWith('m-1', 'A', 'd-1', 'f-1');

    await gateway.handlePickLockAlias(
      { matchId: 'm-1', duelId: 'd-1', fighterId: 'f-1' },
      mockSocket,
    );
    expect(matchService.lockFighter).toHaveBeenCalledWith('m-1', 'A', 'd-1', 'f-1');
  });

  it('allows authenticated host to execute host:override', async () => {
    const hostSocket = {
      data: { matchId: 'm-1', runId: 1, role: 'host', userId: 'host-1' },
      emit: jest.fn(),
    } as unknown as Parameters<typeof gateway.handleHostOverride>[1];

    await gateway.handleHostOverride(
      {
        matchId: 'm-1',
        operation: 'declareDuelWinner',
        winnerSide: 'A',
        reason: 'Judges ruling',
      },
      hostSocket,
    );

    expect(matchService.overrideMatch).toHaveBeenCalledWith(
      'm-1',
      'declareDuelWinner',
      'Judges ruling',
      'host-1',
      'A',
    );
  });

  it('rejects non-host from executing host:override', async () => {
    const partySocket = {
      data: { matchId: 'm-1', runId: 1, role: 'party', partySide: 'A' },
      emit: jest.fn(),
    } as unknown as Parameters<typeof gateway.handleHostOverride>[1];

    await gateway.handleHostOverride(
      {
        matchId: 'm-1',
        operation: 'forcePhase',
        reason: 'Exploit attempt',
      },
      partySocket,
    );

    expect(partySocket.emit).toHaveBeenCalledWith('match:error', expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(matchService.overrideMatch).not.toHaveBeenCalled();
  });
});
