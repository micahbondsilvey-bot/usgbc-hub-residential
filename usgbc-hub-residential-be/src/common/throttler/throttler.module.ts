import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Global rate-limiting (NFR-U1-4.3). Per-route limits are declared with
 * `@Throttle(limit, ttl)` on auth endpoints. Uses the throttler's built-in
 * in-memory storage; the Redis-backed storage (NFR Design Q1=B) is deferred —
 * rate-limiting is fail-open and non-critical for the demo.
 */
@Global()
@Module({
  imports: [ThrottlerModule.forRoot({ ttl: 60, limit: 120 })],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
