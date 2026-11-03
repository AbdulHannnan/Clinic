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
