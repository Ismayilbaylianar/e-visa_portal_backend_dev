import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ description: 'Settings ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Site name', example: 'E-Visa Portal' })
  siteName: string;

  @ApiProperty({ description: 'Support email', example: 'support@example.com' })
  supportEmail: string;

  @ApiProperty({ description: 'Default currency code', example: 'USD' })
  defaultCurrency: string;

  @ApiProperty({ description: 'Payment timeout in hours', example: 3 })
  paymentTimeoutHours: number;

  @ApiProperty({ description: 'Whether maintenance mode is enabled', example: false })
  maintenanceMode: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
