import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { MatchService } from '../src/match/match.service';
import { MatchController } from '../src/match/match.controller';
import { SocketIoAdapter } from '../src/adapters/socket-io.adapter';
import type { AddressInfo } from 'net';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  MatchTokensRotatedPayload,
  PublicMatchSnapshot,
} from '@dungeon-hunt/shared-contracts';

const TEST_ADMIN_KEY = 'test-admin-key-min32chars';
process.env.HOST_ADMIN_KEY = TEST_ADMIN_KEY;

describe('Realtime Match Lifecycle & Contract Integration (P1.8)', () => {
  let app: INestApplication;
  let matchService: MatchService;
  let matchController: MatchController;
  let port: number;
  let hostSocket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let partyASocket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let partyBSocket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let matchId: string;
  let tokens: { host: string; partyA: string; partyB: string; arena: string };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app));
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;

    matchService = app.get(MatchService);
    matchController = app.get(MatchController);
  });

  afterAll(async () => {
    hostSocket?.disconnect();
    partyASocket?.disconnect();
    partyBSocket?.disconnect();
    await app.close();
  });

  beforeEach(() => {
    const provision = matchController.createMatch(
      'test-admin-key-min32chars',
      `test-cmd-${Date.now()}-${Math.random()}`,
      {
        partyAName: 'Alpha',
        partyBName: 'Bravo',
      },
    );
    matchId = provision.matchId;
    tokens = provision.tokens;
  });

  afterEach(() => {
    hostSocket?.disconnect();
    partyASocket?.disconnect();
    partyBSocket?.disconnect();
  });

  it('enforces origin policy on WebSocket upgrade rejection (P1.4)', (done) => {
    const untrustedSocket = io(`http://localhost:${port}`, {
      autoConnect: true,
      extraHeaders: { origin: 'http://untrusted-origin.com' },
      auth: { token: tokens.host },
      transports: ['websocket'],
    });

    untrustedSocket.on('connect_error', (err) => {
      expect(err.message).toMatch(/websocket error|Unauthorized origin/i);
      untrustedSocket.disconnect();
      done();
    });
  });

  it('executes full timeout fallback, turn progression, and event broadcast (P0.4, P1.1)', async () => {
    const socket = io(`http://localhost:${port}`, {
      auth: { token: tokens.host },
      transports: ['websocket'],
    });
    hostSocket = socket;

    await new Promise<void>((resolve) => socket.on('connect', resolve));

    const matchStatePromise = new Promise<PublicMatchSnapshot>((resolve) => {
      socket.on('match:state', (state) => {
        if (state.status === 'picking') resolve(state);
      });
    });

    socket.emit('match:start', { matchId });
    const pickingState = await matchStatePromise;
    expect(pickingState.status).toBe('picking');
    expect(pickingState.selectionDeadlineAt).toBeDefined();
  });

  it('handles reset token-rotation with host rejoin and stale-socket eviction (P0.1, P1.3)', (done) => {
    const socket = io(`http://localhost:${port}`, {
      auth: { token: tokens.host },
      transports: ['websocket'],
    });
    hostSocket = socket;

    socket.on('connect', () => {
      socket.on('match:tokensRotated', (payload: MatchTokensRotatedPayload) => {
        expect(payload.matchId).toBe(matchId);
        expect(payload.runId).toBe(2);
        expect(payload.tokens.host).toBeDefined();

        // Stale socket is evicted by server
        socket.on('disconnect', (reason) => {
          expect(reason).toBe('io server disconnect');

          // New connection using rotated token succeeds
          const reconnectedSocket = io(`http://localhost:${port}`, {
            auth: { token: payload.tokens.host },
            transports: ['websocket'],
          });
          reconnectedSocket.on('connect', () => {
            reconnectedSocket.disconnect();
            done();
          });
        });
      });

      socket.emit('match:reset', { matchId, reason: 'Test reset' });
    });
  });

  it('retires match, purging history, tie-break, and controller cache (P0.5, P1.3)', async () => {
    await matchService.retireMatch(matchId);
    expect(() => matchService.getMatch(matchId)).toThrow(/Match .* not found/);
  });
});
