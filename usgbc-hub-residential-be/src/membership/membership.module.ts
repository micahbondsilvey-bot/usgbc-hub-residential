import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMembership } from './project-membership.entity';
import { Invitation } from './invitation.entity';
import { MembershipService } from './membership.service';
import { InvitationService } from './invitation.service';
import {
  InvitationsController,
  ProjectMembershipController,
} from './invitations.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectMembership, Invitation]),
    UsersModule,
    AuthModule,
  ],
  controllers: [ProjectMembershipController, InvitationsController],
  providers: [MembershipService, InvitationService],
  exports: [MembershipService, InvitationService],
})
export class MembershipModule {}
