import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentPageConfigsService } from './payment-page-configs.service';
import { UpdatePaymentPageConfigDto, PaymentPageConfigResponseDto } from './dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Payment Page Config')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/paymentPageConfigs')
export class PaymentPageConfigsController {
  constructor(private readonly paymentPageConfigsService: PaymentPageConfigsService) {}

  @Get()
  @RequirePermissions('paymentPageConfigs.read')
  @ApiOperation({
    summary: 'Get payment page config',
    description: 'Get current payment page configuration. Creates default config if none exists.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current payment page config',
    type: PaymentPageConfigResponseDto,
  })
  async getConfig(): Promise<PaymentPageConfigResponseDto> {
    return this.paymentPageConfigsService.getConfig();
  }

  @Patch()
  @RequirePermissions('paymentPageConfigs.update')
  @ApiOperation({
    summary: 'Update payment page config',
    description: 'Update payment page configuration. Only provided fields will be updated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment page config updated successfully',
    type: PaymentPageConfigResponseDto,
  })
  async updateConfig(@Body() dto: UpdatePaymentPageConfigDto): Promise<PaymentPageConfigResponseDto> {
    return this.paymentPageConfigsService.updateConfig(dto);
  }
}
