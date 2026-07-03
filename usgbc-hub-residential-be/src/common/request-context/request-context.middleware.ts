import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * Opens an AsyncLocalStorage scope for every request so downstream code can
 * read the current actor. The actor id starts null and is populated by the
 * JwtAuthGuard once the bearer token is verified (BR-Z4).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.context.run({ actorUserId: null, requestId: randomUUID() }, () => next());
  }
}
