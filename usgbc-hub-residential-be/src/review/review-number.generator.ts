import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Allocates sequential `REV-######` review numbers (BR-RW1). */
@Injectable()
export class ReviewNumberGenerator {
  async allocate(manager: EntityManager): Promise<string> {
    const rows = (await manager.query(
      "SELECT nextval('reviews_display_seq') AS n",
    )) as Array<{ n: string }>;
    return `REV-${rows[0]?.n}`;
  }
}
