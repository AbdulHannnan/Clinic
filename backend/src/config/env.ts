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
