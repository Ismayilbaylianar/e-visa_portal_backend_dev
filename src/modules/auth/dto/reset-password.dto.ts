import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Plain reset token from the URL query string. The DB stores its sha256 hash.',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: '8+ chars, must contain at least one letter, one number, and one symbol.',
    example: 'NewSecure!42',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one symbol' })
  newPassword: string;
}
