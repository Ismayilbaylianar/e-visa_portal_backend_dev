import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Site name',
    example: 'E-Visa Portal',
  })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({
    description: 'Support email address',
    example: 'support@evisa.gov',
  })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({
    description: 'Default currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Payment timeout in hours',
    example: 24,
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  paymentTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Whether maintenance mode is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}
