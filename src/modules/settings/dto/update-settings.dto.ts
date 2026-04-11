import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Site name',
    example: 'E-Visa Portal',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Site name must be at least 2 characters' })
  @MaxLength(200, { message: 'Site name must not exceed 200 characters' })
  siteName?: string;

  @ApiPropertyOptional({
    description: 'Support email address',
    example: 'support@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  supportEmail?: string;

  @ApiPropertyOptional({
    description: 'Default currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Currency code must be 3 characters' })
  @MaxLength(3, { message: 'Currency code must be 3 characters' })
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Payment timeout in hours',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Payment timeout must be at least 1 hour' })
  @Max(168, { message: 'Payment timeout must not exceed 168 hours (7 days)' })
  paymentTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Whether maintenance mode is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}
