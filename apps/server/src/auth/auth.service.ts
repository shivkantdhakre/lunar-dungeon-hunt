import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { z } from 'zod';
import { assertSecureSecret } from './secret-validation';

export const AuthTokenClaimsSchema = z.object({
  matchId: z.string().min(1).max(64),
  runId: z.number().int().positive(), // Bound to match run; resets invalidate old tokens (H11, P0.4)
  userId: z.string().min(1).max(64),
  role: z.enum(['host', 'party', 'arena']),
  partySide: z.enum(['A', 'B']).optional(),
  exp: z.number().int().positive(),
  iss: z.literal('lunar-dungeon-server'),
  aud: z.literal('lunar-dungeon-game'),
}).strict().refine(c => (c.role === 'party' ? c.partySide !== undefined : c.partySide === undefined), {
  message: 'partySide is required for party role, and forbidden for host/arena roles',
});

export type AuthTokenClaims = z.infer<typeof AuthTokenClaimsSchema>;

export interface AuthVerifyResult {
  valid: boolean;
  claims?: AuthTokenClaims;
  reason?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret = assertSecureSecret(this.config.get<string>('AUTH_SECRET'), 'AUTH_SECRET');
  }

  onModuleInit() {
    if (!this.secret || this.secret.length < 32) {
      throw new Error('AUTH_SECRET failed startup invariant.');
    }
  }

  /**
   * Generates a signed token: <base64UrlPayload>.<base64UrlHmacSignature>
   */
  generateToken(claims: Omit<AuthTokenClaims, 'iss' | 'aud' | 'exp'>, ttlSeconds = 7200): string {
    const fullClaims: AuthTokenClaims = {
      ...claims,
      iss: 'lunar-dungeon-server',
      aud: 'lunar-dungeon-game',
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const payloadStr = Buffer.from(JSON.stringify(fullClaims), 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', this.secret).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
  }

  /**
   * Verifies signature, expiry, and schema using constant-time comparison.
   * Defensively validates token type, size, character encoding, and signature before payload parse.
   */
  async verifyHandshakeToken(token: unknown): Promise<AuthVerifyResult> {
    if (typeof token !== 'string') {
      return { valid: false, reason: 'Missing or non-string authentication token' };
    }

    if (token.length > 2048) {
      return { valid: false, reason: 'Token exceeds maximum length limit (2048 chars)' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure: must be payload.signature' };
    }

    const [payloadStr, providedSig] = parts;
    const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;
    if (!BASE64URL_REGEX.test(payloadStr) || !BASE64URL_REGEX.test(providedSig)) {
      return { valid: false, reason: 'Malformed token: invalid base64url encoding' };
    }

    // Constant-time HMAC comparison to prevent timing attacks
    const expectedSig = crypto.createHmac('sha256', this.secret).update(payloadStr).digest('base64url');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const providedBuf = Buffer.from(providedSig, 'utf8');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: false, reason: 'Invalid token signature' };
    }

    try {
      const rawClaims = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
      const parsed = AuthTokenClaimsSchema.safeParse(rawClaims);
      if (!parsed.success) {
        return { valid: false, reason: `Invalid claims schema: ${parsed.error.message}` };
      }

      const claims = parsed.data;
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp <= now) {
        return { valid: false, reason: 'Token expired' };
      }

      return { valid: true, claims };
    } catch {
      return { valid: false, reason: 'Invalid JSON encoding in token payload' };
    }
  }
}
