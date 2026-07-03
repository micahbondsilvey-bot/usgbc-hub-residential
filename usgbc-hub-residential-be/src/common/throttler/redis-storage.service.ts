import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Mirrors @nestjs/throttler's ThrottlerStorageRecord without a fragile deep import. */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
}

/**
 * Redis-backed ThrottlerStorage (NFR Design Q1=B). Configured fail-open: if
 * Redis is unavailable locally, requests are not blocked (resilience for a
 * local demo). Implements ThrottlerStorage directly via ioredis — no
 * third-party storage adapter needed.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private healthy = true;

  constructor(config: ConfigService) {
    const host = config.get<string>('redis.host', 'localhost');
    const port = config.get<number>('redis.port', 6379);
    this.redis = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      if (this.healthy) {
        this.healthy = false;
        this.logger.warn(`Redis throttler storage unavailable (fail-open): ${err.message}`);
      }
    });
    this.redis.connect().catch(() => {
      this.healthy = false;
    });
  }

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const storageKey = `throttle:${key}`;
    try {
      const totalHits = await this.redis.incr(storageKey);
      if (totalHits === 1) {
        await this.redis.expire(storageKey, ttl);
      }
      const ttlRemaining = await this.redis.ttl(storageKey);
      return {
        totalHits,
        timeToExpire: ttlRemaining > 0 ? ttlRemaining : ttl,
      };
    } catch (err) {
      // Fail-open: pretend this is the first (and only) hit so the guard allows it.
      this.logger.debug(`Throttler fail-open for ${key}: ${(err as Error).message}`);
      return { totalHits: 1, timeToExpire: ttl };
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
