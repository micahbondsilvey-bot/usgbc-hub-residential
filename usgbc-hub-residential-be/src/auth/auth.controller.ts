import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset/password-reset.service';
import { EmailVerificationService } from './email-verification/email-verification.service';
import { UsersService } from '../users/users.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ProfileDto } from '../users/dto/profile.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './interfaces/auth-user.interface';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly emailVerification: EmailVerificationService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60)
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ProfileDto })
  me(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return this.users.getProfileOrThrow(user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): { success: boolean } {
    // Stateless JWT — client discards the token. No server session to clear.
    return { success: true };
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(5, 60)
  async requestReset(@Body() dto: RequestPasswordResetDto): Promise<{ success: boolean }> {
    await this.passwordReset.request(dto.email);
    // Generic response regardless of whether the email exists (BR-A3).
    return { success: true };
  }

  @Public()
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle(5, 60)
  async confirmReset(@Body() dto: ConfirmPasswordResetDto): Promise<{ success: boolean }> {
    await this.passwordReset.confirm(dto.token, dto.newPassword);
    return { success: true };
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ success: boolean }> {
    await this.emailVerification.verify(dto.token);
    return { success: true };
  }
}
