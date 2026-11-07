import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFileSecrets } from '../src/config/env';

const secretFile = (contents: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'clinic-secret-')), 'secret');
  writeFileSync(path, contents);
  return path;
};

test('loadFileSecrets reads a <NAME>_FILE secret into its env var and trims the trailing newline', () => {
  const env: NodeJS.ProcessEnv = { JWT_SECRET_FILE: secretFile('super-secret-token-value\n') };
  loadFileSecrets(env);
  assert.equal(env.JWT_SECRET, 'super-secret-token-value');
});

test('a directly set secret wins over its <NAME>_FILE', () => {
  const env: NodeJS.ProcessEnv = { JWT_SECRET: 'inline', JWT_SECRET_FILE: secretFile('from-file') };
  loadFileSecrets(env);
  assert.equal(env.JWT_SECRET, 'inline');
});

test('loadFileSecrets is a no-op when no <NAME>_FILE is set', () => {
  const env: NodeJS.ProcessEnv = { JWT_SECRET: 'inline' };
  loadFileSecrets(env);
  assert.deepEqual(env, { JWT_SECRET: 'inline' });
});
