/**
 * Shared Secret Validation & Security Policy (P0.2, P0.3, P1.10, P2.8)
 * Centralizes secret strength, format verification, and example placeholder detection.
 * Enforces production fail-closed rejection of published repository templates and development fallbacks.
 */
export const PLACEHOLDER_SECRET_PREFIXES = [
  'generate-a-secure-',
  'host-admin-secret-',
  'test-secret-',
  'test-admin-key-',
  'replace_with_',
  'replace-with-',
  'your-secret-',
  'my-secret-',
  'development-',
  'dev-',
  'development-fallback-',
];

export const FORBIDDEN_EXAMPLE_SECRETS = new Set([
  'development-fallback-secret-min32chars',
  'development-fallback-admin-key-min32chars',
  'test-admin-key-change-in-production-min32chars',
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // Low-entropy 'test' SHA-256 digest
  'REPLACE_WITH_OPENSSL_GENERATED_32_BYTE_HEX_AUTH_SECRET',
  'REPLACE_WITH_OPENSSL_GENERATED_32_BYTE_HEX_HOST_ADMIN_KEY',
]);

export function assertSecureSecret(secret: string | undefined, keyName: string): string {
  const isTest = process.env.NODE_ENV === 'test';
  if (!secret) {
    if (isTest) {
      return `${keyName.toLowerCase()}-test-fallback-min32chars-ok`;
    }
    throw new Error(`FATAL: ${keyName} configuration is missing. Server fails closed.`);
  }

  if (!isTest) {
    if (secret.length < 32) {
      throw new Error(`FATAL: ${keyName} must be at least 32 characters long for security.`);
    }
    const lower = secret.toLowerCase();
    if (
      PLACEHOLDER_SECRET_PREFIXES.some(prefix => lower.startsWith(prefix)) ||
      FORBIDDEN_EXAMPLE_SECRETS.has(secret)
    ) {
      throw new Error(`FATAL: ${keyName} cannot use an unedited placeholder, development fallback, or example template secret in production. Generate a high-entropy secret using "openssl rand -hex 32".`);
    }
  }

  return secret;
}
