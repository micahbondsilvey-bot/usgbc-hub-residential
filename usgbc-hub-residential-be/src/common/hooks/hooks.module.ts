import { Global, Module } from '@nestjs/common';
import { WorkbookAttemptHookRegistry } from './workbook-attempt-hook.registry';

@Global()
@Module({
  providers: [WorkbookAttemptHookRegistry],
  exports: [WorkbookAttemptHookRegistry],
})
export class HooksModule {}
