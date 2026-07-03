import { ApiProperty } from '@nestjs/swagger';
import { GlobalRole } from '../../auth/enums/role.enum';

/** Public profile projection (never includes passwordHash). */
export class ProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ nullable: true })
  organization!: string | null;

  @ApiProperty({ nullable: true })
  greenRaterCredentialId!: string | null;

  @ApiProperty({ enum: GlobalRole })
  globalRole!: GlobalRole;

  @ApiProperty({ nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ nullable: true })
  lastLoginAt!: Date | null;
}
