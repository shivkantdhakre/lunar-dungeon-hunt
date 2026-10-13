import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let authService: AuthService;
  const testSecret = 'test-secret-change-in-production-min32chars';

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'AUTH_SECRET') return testSecret;
        return defaultValue;
      }),
    } as unknown as ConfigService;
    authService = new AuthService(config);
  });

  it('generates valid token with numeric runId and verifies claims', async () => {
    const token = authService.generateToken({
      matchId: 'match-1',
      runId: 1,
      userId: 'user-1',
      role: 'party',
      partySide: 'A',
    });

    const res = await authService.verifyHandshakeToken(token);
    expect(res.valid).toBe(true);
    expect(res.claims?.matchId).toBe('match-1');
    expect(res.claims?.runId).toBe(1);
    expect(typeof res.claims?.runId).toBe('number');
    expect(res.claims?.partySide).toBe('A');
  });

  it('rejects tampered signatures with timing-safe check', async () => {
    const token = authService.generateToken({ matchId: 'm-1', runId: 1, userId: 'u-1', role: 'arena' });
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig.slice(0, -2)}xx`;

    const res = await authService.verifyHandshakeToken(tampered);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Invalid token signature');
  });

  it('rejects expired tokens', async () => {
    const token = authService.generateToken({ matchId: 'm-1', runId: 1, userId: 'u-1', role: 'host' }, -10);
    const res = await authService.verifyHandshakeToken(token);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Token expired');
  });
});
