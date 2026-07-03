import { Global, Module } from '@nestjs/common';
import { OneTimeTokenService } from './one-time-token.service';
import { ExpiryService } from '../expiry/expiry.service';

@Global()
@Module({
  providers: [OneTimeTokenService, ExpiryService],
  exports: [OneTimeTokenService, ExpiryService],
})
export class TokensModule {}
