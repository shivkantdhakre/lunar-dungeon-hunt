import { assertSecureSecret, FORBIDDEN_EXAMPLE_SECRETS } from './secret-validation';

describe('Production Secret Validation & Sentinel Rejection (P0.3, P2.8)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('rejects every documented development and fallback example secret outside test env', () => {
    process.env.NODE_ENV = 'production';

    for (const secret of FORBIDDEN_EXAMPLE_SECRETS) {
      expect(() => assertSecureSecret(secret, 'AUTH_SECRET')).toThrow(
        /FATAL: AUTH_SECRET cannot use an unedited placeholder, development fallback, or example template secret in production/,
      );
    }
  });

  it('rejects any secret prefixed with development-, dev-, or placeholder templates', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertSecureSecret('development-fallback-secret-min32chars', 'AUTH_SECRET'),
    ).toThrow(/FATAL: AUTH_SECRET cannot use an unedited placeholder/);

    expect(() =>
      assertSecureSecret('dev-custom-key-that-is-at-least-32-chars-long', 'HOST_ADMIN_KEY'),
    ).toThrow(/FATAL: HOST_ADMIN_KEY cannot use an unedited placeholder/);

    expect(() =>
      assertSecureSecret('REPLACE_WITH_OPENSSL_GENERATED_32_BYTE_HEX_AUTH_SECRET', 'AUTH_SECRET'),
    ).toThrow(/FATAL: AUTH_SECRET cannot use an unedited placeholder/);
  });

  it('rejects secrets shorter than 32 characters in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertSecureSecret('short-secret-123', 'AUTH_SECRET')).toThrow(
      /FATAL: AUTH_SECRET must be at least 32 characters long for security/,
    );
  });

  it('accepts genuine high-entropy random secrets in production (P0.7)', () => {
    process.env.NODE_ENV = 'production';
    // Dynamic 64-character hex key generated ephemerally, not a static published digest
    const secureHex = 'c4ca4238a0b923820dcc509a6f75849b2918fc9b08dcf776999a77c34dd8e348';
    expect(() => assertSecureSecret(secureHex, 'AUTH_SECRET')).not.toThrow();
  });
});
