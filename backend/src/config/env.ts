import { readFileSync } from 'node:fs';

/** Secrets that may be supplied as a mounted file via `<NAME>_FILE` instead of a plain env var. */
const FILE_BACKED_SECRETS = ['DATABASE_URL', 'DATA_ENCRYPTION_KEY', 'JWT_SECRET'] as const;

/**
 * Resolve secrets mounted as files (the Docker / Kubernetes / Vault-agent `<NAME>_FILE` convention)
 * into the matching env var, so production can source them from a secrets manager instead of writing
 * them into a plain env file. A directly set `<NAME>` wins if both are present. Trailing whitespace
 * (the newline a secret file usually ends with) is stripped. Call this before any config is read.
 */
export function loadFileSecrets(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of FILE_BACKED_SECRETS) {
    const file = env[`${name}_FILE`];
    if (file && !env[name]) env[name] = readFileSync(file, 'utf8').trim();
  }
}

/** Fails fast at startup when a required setting is missing. */
export function validateEnv(env: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'DATA_ENCRYPTION_KEY', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}. See backend/.env.example.`);
  const key = Buffer.from(String(env.DATA_ENCRYPTION_KEY), 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).');
  if (String(env.JWT_SECRET).length < 32) throw new Error('JWT_SECRET must be at least 32 characters (openssl rand -base64 32).');
  return env;
}
