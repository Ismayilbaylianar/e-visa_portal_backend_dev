import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentPageConfigsService } from './payment-page-configs.service';
import { PaymentPageConfigResponseDto, UpdatePaymentPageConfigDto } from './dto';

@ApiTags('Payment Page Config')
@ApiBearerAuth('JWT-auth')
@Controller('admin/paymentPageConfig')
export class PaymentPageConfigsController {
  constructor(private readonly paymentPageConfigsService: PaymentPageConfigsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get payment page config',
    description: 'Get the current payment page configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment page configuration',
    type: PaymentPageConfigResponseDto,
  })
  async get(): Promise<PaymentPageConfigResponseDto> {
    return this.paymentPageConfigsService.get();
  }

  @Patch()
  @ApiOperation({
    summary: 'Update payment page config',
    description: 'Update the payment page configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated payment page configuration',
    type: PaymentPageConfigResponseDto,
  })
  async update(@Body() dto: UpdatePaymentPageConfigDto): Promise<PaymentPageConfigResponseDto> {
    return this.paymentPageConfigsService.update(dto);
  }
}
