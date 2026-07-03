import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthService } from './local/local-auth.service';
import { PasswordResetService } from './password-reset/password-reset.service';
import { PasswordResetToken } from './password-reset/password-reset-token.entity';
import { EmailVerificationService } from './email-verification/email-verification.service';
import { EmailVerificationToken } from './email-verification/email-verification-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    TypeOrmModule.forFeature([PasswordResetToken, EmailVerificationToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalAuthService,
    PasswordResetService,
    EmailVerificationService,
    JwtAuthGuard,
  ],
  exports: [AuthService, LocalAuthService, EmailVerificationService, JwtAuthGuard],
})
export class AuthModule {}
