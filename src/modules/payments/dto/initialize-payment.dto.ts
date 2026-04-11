import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Payment method key (e.g., card, bank_transfer)',
    example: 'card',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethodKey: string;

  @ApiPropertyOptional({
    description: 'URL to redirect after successful payment',
    example: 'https://example.com/payment/success',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect after cancelled payment',
    example: 'https://example.com/payment/cancel',
  })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
