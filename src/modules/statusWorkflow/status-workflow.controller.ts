import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatusWorkflowService } from './status-workflow.service';
import { GetTransitionsQueryDto, TransitionsResponseDto, EntityType } from './dto';
import { JwtAuthGuard } from '@/common/guards';
import { ApplicationStatus, ApplicantStatus, PaymentStatus } from '@prisma/client';
import { BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@ApiTags('Status Workflow - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/statusWorkflow')
export class StatusWorkflowController {
  constructor(private readonly statusWorkflowService: StatusWorkflowService) {}

  @Get('transitions')
  @ApiOperation({
    summary: 'Get allowed status transitions',
    description:
      'Get the list of allowed status transitions for a given entity type and current status',
  })
  @ApiResponse({
    status: 200,
    description: 'Allowed transitions',
    type: TransitionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid entity type or status',
  })
  async getTransitions(@Query() query: GetTransitionsQueryDto): Promise<TransitionsResponseDto> {
    const { entityType, currentStatus } = query;

    let allowedTransitions: string[] = [];

    switch (entityType) {
      case EntityType.APPLICATION:
        if (!Object.values(ApplicationStatus).includes(currentStatus as ApplicationStatus)) {
          throw new BadRequestException('Invalid application status', [
            { reason: ErrorCodes.BAD_REQUEST, message: `Invalid status: ${currentStatus}` },
          ]);
        }
        allowedTransitions = this.statusWorkflowService.getNextApplicationStatuses(
          currentStatus as ApplicationStatus,
        );
        break;

      case EntityType.APPLICANT:
        if (!Object.values(ApplicantStatus).includes(currentStatus as ApplicantStatus)) {
          throw new BadRequestException('Invalid applicant status', [
            { reason: ErrorCodes.BAD_REQUEST, message: `Invalid status: ${currentStatus}` },
          ]);
        }
        allowedTransitions = this.statusWorkflowService.getNextApplicantStatuses(
          currentStatus as ApplicantStatus,
        );
        break;

      case EntityType.PAYMENT:
        if (!Object.values(PaymentStatus).includes(currentStatus as PaymentStatus)) {
          throw new BadRequestException('Invalid payment status', [
            { reason: ErrorCodes.BAD_REQUEST, message: `Invalid status: ${currentStatus}` },
          ]);
        }
        allowedTransitions = this.statusWorkflowService.getNextPaymentStatuses(
          currentStatus as PaymentStatus,
        );
        break;

      default:
        throw new BadRequestException('Invalid entity type', [
          { reason: ErrorCodes.BAD_REQUEST, message: `Invalid entity type: ${entityType}` },
        ]);
    }

    return {
      entityType,
      currentStatus,
      allowedTransitions,
    };
  }
}
