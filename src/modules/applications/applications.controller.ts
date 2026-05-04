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
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { ApplicationsService } from './applications.service';
import { ApplicantsService } from '../applicants/applicants.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  RequestDocumentsDto,
  UpdateEstimatedTimeDto,
  EstimatedTimeChangeEntryDto,
} from './dto';
import { IssueVisaDto, IssueVisaResponseDto, IssuedVisaResponseDto } from '../applicants/dto';
import { ApplicationIdParamDto } from '@/common/dto';
import {
  ApiPaginatedResponse,
  CurrentPortalIdentity,
  CurrentUser,
  RequirePermissions,
} from '@/common/decorators';
import { PortalAuthGuard, JwtAuthGuard } from '@/common/guards';
import { PortalIdentityUser, AuthenticatedUser } from '@/common/types';

/**
 * Multer file shape — same as documents.controller pattern. Avoids
 * pulling Express multer types into our public surface.
 */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Applications - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/applications')
export class ApplicationsAdminController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    /** Module 9 — issue-visa endpoint lives here (under
     *  /admin/applications/:id/applicants/:applicantId/...) but the
     *  business logic is in ApplicantsService for cohesion. */
    private readonly applicantsService: ApplicantsService,
  ) {}

  @Get()
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Get all applications',
    description: 'Get paginated list of applications with optional filters (Admin)',
  })
  @ApiPaginatedResponse(ApplicationResponseDto)
  async findAll(@Query() query: GetApplicationsQueryDto) {
    return this.applicationsService.findAll(query);
  }

  @Get(':applicationId')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Get application by ID',
    description: 'Get application details by ID including relations (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application details',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async findById(@Param() params: ApplicationIdParamDto): Promise<ApplicationResponseDto> {
    return this.applicationsService.findById(params.applicationId);
  }

  @Post(':applicationId/approve')
  @RequirePermissions('applications.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve application',
    description: 'Approve a submitted application. Status must be SUBMITTED or IN_REVIEW.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application approved successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Application cannot be approved in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async approve(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: ApproveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.approveApplication(params.applicationId, dto, user.id);
  }

  @Post(':applicationId/reject')
  @RequirePermissions('applications.reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject application',
    description: 'Reject a submitted application with a required reason.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application rejected successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Application cannot be rejected in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async reject(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.rejectApplication(params.applicationId, dto, user.id);
  }

  @Post(':applicationId/request-documents')
  @RequirePermissions('applications.request_documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request additional documents',
    description: 'Request applicant to provide additional or corrected documents.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents requested successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot request documents for application in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async requestDocuments(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: RequestDocumentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.requestDocuments(params.applicationId, dto, user.id);
  }

  @Post(':applicationId/start-review')
  @RequirePermissions('applications.start_review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start application review',
    description: 'Move application from SUBMITTED to IN_REVIEW status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application moved to IN_REVIEW status',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Application cannot be moved to review in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async startReview(
    @Param() params: ApplicationIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.startReview(params.applicationId, user.id);
  }

  // ========================================================
  // Module 9 — Operations Center
  // ========================================================

  /**
   * Upload an issued visa PDF for one applicant. Multipart form-data
   * with a `file` field plus optional referenceNumber + notes. Replaces
   * any prior issued visa for the same applicant (audit captures the
   * replacement). Auto-transitions the parent application to
   * READY_TO_DOWNLOAD when all applicants have a visa.
   *
   * Permission: `applications.update` — same gate as approve/reject.
   * Status guard inside the service: only APPROVED applications.
   */
  @Post(':applicationId/applicants/:applicantId/issue-visa')
  @RequirePermissions('applications.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Issue visa for an applicant',
    description:
      'Upload the issued visa PDF for one applicant. Multipart form-data: `file` (PDF, max 20MB), optional `referenceNumber`, optional `notes`. Replaces any existing visa for this applicant. When ALL applicants on the application have an issued visa, the application transitions to READY_TO_DOWNLOAD and the customer ready-to-download email queues.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 201, type: IssueVisaResponseDto })
  @ApiResponse({ status: 400, description: 'Missing file, wrong mime type, or oversize' })
  @ApiResponse({ status: 404, description: 'Application or applicant not found' })
  @ApiResponse({ status: 409, description: 'Application is not in APPROVED status' })
  @HttpCode(HttpStatus.CREATED)
  async issueVisa(
    @Param('applicationId') applicationId: string,
    @Param('applicantId') applicantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: IssueVisaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IssueVisaResponseDto> {
    return this.applicantsService.issueVisa(applicationId, applicantId, user.id, file, dto);
  }

  /**
   * Read issued-visa metadata for the Operations Center widget.
   * 404 when no visa has been issued yet.
   */
  @Get(':applicationId/applicants/:applicantId/visa')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Get issued-visa metadata for an applicant',
    description: 'Returns filename, size, checksum, issuance timestamp + admin who issued.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 200, type: IssuedVisaResponseDto })
  @ApiResponse({ status: 404, description: 'No visa issued yet' })
  async getIssuedVisa(
    @Param('applicationId') applicationId: string,
    @Param('applicantId') applicantId: string,
  ): Promise<IssuedVisaResponseDto> {
    return this.applicantsService.getIssuedVisa(applicationId, applicantId);
  }

  /**
   * Update the SLA estimate. `reason` is required (1-500 chars).
   * Every change writes an `application_estimated_time_changes` row +
   * an `application.estimated_time.update` audit log entry.
   */
  @Patch(':applicationId/estimated-time')
  @RequirePermissions('applications.update')
  @ApiOperation({
    summary: 'Update estimated processing time',
    description:
      'Set or change the SLA estimate (days). `reason` is required so the customer-facing history page can show "why did the estimate change?". A no-op when the new value equals the current value.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed (reason too short, days out of range)' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateEstimatedTime(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: UpdateEstimatedTimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.updateEstimatedTime(
      params.applicationId,
      user.id,
      dto,
    );
  }

  /**
   * Full estimate-change history for an application (newest first).
   */
  @Get(':applicationId/estimated-time-changes')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Estimated-time change history',
    description: 'Every adjustment to the SLA estimate, with old/new days, reason, and actor.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, type: [EstimatedTimeChangeEntryDto] })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getEstimatedTimeChanges(
    @Param() params: ApplicationIdParamDto,
  ): Promise<EstimatedTimeChangeEntryDto[]> {
    return this.applicationsService.getEstimatedTimeChanges(params.applicationId);
  }
}

@ApiTags('Applications - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal')
export class ApplicationsPortalController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    /** Module 9 — visa download endpoints route through ApplicantsService
     *  so the ownership check + audit logic stays in one place. */
    private readonly applicantsService: ApplicantsService,
  ) {}

  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create application',
    description: 'Create a new visa application (Portal)',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or no template binding found',
  })
  async create(
    @Body() dto: CreateApplicationDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.create(dto, portalIdentity.id);
  }

  @Get('me/applications/:applicationId')
  @ApiOperation({
    summary: 'Get my application by ID',
    description: 'Get application details for the current portal user (Portal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application details',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async findMyApplication(
    @Param() params: ApplicationIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findByIdForPortal(params.applicationId, portalIdentity.id);
  }

  @Patch('applications/:applicationId')
  @ApiOperation({
    summary: 'Update application',
    description: 'Update application details (Portal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft applications can be updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async update(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: UpdateApplicationDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.update(params.applicationId, dto, portalIdentity.id);
  }

  @Post('applications/:applicationId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit application for review',
    description: 'Submit a draft application for review and payment (Portal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application submitted for review',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft applications can be submitted for review',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async submitForReview(
    @Param() params: ApplicationIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.submitForReview(params.applicationId, portalIdentity.id);
  }

  @Post('applications/:applicationId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit application',
    description: 'Submit a paid application for processing (Portal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application submitted for processing',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Payment must be completed before submitting',
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async submit(
    @Param() params: ApplicationIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.submit(params.applicationId, portalIdentity.id);
  }

  @Get('applications/resume/:resumeToken')
  @ApiOperation({
    summary: 'Get application by resume token',
    description:
      'Resume an application using the resume token. Must belong to current portal identity.',
  })
  @ApiParam({
    name: 'resumeToken',
    description: 'Resume token for the application',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Application details',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - application belongs to another user',
  })
  async getByResumeToken(
    @Param('resumeToken') resumeToken: string,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.getByResumeToken(resumeToken, portalIdentity.id);
  }

  // ========================================================
  // Module 9 — Customer visa download
  // ========================================================

  /**
   * Stream the issued visa PDF inline as `application/pdf`. Auth
   * check inside the service confirms the portal session owns the
   * application. Audit emits `application.visa_downloaded` with
   * actor=PORTAL_IDENTITY so the admin audit feed clearly shows
   * customer-side downloads.
   */
  @Get('applications/:applicationId/applicants/:applicantId/visa')
  @ApiOperation({
    summary: 'Download issued visa PDF',
    description:
      'Streams the visa PDF with Content-Disposition: attachment. Validates the portal session owns the application before serving.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 200, description: 'PDF binary' })
  @ApiResponse({ status: 403, description: 'Application does not belong to current portal user' })
  @ApiResponse({ status: 404, description: 'Visa not issued yet' })
  async downloadMyVisa(
    @Param('applicationId') applicationId: string,
    @Param('applicantId') applicantId: string,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.applicantsService.downloadVisaForPortal(
      applicationId,
      applicantId,
      portalIdentity.id,
      req.ip,
      req.get('user-agent'),
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Content-Length', String(result.buffer.length));
    res.send(result.buffer);
  }

  /**
   * Issue a 24-hour signed URL for the visa PDF. Useful when the
   * customer wants to share the URL with their travel agent / inbox
   * without the portal proxying the bytes.
   */
  @Get('applications/:applicationId/applicants/:applicantId/visa/url')
  @ApiOperation({
    summary: 'Get a signed URL for the issued visa (24h expiry)',
    description:
      'Returns a download URL valid for 24 hours. Same ownership checks as the streaming endpoint; the URL is only minted after auth passes.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiParam({ name: 'applicantId', description: 'Applicant UUID' })
  @ApiResponse({ status: 200, description: 'Signed URL + expiresAt' })
  async getMyVisaSignedUrl(
    @Param('applicationId') applicationId: string,
    @Param('applicantId') applicantId: string,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<{ url: string; expiresAt: Date }> {
    return this.applicantsService.getVisaSignedUrlForPortal(
      applicationId,
      applicantId,
      portalIdentity.id,
    );
  }
}
