import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
  Headers,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  InitializePaymentDto,
  InitializePaymentResponseDto,
  UpdatePaymentStatusDto,
  PaymentResponseDto,
  GetPaymentsQueryDto,
  PaymentTransactionDto,
  PaymentCallbackDto,
} from './dto';
import { PaymentIdParamDto } from '@/common/dto';
import {
  ApiPaginatedResponse,
  CurrentPortalIdentity,
  CurrentUser,
  RequirePermissions,
} from '@/common/decorators';
import { PortalAuthGuard, JwtAuthGuard } from '@/common/guards';
import { PortalIdentityUser, AuthenticatedUser } from '@/common/types';

@ApiTags('Payments - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.read')
  @ApiOperation({
    summary: 'Get all payments',
    description:
      'Get paginated list of payments with optional filters (Admin). Supports filtering by applicationId, paymentStatus, and paymentProviderKey.',
  })
  @ApiPaginatedResponse(PaymentResponseDto)
  async findAll(@Query() query: GetPaymentsQueryDto) {
    return this.paymentsService.findAll(query);
  }

  /**
   * M11.7 (B1) — CSV export. Streams a CSV of every payment matching
   * the same filters as the list endpoint, capped at the configured
   * EXPORT_LIMIT so an admin can't trigger an unbounded scan. The
   * `payments.export` permission gates this separately from the
   * read endpoint so an audit-only role can be granted list access
   * without bulk export.
   */
  @Get('export')
  @RequirePermissions('payments.export')
  @ApiOperation({
    summary: 'Export payments as CSV',
    description: 'Returns text/csv with the same filter set as the list endpoint.',
  })
  async exportCsv(
    @Query() query: GetPaymentsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.paymentsService.exportCsv(query);
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get(':paymentId')
  @RequirePermissions('payments.read')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Get payment details by ID including relations (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async findById(@Param() params: PaymentIdParamDto): Promise<PaymentResponseDto> {
    return this.paymentsService.findById(params.paymentId);
  }

  @Get(':paymentId/transactions')
  @RequirePermissions('payments.transactions.read')
  @ApiOperation({
    summary: 'Get payment transactions',
    description: 'Get all transactions for a payment (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment transactions',
    type: [PaymentTransactionDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async getTransactions(@Param() params: PaymentIdParamDto): Promise<PaymentTransactionDto[]> {
    return this.paymentsService.getTransactions(params.paymentId);
  }

  @Get(':paymentId/callbacks')
  @RequirePermissions('payments.transactions.read')
  @ApiOperation({
    summary: 'Get payment callbacks',
    description: 'Get all callbacks for a payment (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment callbacks',
    type: [PaymentCallbackDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async getCallbacks(@Param() params: PaymentIdParamDto): Promise<PaymentCallbackDto[]> {
    return this.paymentsService.getCallbacks(params.paymentId);
  }

  @Patch(':paymentId/status')
  @RequirePermissions('payments.update')
  @ApiOperation({
    summary: 'Update payment status',
    description: 'Update the status of a payment (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async updateStatus(
    @Param() params: PaymentIdParamDto,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.updateStatus(params.paymentId, dto, user.id);
  }
}

@ApiTags('Payments - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal/payments')
export class PaymentsPortalController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create payment',
    description: 'Create a new payment for an application (Portal)',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or application not in correct status',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async create(
    @Body() dto: CreatePaymentDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.create(dto, portalIdentity.id);
  }

  @Post(':paymentId/initialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initialize payment',
    description:
      'Initialize a payment with a specific payment method. Returns provider session ID and redirect URL for payment page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initialized successfully with redirect URL',
    type: InitializePaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Payment cannot be initialized or has expired',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async initialize(
    @Param() params: PaymentIdParamDto,
    @Body() dto: InitializePaymentDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<InitializePaymentResponseDto> {
    return this.paymentsService.initialize(params.paymentId, dto, portalIdentity.id);
  }

  @Get(':paymentId')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Get payment details for the current portal user (Portal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async findById(
    @Param() params: PaymentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.findByIdForPortal(params.paymentId, portalIdentity.id);
  }

  /**
   * M11.13 (BUG S) — Confirm a mock-provider payment.
   *
   * Customer-side payment page calls this between `initialize` and
   * `submit` so the payment row actually flips to PAID (and the
   * application's paymentStatus cascades + the payment.success email
   * fires). Real-provider integrations (Payriff) will NOT use this
   * endpoint — they go through the proper webhook callback path.
   * Service-layer guard enforces `paymentProviderKey === 'mockProvider'`.
   */
  @Post(':paymentId/confirm-mock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm mock payment',
    description:
      "Marks a mock-provider payment as PAID. Idempotent (returns the existing row if already PAID). Rejects when the provider isn't 'mockProvider' or the session has expired.",
  })
  @ApiResponse({ status: 200, description: 'Payment confirmed', type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Wrong provider, wrong state, or expired session' })
  @ApiResponse({ status: 403, description: 'Caller does not own the application' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmMock(
    @Param() params: PaymentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.confirmMockPayment(params.paymentId, portalIdentity.id);
  }
}

@ApiTags('Payments - Public')
@Controller('public/paymentCallbacks')
export class PaymentsPublicController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':providerKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle payment callback',
    description: `Receive and process payment provider callbacks (Public, no auth required).
    
**Behavior:**
- Stores raw callback data (headers and payload)
- Attempts to match payment by paymentReference or providerPaymentId
- Validates callback signature if provider supports it
- Updates payment status based on callback content
- Creates transaction record for audit

**Mock Provider:**
- Accepts any callback with paymentReference field
- Maps status field to internal payment status
- No signature validation (marked as NOT_APPLICABLE)`,
  })
  @ApiParam({
    name: 'providerKey',
    description: 'Payment provider key (e.g., mockProvider; MSolution later)',
    example: 'mockProvider',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback received and processed',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'boolean', example: true },
        callbackId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },
  })
  async handleCallback(
    @Param('providerKey') providerKey: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ): Promise<{ received: boolean; callbackId: string }> {
    return this.paymentsService.handleCallback(providerKey, headers, payload);
  }
}
