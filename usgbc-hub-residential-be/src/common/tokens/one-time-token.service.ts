import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface GeneratedToken {
  /** URL-safe cleartext token — sent via (mocked) email, never persisted. */
  cleartext: string;
  /** SHA-256 hash of the cleartext — the only value stored (BR: token hash). */
  hash: string;
}

/**
 * Generates and verifies one-time tokens. Cleartext is 32 random bytes,
 * base64url-encoded; only the SHA-256 hash is persisted (NFR Design Q7=A).
 */
@Injectable()
export class OneTimeTokenService {
  generate(): GeneratedToken {
    const cleartext = randomBytes(32).toString('base64url');
    return { cleartext, hash: this.hash(cleartext) };
  }

  hash(cleartext: string): string {
    return createHash('sha256').update(cleartext).digest('hex');
  }

  /** Constant-time comparison of a supplied cleartext against a stored hash. */
  matches(cleartext: string, storedHash: string): boolean {
    const computed = Buffer.from(this.hash(cleartext), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    if (computed.length !== stored.length) return false;
    return timingSafeEqual(computed, stored);
  }
}
