import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MembershipModule } from '../membership/membership.module';
import { UsersModule } from '../users/users.module';

/**
 * Persistent notification framework (Unit 7). Global so any unit can inject
 * `NotificationsService` without a module import cycle. Wraps the U1
 * `NotificationGateway` mock (already global).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification]), MembershipModule, UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationFrameworkModule {}
