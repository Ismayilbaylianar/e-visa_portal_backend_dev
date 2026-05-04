import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  UpdateApplicantStatusDto,
  UpdateApplicantEmailDto,
  ApplicantResponseDto,
  ApplicantStatusHistoryEntryDto,
} from './dto';
import { ApplicationIdParamDto, ApplicantIdParamDto } from '@/common/dto';
import { CurrentPortalIdentity, CurrentUser, RequirePermissions } from '@/common/decorators';
import { PortalAuthGuard, JwtAuthGuard } from '@/common/guards';
import { PortalIdentityUser, AuthenticatedUser } from '@/common/types';

@ApiTags('Applicants - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal')
export class ApplicantsPortalController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Get('applications/:applicationId/applicants')
  @ApiOperation({
    summary: 'Get applicants for application',
    description: 'Get all applicants for a specific application',
  })
  @ApiResponse({
    status: 200,
    description: 'List of applicants',
    type: [ApplicantResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async findByApplication(
    @Param() params: ApplicationIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicantResponseDto[]> {
    return this.applicantsService.findByApplication(params.applicationId, portalIdentity.id);
  }

  @Get('applicants/:applicantId')
  @ApiOperation({
    summary: 'Get applicant by ID',
    description: 'Get applicant details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Applicant details',
    type: ApplicantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  async findById(
    @Param() params: ApplicantIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.findById(params.applicantId, portalIdentity.id);
  }

  @Post('applications/:applicationId/applicants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create applicant',
    description: 'Create a new applicant under an application',
  })
  @ApiResponse({
    status: 201,
    description: 'Applicant created successfully',
    type: ApplicantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied or main applicant already exists',
  })
  async create(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: CreateApplicantDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.create(params.applicationId, portalIdentity.id, dto);
  }

  @Patch('applicants/:applicantId')
  @ApiOperation({
    summary: 'Update applicant',
    description: 'Update applicant details',
  })
  @ApiResponse({
    status: 200,
    description: 'Applicant updated successfully',
    type: ApplicantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  async update(
    @Param() params: ApplicantIdParamDto,
    @Body() dto: UpdateApplicantDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.update(params.applicantId, portalIdentity.id, dto);
  }

  @Delete('applicants/:applicantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete applicant',
    description: 'Soft delete an applicant',
  })
  @ApiResponse({
    status: 204,
    description: 'Applicant deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  async delete(
    @Param() params: ApplicantIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<void> {
    return this.applicantsService.delete(params.applicantId, portalIdentity.id);
  }
}

@ApiTags('Applicants - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/applicants')
export class ApplicantsAdminController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Patch(':applicantId/status')
  @RequirePermissions('applications.update')
  @ApiOperation({
    summary: 'Update applicant status',
    description:
      'Update the status of one applicant. Writes both the applicant_status_history row (customer-visible timeline) and an `applicant.status.update` audit log (admin forensics).',
  })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Applicant status updated successfully',
    type: ApplicantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  async updateStatus(
    @Param() params: ApplicantIdParamDto,
    @Body() dto: UpdateApplicantStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.updateStatus(params.applicantId, user.id, dto);
  }

  /**
   * Module 9 — admin-only: per-applicant email correction. Common
   * use-case: customer support flags a typo (`gmial.com`); admin
   * fixes from the Operations Center without forcing the customer
   * to re-submit the whole application.
   */
  @Patch(':applicantId/email')
  @RequirePermissions('applications.update')
  @ApiOperation({
    summary: 'Update applicant email (admin)',
    description:
      'Correct an applicant email post-submission. The change is captured in the `applicant.email.update` audit log with the old + new values and an optional reason so support can later trace what changed and why.',
  })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 200, type: ApplicantResponseDto })
  @ApiResponse({ status: 404, description: 'Applicant not found' })
  async updateEmail(
    @Param() params: ApplicantIdParamDto,
    @Body() dto: UpdateApplicantEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.updateEmail(params.applicantId, user.id, dto);
  }

  /**
   * Module 9 — full per-applicant status timeline (newest first).
   * Each row includes the actor's name + email so the UI can render
   * "by Anar Ismayilbayli — 5m ago" without a second user fetch.
   */
  @Get(':applicantId/status-history')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Per-applicant status timeline',
    description:
      'Returns every recorded status transition for one applicant, newest first. Actor is resolved server-side from the User table.',
  })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 200, type: [ApplicantStatusHistoryEntryDto] })
  @ApiResponse({ status: 404, description: 'Applicant not found' })
  async getStatusHistory(
    @Param() params: ApplicantIdParamDto,
  ): Promise<ApplicantStatusHistoryEntryDto[]> {
    return this.applicantsService.getStatusHistory(params.applicantId);
  }
}
