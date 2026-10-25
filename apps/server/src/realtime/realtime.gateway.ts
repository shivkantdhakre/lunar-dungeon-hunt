import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsExceptionsFilter } from '../filters/ws-exceptions.filter';
import { MatchService, ActiveDuelState } from '../match/match.service';
import { TieBreakService } from '../match/tie-break.service';
import { DuelHistoryStore } from '../match/duel-history.store'; // P0.2: Import injected history store
import { resolveTurn, resolveSuddenDeath, FighterCombatState, RoleDefinition } from '@dungeon-hunt/game-rules';
import { handleNormalTurnResolution, handleSuddenDeathResolution } from '../combat/duel-finalizer';
import {
  PingPayloadSchema,
  MatchJoinPayloadSchema,
  SelectFighterPayloadSchema,
  LockFighterPayloadSchema,
  SubmitActionPayloadSchema,
  SubmitSuddenDeathActionPayloadSchema,
  MatchStartPayloadSchema,
  MatchPausePayloadSchema,
  MatchResumePayloadSchema,
  MatchResetPayloadSchema,
  HostOverridePayloadSchema,
  ClientToServerEvents,
  ServerToClientEvents,
  PublicFighter,
  validateServerEvent,
} from '@dungeon-hunt/shared-contracts';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

export interface AuthSocketData {
  authenticated: boolean;
  matchId: string;
  userId: string;
  role: 'host' | 'party' | 'arena';
  partySide?: 'A' | 'B';
  runId: number; // P0.4: Unified numeric runId bound to active match runId
  exp?: number;  // P1.4: Verified token expiration timestamp (epoch seconds)
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, AuthSocketData>;

function toPublicFighter(state: FighterCombatState, role: RoleDefinition): PublicFighter {
  return {
    id: state.fighterId,
    roleId: role.id,
    maxHp: role.maxHp,
    currentHp: state.currentHp,
    currentShield: state.currentShield,
  };
}

@UseFilters(WsExceptionsFilter)
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: AppServer;

  constructor(
    @InjectPinoLogger(RealtimeGateway.name) private readonly logger: PinoLogger,
    private readonly matchService: MatchService,
    private readonly tieBreakService: TieBreakService,
    private readonly duelHistoryStore: DuelHistoryStore,
  ) {}

  afterInit(_server: Server) {
    // P0.4: Wire authoritative event publisher from MatchService to Socket.IO gateway
    this.matchService.setEventPublisher({
      emitToMatch: (matchId, event, payload) => {
        this.emitValidated(
          `match:${matchId}`,
          event as keyof ServerToClientEvents,
          payload as Parameters<ServerToClientEvents[keyof ServerToClientEvents]>[0],
        );
      },
      emitToParty: (matchId, partySide, event, payload) => {
        this.emitValidated(
          `match:${matchId}:party${partySide}`,
          event as keyof ServerToClientEvents,
          payload as Parameters<ServerToClientEvents[keyof ServerToClientEvents]>[0],
        );
      },
      broadcastSnapshots: (matchId) => {
        this.emitValidated(`match:${matchId}`, 'match:state', this.matchService.getPublicSnapshot(matchId));
        this.broadcastPrivateSnapshots(matchId);
      },
    });
  }

  private emitValidated<K extends keyof ServerToClientEvents>(
    target: string | AppSocket,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    // P0.1, P1.5, P1.7: Strictly typed outbound event-schema validation helper
    validateServerEvent(event, payload);
    if (typeof target === 'string') {
      (this.server.to(target).emit as (ev: K, data: Parameters<ServerToClientEvents[K]>[0]) => boolean)(event, payload);
    } else {
      (target.emit as (ev: K, data: Parameters<ServerToClientEvents[K]>[0]) => boolean)(event, payload);
    }
  }

  private validateClientRun(client: AppSocket): boolean {
    try {
      // P1.4: Check token expiration on every event
      if (client.data.exp && Date.now() >= client.data.exp * 1000) {
        client.emit('match:error', {
          code: 'SESSION_EXPIRED',
          message: 'Token session has expired.',
        });
        client.disconnect(true);
        return false;
      }

      const match = this.matchService.getMatch(client.data.matchId);
      if (match.runId !== client.data.runId) {
        client.emit('match:error', {
          code: 'UNAUTHORIZED',
          message: 'Stale token session for previous run.',
        });
        client.disconnect(true); // P1.3: Disconnect stale run socket
        return false;
      }
      return true;
    } catch {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Match not found.' });
      client.disconnect(true);
      return false;
    }
  }

  private broadcastPrivateSnapshots(matchId: string): void {
    // H4, P1.7: Authoritative party private snapshot distribution through emitValidated
    this.emitValidated(`match:${matchId}:partyA`, 'party:state', this.matchService.getPrivatePartySnapshot(matchId, 'A'));
    this.emitValidated(`match:${matchId}:partyB`, 'party:state', this.matchService.getPrivatePartySnapshot(matchId, 'B'));
  }

  handleConnection(client: AppSocket) {
    const { matchId, role, partySide, runId } = client.data;

    let match;
    try {
      match = this.matchService.getMatch(matchId);
    } catch {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Match not found' });
      client.disconnect(true);
      return;
    }

    if (match.runId !== runId) {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Stale token session for previous run' });
      client.disconnect(true);
      return;
    }

    // Auto-join isolated rooms
    client.join(`match:${matchId}`);
    if (role === 'party' && partySide) {
      client.join(`match:${matchId}:party${partySide}`);
    } else if (role === 'host') {
      client.join(`match:${matchId}:host`);
    } else if (role === 'arena') {
      client.join(`match:${matchId}:arena`);
    }

    // P1.8: Immediately resynchronize authorized state snapshots upon connection
    this.emitValidated(client, 'match:state', this.matchService.getPublicSnapshot(matchId));
    if (role === 'party' && partySide) {
      this.emitValidated(client, 'party:state', this.matchService.getPrivatePartySnapshot(matchId, partySide));
    }

    this.logger.info({ socketId: client.id, matchId, role, partySide, runId }, 'Client authenticated, joined rooms, and synchronized state');
  }

  handleDisconnect(client: AppSocket) {
    this.logger.info({ socketId: client.id }, 'Client disconnected');
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): void {
    if (!this.validateClientRun(client)) return; // P1.3, P1.4: Check run & expiry on ping
    const payload = PingPayloadSchema.parse(rawPayload);
    client.emit('pong', { requestId: payload.requestId, serverReceivedAt: Date.now() });
  }

  @SubscribeMessage('match:join')
  handleMatchJoin(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): void {
    if (!this.validateClientRun(client)) return;
    const payload = MatchJoinPayloadSchema.parse(rawPayload);
    if (payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'MATCH_MISMATCH', message: 'Token match does not match requested match' });
      return;
    }

    client.emit('match:state', this.matchService.getPublicSnapshot(client.data.matchId));
    if (client.data.role === 'party' && client.data.partySide) {
      client.emit('party:state', this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide));
    }
    this.logger.info({ matchId: payload.matchId, role: client.data.role }, 'Match state synced on join');
  }

  @SubscribeMessage('duel:selectFighter')
  async handleSelectFighter(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = SelectFighterPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'party' || !client.data.partySide) {
      client.emit('match:error', { code: 'FORBIDDEN', message: 'Only party members can select fighters' });
      return;
    }
    if (payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'MATCH_MISMATCH', message: 'Token match does not match payload' });
      return;
    }

    await this.matchService.runMatchTransition(client.data.matchId, () => {
      this.matchService.selectFighter(client.data.matchId, client.data.partySide!, payload.duelId, payload.fighterId);
      this.server.to(`match:${client.data.matchId}:party${client.data.partySide}`).emit(
        'party:state',
        this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!),
      );
      this.logger.info({ side: client.data.partySide, fighterId: payload.fighterId }, 'Tentative fighter selection updated');
    });
  }

  @SubscribeMessage('duel:lockFighter')
  async handleLockFighter(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = LockFighterPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'party' || !client.data.partySide) {
      client.emit('match:error', { code: 'FORBIDDEN', message: 'Only party members can lock fighters' });
      return;
    }
    if (payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'MATCH_MISMATCH', message: 'Token match does not match payload' });
      return;
    }

    await this.matchService.runMatchTransition(client.data.matchId, () => {
      const res = this.matchService.lockFighter(client.data.matchId, client.data.partySide!, payload.duelId, payload.fighterId);

      this.emitValidated(`match:${client.data.matchId}`, 'duel:fighterLocked', { partySide: client.data.partySide! });
      this.emitValidated(
        `match:${client.data.matchId}:party${client.data.partySide}`,
        'party:state',
        this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!),
      );

      if (res.duelStarted && res.fighterA && res.fighterB) {
        this.emitValidated(`match:${client.data.matchId}`, 'duel:fightersRevealed', {
          fighterA: res.fighterA,
          fighterB: res.fighterB,
        });
        this.emitValidated(`match:${client.data.matchId}`, 'match:state', this.matchService.getPublicSnapshot(client.data.matchId));
        this.broadcastPrivateSnapshots(client.data.matchId);
      }
    });
  }

  @SubscribeMessage('duel:submitAction')
  async handleSubmitAction(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = SubmitActionPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'party' || !client.data.partySide) {
      client.emit('match:error', {
        code: 'FORBIDDEN_ACTION',
        message: 'Only authenticated party members can submit actions',
        commandId: payload.commandId,
      });
      return;
    }
    if (payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'MATCH_MISMATCH', message: 'Token match does not match payload' });
      return;
    }

    await this.matchService.runMatchTransition(client.data.matchId, async () => {
      const res = this.matchService.submitAction(
        client.data.matchId,
        client.data.partySide!,
        payload.duelId,
        payload.turnNumber,
        payload.commandId,
        payload.actionType,
      );

      if (res.duplicate) {
        // P1.1: Replay cached private snapshot on duplicate delivery
        this.emitValidated(client, 'party:state', this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!));
        return;
      }

      if (!res.bothLocked) {
        // P0.5: Stage action privately; do not emit irrevocable public actionLocked before resolution
        client.emit(
          'party:state',
          this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!),
        );
        return;
      }

      // P0.5: When both actions are locked, resolve and commit FIRST before emitting ANY external events
      try {
        const match = res.match;
        const activeDuel = match.currentDuel as ActiveDuelState;
        const resolution = resolveTurn(activeDuel, res.actionA!, res.actionB!);
        const commitResult = handleNormalTurnResolution(match, resolution, this.tieBreakService, this.duelHistoryStore);
        res.recordOutcome(commitResult);

        // Resolution and state commit succeeded! Now emit actionLocked, snapshots, and resolution events atomically
        this.emitValidated(`match:${client.data.matchId}`, 'duel:actionLocked', { partySide: client.data.partySide! });

        if (commitResult.type === 'continued') {
          // P0.4: Advance turn and re-arm 12s action timer
          this.matchService.advanceToNextTurn(match);
          this.emitValidated(`match:${client.data.matchId}`, 'duel:turnResolved', {
            turnNumber: commitResult.turnNumber,
            stateA: toPublicFighter(commitResult.nextStateA, activeDuel.roleA),
            stateB: toPublicFighter(commitResult.nextStateB, activeDuel.roleB),
            combatLog: commitResult.combatLog,
          });
        } else if (commitResult.type === 'suddenDeathStarted') {
          // P0.4: Transition to sudden death and re-arm timer
          this.matchService.transitionToSuddenDeath(match);
          this.emitValidated(`match:${client.data.matchId}`, 'duel:suddenDeathStarted', {
            fighterA: toPublicFighter(commitResult.rollbackStateA, activeDuel.roleA),
            fighterB: toPublicFighter(commitResult.rollbackStateB, activeDuel.roleB),
          });
        } else if (commitResult.type === 'duelCompleted') {
          this.emitValidated(`match:${client.data.matchId}`, 'duel:completed', {
            winnerPartySide: commitResult.result.winner,
            reason: commitResult.result.reason ?? 'normalDecisive',
            scoreA: commitResult.result.scoreA,
            scoreB: commitResult.result.scoreB,
          });
          if (commitResult.result.matchCompleted) {
            // P1.4: Terminal match cleanup - clear timers and null all deadlines
            this.matchService.completeMatch(match, commitResult.result.winner);
            this.emitValidated(`match:${client.data.matchId}`, 'match:completed', {
              winningPartySide: commitResult.result.winner,
              finalScoreA: commitResult.result.scoreA,
              finalScoreB: commitResult.result.scoreB,
            });
          } else {
            // P0.4: Duel completed and series continues -> transition to picking and arm selection timer
            this.matchService.transitionToPicking(match);
          }
        }

        this.emitValidated(`match:${client.data.matchId}`, 'match:state', this.matchService.getPublicSnapshot(client.data.matchId));
        this.broadcastPrivateSnapshots(client.data.matchId);
      } catch (err) {
        res.rollback(); // P0.5: Atomic rollback of both sides' staged actions and commands without prior external event emissions
        throw err;
      }
    });
  }

  @SubscribeMessage('duel:submitSuddenDeathAction')
  async handleSuddenDeathAction(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = SubmitSuddenDeathActionPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'party' || !client.data.partySide) {
      client.emit('match:error', {
        code: 'FORBIDDEN_ACTION',
        message: 'Only authenticated party members can submit sudden death actions',
        commandId: payload.commandId,
      });
      return;
    }
    if (payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'MATCH_MISMATCH', message: 'Token match does not match payload' });
      return;
    }

    await this.matchService.runMatchTransition(client.data.matchId, async () => {
      const res = this.matchService.submitSuddenDeathAction(
        client.data.matchId,
        client.data.partySide!,
        payload.duelId,
        payload.commandId,
        payload.actionType,
      );

      if (res.duplicate) {
        // P1.1: Replay cached private snapshot on duplicate sudden death delivery
        this.emitValidated(client, 'party:state', this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!));
        return;
      }

      if (!res.bothLocked) {
        // P0.5: Only acknowledge privately to the submitting party
        client.emit(
          'party:state',
          this.matchService.getPrivatePartySnapshot(client.data.matchId, client.data.partySide!),
        );
        return;
      }

      // P0.5: When both actions are locked, resolve and commit FIRST before emitting external events
      try {
        const match = res.match;
        const activeDuel = match.currentDuel as ActiveDuelState;
        const outcome = resolveSuddenDeath(
          activeDuel.roleA,
          activeDuel.roleB,
          activeDuel.fighterIdA,
          activeDuel.fighterIdB,
          activeDuel.stateA,
          activeDuel.stateB,
          res.actionA!,
          res.actionB!,
        );

        const finalResult = handleSuddenDeathResolution(match, outcome, this.tieBreakService, this.duelHistoryStore);
        res.recordOutcome(finalResult);

        this.emitValidated(`match:${client.data.matchId}`, 'duel:actionLocked', { partySide: client.data.partySide! });

        this.emitValidated(`match:${client.data.matchId}`, 'duel:completed', {
          winnerPartySide: finalResult.winner,
          reason: finalResult.reason ?? 'suddenDeathCompleted',
          scoreA: finalResult.scoreA,
          scoreB: finalResult.scoreB,
        });

        if (finalResult.matchCompleted) {
          // P1.4: Terminal match cleanup - clear timers and null all deadlines
          this.matchService.completeMatch(match, finalResult.winner);
          this.emitValidated(`match:${client.data.matchId}`, 'match:completed', {
            winningPartySide: finalResult.winner,
            finalScoreA: finalResult.scoreA,
            finalScoreB: finalResult.scoreB,
          });
        } else {
          // P0.4: Series continues -> transition to picking and arm selection timer
          this.matchService.transitionToPicking(match);
        }

        this.emitValidated(`match:${client.data.matchId}`, 'match:state', this.matchService.getPublicSnapshot(client.data.matchId));
        this.broadcastPrivateSnapshots(client.data.matchId);
      } catch (err) {
        res.rollback(); // P0.5: Atomic rollback of both sides' staged actions and commands
        throw err;
      }
    });
  }

  @SubscribeMessage('match:start')
  async handleMatchStart(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = MatchStartPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'host' || payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'FORBIDDEN', message: 'Host authority required for this match' });
      return;
    }
    await this.matchService.runMatchTransition(payload.matchId, () => {
      this.matchService.startMatch(payload.matchId);
      this.emitValidated(`match:${payload.matchId}`, 'match:state', this.matchService.getPublicSnapshot(payload.matchId));
      this.broadcastPrivateSnapshots(payload.matchId);
      this.logger.info({ matchId: payload.matchId }, 'Host started match');
    });
  }

  @SubscribeMessage('match:pause')
  async handleMatchPause(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = MatchPausePayloadSchema.parse(rawPayload);
    if (client.data.role !== 'host' || payload.matchId !== client.data.matchId) {
      this.emitValidated(client, 'match:error', { code: 'FORBIDDEN', message: 'Host authority required for this match' });
      return;
    }
    await this.matchService.runMatchTransition(payload.matchId, () => {
      this.matchService.pauseMatch(payload.matchId, payload.reason);
      this.emitValidated(`match:${payload.matchId}`, 'match:state', this.matchService.getPublicSnapshot(payload.matchId));
      this.broadcastPrivateSnapshots(payload.matchId);
      this.logger.info({ matchId: payload.matchId, reason: payload.reason }, 'Host paused match');
    });
  }

  @SubscribeMessage('match:resume')
  async handleMatchResume(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = MatchResumePayloadSchema.parse(rawPayload);
    if (client.data.role !== 'host' || payload.matchId !== client.data.matchId) {
      this.emitValidated(client, 'match:error', { code: 'FORBIDDEN', message: 'Host authority required for this match' });
      return;
    }
    await this.matchService.runMatchTransition(payload.matchId, () => {
      this.matchService.resumeMatch(payload.matchId);
      this.emitValidated(`match:${payload.matchId}`, 'match:state', this.matchService.getPublicSnapshot(payload.matchId));
      this.broadcastPrivateSnapshots(payload.matchId);
      this.logger.info({ matchId: payload.matchId }, 'Host resumed match');
    });
  }

  @SubscribeMessage('match:reset')
  async handleMatchReset(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = MatchResetPayloadSchema.parse(rawPayload);
    if (client.data.role !== 'host' || payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'FORBIDDEN', message: 'Host authority required for this match' });
      return;
    }
    await this.matchService.runMatchTransition(payload.matchId, () => {
      const { match, tokens } = this.matchService.resetMatch(payload.matchId, payload.reason);
      // P0.1, P1.5: Deliver validated MatchTokensRotatedPayload to authorized host client
      const rotatedPayload = {
        matchId: payload.matchId,
        runId: match.runId,
        tokens,
      };
      this.emitValidated(`match:${payload.matchId}`, 'match:tokensRotated', rotatedPayload);
      this.emitValidated(client, 'match:tokensRotated', rotatedPayload);
      // P1.3: Disconnect all existing room sockets so stale runId sockets cannot receive snapshots or mutate state
      this.server.in(`match:${payload.matchId}`).disconnectSockets(true);
      this.logger.info({ matchId: payload.matchId, reason: payload.reason, newRunId: match.runId }, 'Host reset match and evicted stale run sockets');
    });
  }

  @SubscribeMessage('host:override')
  async handleHostOverride(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    if (!this.validateClientRun(client)) return;
    const payload = HostOverridePayloadSchema.parse(rawPayload);
    if (client.data.role !== 'host' || payload.matchId !== client.data.matchId) {
      client.emit('match:error', { code: 'FORBIDDEN', message: 'Host authority required for administrative override' });
      return;
    }
    await this.matchService.runMatchTransition(payload.matchId, () => {
      this.matchService.overrideMatch(
        payload.matchId,
        payload.operation,
        payload.reason,
        client.data.userId,
        payload.winnerSide,
      );
      this.emitValidated(`match:${payload.matchId}`, 'match:state', this.matchService.getPublicSnapshot(payload.matchId));
      this.broadcastPrivateSnapshots(payload.matchId);
      this.logger.info({ matchId: payload.matchId, operation: payload.operation, reason: payload.reason }, 'Host administrative override applied');
    });
  }

  // ── Documented Event Aliases (FRD/PRD Parity) ──────────────────────────────

  @SubscribeMessage('pick:submit')
  async handlePickSubmitAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleSelectFighter(rawPayload, client);
  }

  @SubscribeMessage('pick:lock')
  async handlePickLockAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleLockFighter(rawPayload, client);
  }

  @SubscribeMessage('action:submit')
  async handleActionSubmitAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleSubmitAction(rawPayload, client);
  }

  @SubscribeMessage('action:lock')
  async handleActionLockAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleSubmitAction(rawPayload, client);
  }

  @SubscribeMessage('host:pause')
  async handleHostPauseAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleMatchPause(rawPayload, client);
  }

  @SubscribeMessage('host:resume')
  async handleHostResumeAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleMatchResume(rawPayload, client);
  }

  @SubscribeMessage('host:reset')
  async handleHostResetAlias(@MessageBody() rawPayload: unknown, @ConnectedSocket() client: AppSocket): Promise<void> {
    return this.handleMatchReset(rawPayload, client);
  }
}
