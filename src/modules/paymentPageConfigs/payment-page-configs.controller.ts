import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentPageConfigsService } from './payment-page-configs.service';
import { UpdatePaymentPageConfigDto, PaymentPageConfigResponseDto } from './dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

/**
 * Module 5 — Admin Payment Page Config (singleton).
 *
 * No POST / DELETE — there is exactly one row per environment. GET
 * auto-creates with sane defaults on first read; PATCH updates in
 * place and emits a single audit log entry per save with full
 * before/after snapshots.
 *
 * Class-level @UseGuards(JwtAuthGuard) keeps JwtAuthGuard before
 * PermissionsGuard in the resolved chain (Modul 1 / 1.5 / 2 / 3 / 4
 * lesson — inverting at method scope causes PermissionsGuard to run
 * first against undefined request.user → 403).
 */
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
    description:
      'Get current payment page configuration. Creates default config if none exists.',
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
    description:
      'Update payment page configuration. Only provided fields are updated. A single audit log entry (paymentPageConfig.update) is emitted per save with full before/after snapshots.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment page config updated successfully',
    type: PaymentPageConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (invalid type / out-of-range integer)',
  })
  async updateConfig(
    @Body() dto: UpdatePaymentPageConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentPageConfigResponseDto> {
    return this.paymentPageConfigsService.updateConfig(dto, currentUser.id);
  }
}
