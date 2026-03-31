import { ApiProperty } from '@nestjs/swagger';

export class OtpResponseDto {
  @ApiProperty({
    description: 'Whether the OTP operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'OTP expiration timestamp',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  expiresAt?: Date;
}
