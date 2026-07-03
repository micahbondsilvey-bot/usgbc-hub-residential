import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface PaymentIntentInput {
  amountCents: number;
  currency: string;
  projectId: string;
}

export interface PaymentIntentResult {
  providerRef: string;
  status: 'succeeded' | 'failed';
}

/**
 * Mock payment provider seam (BR-I3). Records an intent and always succeeds in
 * this build. A real processor swaps in behind the same interface.
 */
@Injectable()
export class PaymentProvider {
  recordPaymentIntent(input: PaymentIntentInput): PaymentIntentResult {
    void input;
    return { providerRef: `mock_intent_${randomUUID()}`, status: 'succeeded' };
  }
}
