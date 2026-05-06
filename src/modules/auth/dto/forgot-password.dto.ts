import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Admin email address. The endpoint always responds 200 to avoid leaking which emails exist.',
    example: 'admin@example.com',
  })
  @IsString()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;
}
