import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/common/crypto/encryption.service';

test('medical text round-trips and is not stored in plain text', () => {
  const svc = new EncryptionService(new ConfigService({ DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
  const plain = 'Type 2 diabetes. Allergic to penicillin.';
  const enc = svc.encrypt(plain);
  assert.ok(!Buffer.from(enc).toString('utf8').includes('diabetes'));
  assert.equal(svc.decrypt(enc), plain);
});

test('AAD binds ciphertext to its context: the same aad decrypts, a different one fails', () => {
  const svc = new EncryptionService(new ConfigService({ DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
  const enc = svc.encrypt('Allergic to penicillin.', 'patient:abc:allergies');
  assert.equal(svc.decrypt(enc, 'patient:abc:allergies'), 'Allergic to penicillin.');
  assert.throws(() => svc.decrypt(enc, 'patient:xyz:allergies')); // moved to another patient
  assert.throws(() => svc.decrypt(enc)); // aad dropped entirely
});

test('blob carries a version byte and an unknown version is rejected', () => {
  const svc = new EncryptionService(new ConfigService({ DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
  const enc = svc.encrypt('BP normal');
  assert.equal(enc[0], 1); // current version prefix
  const foreign = Buffer.from(enc);
  foreign[0] = 2; // pretend it was written by a future scheme
  assert.throws(() => svc.decrypt(foreign), /Unsupported encryption version 2/);
});
