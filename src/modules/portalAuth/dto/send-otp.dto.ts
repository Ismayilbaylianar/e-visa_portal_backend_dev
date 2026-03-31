import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address to send OTP',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
