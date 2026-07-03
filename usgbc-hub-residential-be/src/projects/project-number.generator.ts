import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Allocates sequential `RES-######` project numbers from a Postgres sequence (BR-N1). */
@Injectable()
export class ProjectNumberGenerator {
  /** Allocate the next display id. Must run inside the registration transaction. */
  async allocate(manager: EntityManager): Promise<string> {
    const rows = (await manager.query(
      "SELECT nextval('projects_display_seq') AS n",
    )) as Array<{ n: string }>;
    const n = rows[0]?.n;
    return `RES-${n}`;
  }
}
