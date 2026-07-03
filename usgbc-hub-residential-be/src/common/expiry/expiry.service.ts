import { Injectable } from '@nestjs/common';

/**
 * Single monotonic clock + TTL helper (BR-X4). Mockable so PBT can drive
 * deterministic time for token/invitation expiry invariants.
 */
@Injectable()
export class ExpiryService {
  /** Current time. Overridable in tests. */
  now(): Date {
    return new Date();
  }

  /**
   * Compute an absolute expiry from a duration string like `1h`, `7d`, `30m`, `45s`.
   */
  expiryFrom(ttl: string, from: Date = this.now()): Date {
    return new Date(from.getTime() + this.parseTtlMs(ttl));
  }

  isExpired(expiresAt: Date, at: Date = this.now()): boolean {
    return at.getTime() > expiresAt.getTime();
  }

  /** Parse a TTL string into milliseconds. Supports s, m, h, d suffixes. */
  parseTtlMs(ttl: string): number {
    const match = /^(\d+)\s*(s|m|h|d)$/.exec(ttl.trim());
    if (!match) {
      const asNumber = Number.parseInt(ttl, 10);
      return Number.isFinite(asNumber) ? asNumber : 0;
    }
    const value = Number.parseInt(match[1], 10);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * unitMs[unit];
  }
}
