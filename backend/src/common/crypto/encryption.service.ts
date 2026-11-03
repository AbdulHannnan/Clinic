import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for medical text (history, allergies, visit notes).
 * Stored layout: 1-byte version | 12-byte IV | 16-byte auth tag | ciphertext.
 * The version byte lets a future key rotation or algorithm change coexist with old data.
 */
@Injectable()
export class EncryptionService {
  /** Current blob format. Bump when the key scheme or algorithm changes. */
  private static readonly VERSION = 1;
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('DATA_ENCRYPTION_KEY'), 'base64');
  }

  encrypt(plain: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return new Uint8Array(Buffer.concat([Buffer.from([EncryptionService.VERSION]), iv, cipher.getAuthTag(), body]));
  }

  decrypt(data: Uint8Array): string {
    const buf = Buffer.from(data);
    const version = buf[0];
    if (version !== EncryptionService.VERSION) throw new Error(`Unsupported encryption version ${version}`);
    const decipher = createDecipheriv('aes-256-gcm', this.key, buf.subarray(1, 13));
    decipher.setAuthTag(buf.subarray(13, 29));
    return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]).toString('utf8');
  }
}
