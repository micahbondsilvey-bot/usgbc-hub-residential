import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ProjectRole } from '../../auth/enums/role.enum';
import { InvitationState } from '../invitation.entity';

export class CreateInvitationDto {
  @ApiProperty({ example: 'invitee@residential.test' })
  @IsEmail()
  inviteeEmail!: string;

  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  projectRole!: ProjectRole;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  token!: string;

  // Supplied only when the invitee has no account yet (BR-I4).
  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class DeclineInvitationDto {
  @ApiProperty()
  @IsString()
  token!: string;
}

export class InvitationPreviewDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  inviteeEmail!: string;

  @ApiProperty({ enum: ProjectRole })
  projectRole!: ProjectRole;

  @ApiProperty({ enum: InvitationState })
  state!: InvitationState;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  accountExists!: boolean;
}

export class MemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: ProjectRole })
  projectRole!: ProjectRole;

  @ApiProperty({ nullable: true })
  acceptedAt!: Date | null;
}
