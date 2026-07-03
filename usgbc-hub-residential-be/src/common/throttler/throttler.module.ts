import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-storage.service';

/**
 * Global rate-limiting (NFR-U1-4.3). Default policy is generous; per-route
 * limits are declared with `@Throttle(limit, ttl)` on auth endpoints.
 * Storage is Redis-backed and fail-open (Q1=B).
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (_config: ConfigService, storage: RedisThrottlerStorage) => ({
        // Generous global default; auth routes tighten via @Throttle.
        ttl: 60,
        limit: 120,
        storage,
      }),
      extraProviders: [RedisThrottlerStorage],
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
