import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@residential.test' })
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
