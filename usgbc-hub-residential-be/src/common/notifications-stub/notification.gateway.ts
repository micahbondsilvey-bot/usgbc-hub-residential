import { Injectable, Logger } from '@nestjs/common';
import { maskEmail } from '../logger/mask.util';

export type NotificationChannel = 'email';

export interface NotificationMessage {
  channel: NotificationChannel;
  to: string;
  subject: string;
  body: string;
  /** Optional structured payload (e.g., token links) for future real delivery. */
  meta?: Record<string, unknown>;
}

/**
 * Mocked notification delivery (Q4=A — best-effort send). This build only logs
 * the message; a real transport is wired in a later iteration. Delivery never
 * throws into the caller's happy path.
 */
@Injectable()
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);

  send(message: NotificationMessage): void {
    try {
      this.logger.log(
        `[MOCK ${message.channel}] to=${maskEmail(message.to)} subject="${message.subject}"`,
      );
      this.logger.debug(`[MOCK ${message.channel}] body: ${message.body}`);
    } catch (err) {
      // Best-effort: swallow delivery errors so the primary flow is unaffected.
      this.logger.warn(`Notification send failed (ignored): ${(err as Error).message}`);
    }
  }
}
