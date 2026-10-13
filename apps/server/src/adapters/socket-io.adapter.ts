import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions, Socket, Server } from 'socket.io';
import * as http from 'http';
import { AuthService } from '../auth/auth.service';
import { MatchService } from '../match/match.service';

export class SocketIoAdapter extends IoAdapter {
  private readonly allowedOrigin: string;
  private readonly authService: AuthService;
  private readonly matchService: MatchService;

  constructor(app: INestApplicationContext) {
    super(app);
    const config = app.get(ConfigService);
    this.allowedOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
    this.authService = app.get(AuthService);
    this.matchService = app.get(MatchService);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const serverOptions: Record<string, unknown> = {
      ...(options ?? {}),
      path: options?.path ?? '/socket.io',
      cors: {
        origin: this.allowedOrigin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      allowRequest: (req: http.IncomingMessage, callback: (err: string | null | undefined, success: boolean) => void) => {
        const origin = req.headers.origin;
        if (origin) {
          if (origin === this.allowedOrigin) {
            callback(null, true);
          } else {
            callback('Unauthorized origin on WebSocket upgrade', false);
          }
          return;
        }

        // P1.15: Non-browser / native / test clients without Origin header
        const nodeEnv = process.env.NODE_ENV;
        if (nodeEnv === 'test' || nodeEnv === 'development' || req.headers.authorization) {
          callback(null, true);
        } else {
          callback('Unauthorized: Missing Origin header in production', false);
        }
      },
    };

    const server: Server = super.createIOServer(port, serverOptions);

    // Socket.IO Middleware: Authoritative Handshake Authentication (P0.3, P0.4)
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const rawToken =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers?.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/, '')
          : undefined);

      const authResult = await this.authService.verifyHandshakeToken(rawToken);
      if (!authResult.valid || !authResult.claims) {
        return next(new Error(`UNAUTHORIZED: ${authResult.reason ?? 'Invalid token'}`));
      }

      // Verify that match exists and token runId matches active match runId (P0.3, P0.4)
      let match;
      try {
        match = this.matchService.getMatch(authResult.claims.matchId);
      } catch {
        return next(new Error('UNAUTHORIZED: Match not found'));
      }

      if (match.runId !== authResult.claims.runId) {
        return next(new Error('UNAUTHORIZED: Stale token session for previous run'));
      }

      // P1.4: Verify token has not expired
      const nowSec = Math.floor(Date.now() / 1000);
      if (authResult.claims.exp <= nowSec) {
        return next(new Error('UNAUTHORIZED: Token expired'));
      }

      // Populate socket.data strictly from verified server-side claims including numeric runId and exp (P1.4)
      socket.data = {
        authenticated: true,
        matchId: authResult.claims.matchId,
        runId: authResult.claims.runId, // P0.4: number
        userId: authResult.claims.userId,
        role: authResult.claims.role,
        partySide: authResult.claims.partySide,
        exp: authResult.claims.exp, // P1.4: Retain verified expiry timestamp
      };

      // P1.4, P1.7: Proactively schedule disconnection when token expires, retain handle and unref/clear on disconnect
      const timeToLiveMs = (authResult.claims.exp - nowSec) * 1000;
      const expiryTimer = setTimeout(() => {
        if (socket.connected) {
          socket.emit('match:error', { code: 'SESSION_EXPIRED', message: 'Token session has expired' });
          socket.disconnect(true);
        }
      }, timeToLiveMs);
      if (typeof expiryTimer.unref === 'function') {
        expiryTimer.unref();
      }
      const socketData = socket.data as Record<string, unknown>;
      socketData.expiryTimer = expiryTimer;

      socket.on('disconnect', () => {
        if (socketData.expiryTimer) {
          clearTimeout(socketData.expiryTimer as NodeJS.Timeout);
          delete socketData.expiryTimer;
        }
      });

      next();
    });

    return server;
  }
}
