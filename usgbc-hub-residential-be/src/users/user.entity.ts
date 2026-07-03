import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { GlobalRole } from '../auth/enums/role.enum';

/**
 * Platform user (domain-entities.md → User). Inherits AuditBase (id + audit
 * columns). Email is unique, lowercased. Project roles are NOT stored here —
 * they live on ProjectMembership.
 */
@Entity('users')
export class User extends AuditBase {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  organization!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  greenRaterCredentialId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'enum', enum: GlobalRole, default: GlobalRole.USER })
  globalRole!: GlobalRole;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;
}
