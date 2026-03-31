import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Payment method key (e.g., card, bank_transfer)',
    example: 'card',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethodKey: string;
}
