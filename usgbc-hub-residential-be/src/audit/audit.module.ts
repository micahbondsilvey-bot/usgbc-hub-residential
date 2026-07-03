import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditStampHelper } from './audit-stamp.helper';
import { AuditStampSubscriber } from './audit-stamp.subscriber';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, AuditStampHelper, AuditStampSubscriber],
  exports: [AuditService, AuditStampHelper],
})
export class AuditModule {}
