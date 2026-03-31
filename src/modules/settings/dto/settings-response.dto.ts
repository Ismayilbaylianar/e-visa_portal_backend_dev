import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({
    description: 'Site name',
    example: 'E-Visa Portal',
  })
  siteName: string;

  @ApiProperty({
    description: 'Support email address',
    example: 'support@evisa.gov',
  })
  supportEmail: string;

  @ApiProperty({
    description: 'Default currency code',
    example: 'USD',
  })
  defaultCurrency: string;

  @ApiProperty({
    description: 'Payment timeout in hours',
    example: 24,
  })
  paymentTimeoutHours: number;

  @ApiProperty({
    description: 'Whether maintenance mode is enabled',
    example: false,
  })
  maintenanceMode: boolean;
}
