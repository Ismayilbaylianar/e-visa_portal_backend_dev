import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsObject, IsArray } from 'class-validator';

export class UpdatePaymentPageConfigDto {
  @ApiPropertyOptional({
    description: 'Page title',
    example: 'Complete Your Payment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Page description',
    example: 'Please review your order and complete the payment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Page sections configuration as JSON',
    example: [{ type: 'summary', title: 'Order Summary' }],
  })
  @IsOptional()
  @IsArray()
  sectionsJson?: any;

  @ApiPropertyOptional({
    description: 'Whether the config is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
