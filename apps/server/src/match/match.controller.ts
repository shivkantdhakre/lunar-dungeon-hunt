import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Header,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { MatchService } from './match.service';
import { MatchCreatePayloadSchema } from '@dungeon-hunt/shared-contracts';
import { assertSecureSecret } from '../auth/secret-validation';
import * as crypto from 'crypto';

export interface MatchProvisioningResponse {
  matchId: string;
  runId: number;
  partyAName: string;
  partyBName: string;
  tokens: {
    host: string;
    partyA: string;
    partyB: string;
    arena: string;
  };
  createdAt: string;
}

interface CachedProvisioningEntry {
  response: MatchProvisioningResponse;
  bodyHash: string;
  matchId: string;
  expiresAt: number;
}

@Controller(['matches', 'api/matches'])
export class MatchController implements OnModuleInit {
  private readonly hostAdminKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly matchService: MatchService,
  ) {
    this.hostAdminKey = assertSecureSecret(this.config.get<string>('HOST_ADMIN_KEY'), 'HOST_ADMIN_KEY');
  }

  onModuleInit(): void {
    // P1.3: Register match retirement hook to purge provisioning cache entries on match retirement
    this.matchService.registerRetirementHook((matchId: string) => this.clearMatch(matchId));
  }

  // Bounded, TTL-protected idempotency cache for match creation requests (P1.5, P1.8, P2.8)
  private readonly provisioningCache = new Map<string, CachedProvisioningEntry>();
  private readonly MAX_CACHE_ENTRIES = 100;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  // P1.5: Prune ONLY expired entries before lookup
  private pruneExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.provisioningCache.entries()) {
      if (entry.expiresAt <= now) {
        this.provisioningCache.delete(key);
      }
    }
  }

  /**
   * Protected endpoint for tournament desk to initialize a match and mint initial tokens.
   *
   * Operational Security Rules (P1.5, P1.8, P2.8):
   * 1. Admin authentication occurs STRICTLY BEFORE any cache lookup.
   * 2. Cache key is scoped by sha256(adminKey + ':' + idempotencyKey) — bodyHash is verified upon lookup.
   * 3. Replay with identical key + identical body returns cached response.
   * 4. Replay with identical key + DIFFERENT body is rejected with 400 Bad Request.
   * 5. Cache-Control: no-store prevents caching of role tokens across browser history.
   * 6. Constant-time timingSafeEqual over SHA-256 digests.
   */
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  createMatch(
    @Headers('x-host-admin-key') adminKey: unknown,
    @Headers('x-idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    // 1. STRICT AUTHENTICATION FIRST — Never read cache before verifying credentials
    if (typeof adminKey !== 'string' || adminKey.length === 0 || adminKey.length > 128) {
      throw new UnauthorizedException('Missing or invalid host admin credentials.');
    }

    const expectedHash = crypto.createHash('sha256').update(this.hostAdminKey).digest();
    const providedHash = crypto.createHash('sha256').update(adminKey).digest();
    if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
      throw new UnauthorizedException('Invalid host admin credentials.');
    }

    // 2. Validate Request Body
    const parsed = MatchCreatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    const partyAName = parsed.data.partyAName.trim();
    const partyBName = parsed.data.partyBName.trim();
    if (partyAName.length === 0 || partyBName.length === 0) {
      throw new BadRequestException('Party names cannot be empty or whitespace only.');
    }
    if (partyAName.toLowerCase() === partyBName.toLowerCase()) {
      throw new BadRequestException('Party A and Party B names must be distinct.');
    }

    const canonicalBody = JSON.stringify({ partyAName, partyBName });
    const bodyHash = crypto.createHash('sha256').update(canonicalBody).digest('hex');

    // 3. Authenticated & Scoped Idempotency Cache Lookup (P1.5)
    let scopedCacheKey: string | null = null;
    if (typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
      if (idempotencyKey.length > 128) {
        throw new BadRequestException('x-idempotency-key exceeds maximum allowed length (128 chars).');
      }
      // P1.5: Key on authenticated principal + idempotencyKey
      scopedCacheKey = crypto
        .createHash('sha256')
        .update(`${this.hostAdminKey}:${idempotencyKey}`)
        .digest('hex');

      this.pruneExpiredCache();
      const cached = this.provisioningCache.get(scopedCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.bodyHash !== bodyHash) {
          throw new BadRequestException('Idempotency key reuse with differing request payload.');
        }
        return cached.response;
      }
    }

    const matchId = crypto.randomUUID();

    // 4. Initialize match state in authoritative server memory
    const matchState = this.matchService.createMatch({
      matchId,
      partyAName,
      partyBName,
      rosterRolesA: parsed.data.rosterRolesA,
      rosterRolesB: parsed.data.rosterRolesB,
    });

    // 5. Mint scoped credentials bound to this match session and numeric runId (P0.4)
    const hostToken = this.authService.generateToken({ matchId, runId: matchState.runId, userId: 'host-desk', role: 'host' });
    const partyAToken = this.authService.generateToken({ matchId, runId: matchState.runId, userId: `partyA-${partyAName}`, role: 'party', partySide: 'A' });
    const partyBToken = this.authService.generateToken({ matchId, runId: matchState.runId, userId: `partyB-${partyBName}`, role: 'party', partySide: 'B' });
    const arenaToken = this.authService.generateToken({ matchId, runId: matchState.runId, userId: 'arena-display', role: 'arena' });

    // Canonical response structure (P0.5, P0.6)
    const response: MatchProvisioningResponse = {
      matchId,
      runId: matchState.runId,
      partyAName,
      partyBName,
      tokens: {
        host: hostToken,
        partyA: partyAToken,
        partyB: partyBToken,
        arena: arenaToken,
      },
      createdAt: new Date().toISOString(),
    };

    if (scopedCacheKey) {
      // P1.5: Enforce size limit ONLY when inserting a new entry
      while (this.provisioningCache.size >= this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.provisioningCache.keys().next().value;
        if (oldestKey) this.provisioningCache.delete(oldestKey);
        else break;
      }

      this.provisioningCache.set(scopedCacheKey, {
        response,
        bodyHash,
        matchId,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
    }

    return response;
  }

  // P1.8, P2.8: Targeted per-match cache clearance invoked upon match retirement
  clearMatch(matchId: string): void {
    for (const [key, entry] of this.provisioningCache.entries()) {
      if (entry.matchId === matchId) {
        this.provisioningCache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.provisioningCache.clear();
  }

  private async authenticateHostRequest(
    matchId: string,
    adminKey?: unknown,
    authHeader?: unknown,
  ): Promise<void> {
    if (typeof adminKey === 'string' && adminKey.length > 0 && adminKey.length <= 128) {
      const expectedHash = crypto.createHash('sha256').update(this.hostAdminKey).digest();
      const providedHash = crypto.createHash('sha256').update(adminKey).digest();
      if (crypto.timingSafeEqual(expectedHash, providedHash)) {
        return;
      }
    }

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const verifyResult = await this.authService.verifyHandshakeToken(token);
      if (verifyResult.valid && verifyResult.claims) {
        if (verifyResult.claims.role === 'host' && verifyResult.claims.matchId === matchId) {
          return;
        }
      }
    }

    throw new UnauthorizedException('Missing or invalid host authorization credentials.');
  }

  @Get('active/public')
  getActivePublicSnapshot() {
    const latest = this.matchService.getLatestMatch();
    if (!latest) {
      throw new NotFoundException('No active tournament match.');
    }
    const publicSnapshot = this.matchService.getPublicSnapshot(latest.id);
    const arenaToken = this.authService.generateToken({
      matchId: latest.id,
      runId: latest.runId,
      userId: 'public-arena-viewer',
      role: 'arena',
    });
    return {
      matchId: latest.id,
      runId: latest.runId,
      arenaToken,
      snapshot: publicSnapshot,
    };
  }

  @Get(':id/public')
  getPublicSnapshot(@Param('id') matchId: string) {
    try {
      return this.matchService.getPublicSnapshot(matchId);
    } catch {
      throw new NotFoundException(`Match ${matchId} not found.`);
    }
  }

  @Get(':id/results')
  getMatchResults(@Param('id') matchId: string) {
    try {
      const match = this.matchService.getMatch(matchId);
      return {
        matchId: match.id,
        runId: match.runId,
        status: match.status,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        currentDuelNumber: match.currentDuelNumber,
        winner: match.winningPartySide ?? (match.scoreA >= 2 ? 'Party A' : match.scoreB >= 2 ? 'Party B' : null),
        partyA: { id: match.partyA.id, name: match.partyA.name },
        partyB: { id: match.partyB.id, name: match.partyB.name },
        duelsCompleted: match.duelHistory.length,
        duelHistory: match.duelHistory.map(d => ({
          duelNumber: d.duelNumber,
          winner: d.winner,
          reason: d.reason,
          roleIdA: d.roleIdA,
          roleIdB: d.roleIdB,
          resolvedTurns: d.resolvedTurns,
          completedAt: d.completedAt,
        })),
      };
    } catch {
      throw new NotFoundException(`Match ${matchId} not found.`);
    }
  }

  @Get(':id/audit')
  async getAuditLog(
    @Param('id') matchId: string,
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    try {
      const match = this.matchService.getMatch(matchId);
      return { matchId: match.id, auditLog: match.auditLog };
    } catch {
      throw new NotFoundException(`Match ${matchId} not found.`);
    }
  }

  @Post(':id/start')
  async startMatch(
    @Param('id') matchId: string,
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    this.matchService.startMatch(matchId);
    return this.matchService.getPublicSnapshot(matchId);
  }

  @Post(':id/pause')
  async pauseMatch(
    @Param('id') matchId: string,
    @Body() body: { reason?: string },
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    this.matchService.pauseMatch(matchId, body?.reason ?? 'Host desk pause');
    return this.matchService.getPublicSnapshot(matchId);
  }

  @Post(':id/resume')
  async resumeMatch(
    @Param('id') matchId: string,
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    this.matchService.resumeMatch(matchId);
    return this.matchService.getPublicSnapshot(matchId);
  }

  @Post(':id/reset')
  async resetMatch(
    @Param('id') matchId: string,
    @Body() body: { reason?: string },
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    const { match, tokens } = this.matchService.resetMatch(matchId, body?.reason ?? 'Host desk reset');
    return {
      matchId: match.id,
      runId: match.runId,
      status: match.status,
      tokens,
    };
  }

  @Post(':id/override')
  async overrideMatch(
    @Param('id') matchId: string,
    @Body() body: { operation: 'forcePhase' | 'forceNextDuel' | 'declareDuelWinner'; reason: string; winnerSide?: 'A' | 'B' },
    @Headers('x-host-admin-key') adminKey?: unknown,
    @Headers('authorization') authHeader?: unknown,
  ) {
    await this.authenticateHostRequest(matchId, adminKey, authHeader);
    if (!body?.operation || !body?.reason) {
      throw new BadRequestException('Missing operation or reason for override.');
    }
    this.matchService.overrideMatch(matchId, body.operation, body.reason, 'host-admin', body.winnerSide);
    return this.matchService.getPublicSnapshot(matchId);
  }
}
