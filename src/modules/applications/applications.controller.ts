import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { ApplicationsService } from './applications.service';
import { ApplicantsService } from '../applicants/applicants.service';
import { CustomerPortalService } from '../customerPortal/customer-portal.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  UpdateEstimatedTimeDto,
  EstimatedTimeChangeEntryDto,
  ChangeApplicationStatusDto,
  AssignApplicationDto,
  AcceptApplicationDto,
  CancelApplicationDto,
  CreateInternalNoteDto,
  UpdateInternalNoteDto,
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

  /**
   * M-Assign — Operator dropdown source. MUST be declared BEFORE
   * `@Get(':applicationId')` below, otherwise Express matches the
   * literal segment "assignable-users" as a `:applicationId` and
   * the route never fires (it failed in the M11.14 verification
   * pass — request returned 400 Bad Request from the UUID validator
   * on ApplicationIdParamDto).
   */
  @Get('assignable-users')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'List users that can be assigned to applications',
  })
  async listAssignableUsers() {
    return this.applicationsService.listAssignableUsers();
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
    description: 'Approve a submitted application. Status must be SUBMITTED or PROCESSING.',
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

  /**
   * M11.12 (BUG P) — Unified status change.
   *
   * One endpoint that handles every transition (APPROVED, REJECTED,
   * READY_TO_DOWNLOAD, CANCELLED) with rich body params:
   * sendEmail toggle, emailMode (template / custom), customMessage
   * appended block, customSubject + customBody for full override,
   * required reason for REJECTED. The legacy approve / reject
   * endpoints stay for back-compat.
   *
   * Permission: applications.update — covers every transition.
   */
  @Post(':applicationId/status')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change application status (unified)',
    description:
      'Single endpoint for every operator status change. See ChangeApplicationStatusDto for the payload contract. Sends a customer email by default; emailMode controls whether the standard template or operator-supplied subject/body is used.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status changed successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transition or missing required field for the target status',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async changeStatus(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: ChangeApplicationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.changeStatus(params.applicationId, dto, user.id);
  }

  // ========================================================
  // Stage 3 — FIRST DECISION (accept / cancel)
  // ========================================================

  /**
   * ACCEPT a SUBMITTED application: capture the held funds, assign the
   * operator picked in the request, move to PROCESSING and email the
   * customer that processing has started. Atomic — see the service.
   *
   * Permission: applications.update, with the same split as /assign —
   * assigning to anyone other than yourself also requires
   * applications.assign (enforced in the service).
   */
  @Post(':applicationId/accept')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an application (first decision)',
    description:
      'Captures the AUTHORIZED payment, assigns the chosen operator, moves the application SUBMITTED → PROCESSING and sends the "processing started" email. Requires a SUBMITTED application with funds held.',
  })
  @ApiResponse({ status: 200, description: 'Application accepted', type: ApplicationResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Not SUBMITTED, no authorized payment, or unknown assignee',
  })
  @ApiResponse({ status: 403, description: 'Operator may only assign to themselves' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async accept(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: AcceptApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.acceptApplication(
      params.applicationId,
      dto,
      user.id,
      user.permissions ?? [],
    );
  }

  /**
   * CANCEL a SUBMITTED application (disqualifying issue): release the
   * authorization in full — nothing is charged — move to CANCELLED
   * (terminal) and email the customer the reason. The customer may then
   * submit a NEW application; there is no re-apply on this one.
   */
  @Post(':applicationId/cancel')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an application (first decision)',
    description:
      'Releases the AUTHORIZED payment in full (no charge), moves the application SUBMITTED → CANCELLED and emails the customer the reason. Requires a SUBMITTED application with funds held.',
  })
  @ApiResponse({ status: 200, description: 'Application cancelled', type: ApplicationResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Not SUBMITTED, no authorized payment, or missing reason',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async cancel(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: CancelApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.cancelApplication(params.applicationId, dto, user.id);
  }

  // ========================================================
  // M-Assign — Operator assignment + internal notes
  // ========================================================

  /**
   * M-Assign — Assign / reassign / unassign an operator.
   *
   * Body:
   *   { assigneeId: <user id> | null, reason?: string }
   *
   * M11.14 (RBAC audit) — Two-tier permission:
   *   • `applications.update` (held by operator, admin, super) is
   *     enough to assign-to-self or unassign-self. That's the
   *     "claim my own work" flow operators run every day.
   *   • `applications.assign` (held by admin + super only) is
   *     required to assign the application to ANYONE ELSE — the
   *     "delegate to John" flow. The service layer applies the
   *     extra check after parsing the request so the guard here
   *     stays at the wider applications.update level.
   *
   * Without that split, an operator with applications.update could
   * reassign any application to any user — confirmed in the RBAC
   * audit. Now an operator hitting the same endpoint with a
   * non-self assigneeId gets a clean 403.
   */
  @Post(':applicationId/assign')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign or unassign an operator',
    description:
      'Set or clear the assigned operator on an application. Writes assignment history + audit log + Telegram notification. Cross-user assignment requires applications.assign (admin+); self-assign / self-unassign needs only applications.update.',
  })
  @ApiResponse({ status: 200, description: 'Assignment updated', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Inactive or unknown assignee' })
  @ApiResponse({ status: 403, description: 'Operator may only self-assign' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async assign(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: AssignApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.assignOperator(
      params.applicationId,
      dto.assigneeId ?? null,
      user.id,
      dto.reason,
      // M11.14 (RBAC audit) — service does the cross-user check.
      user.permissions ?? [],
    );
  }

  @Get(':applicationId/notes')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'List internal notes',
    description:
      'Operator-only notes attached to the application. Newest first. Soft-deleted notes are excluded.',
  })
  async listNotes(
    @Param() params: ApplicationIdParamDto,
  ): Promise<any[]> {
    return this.applicationsService.listInternalNotes(params.applicationId);
  }

  @Post(':applicationId/notes')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an internal note',
    description:
      'Captures an operator-only note on the application. Never sent to the customer.',
  })
  async addNote(
    @Param() params: ApplicationIdParamDto,
    @Body() dto: CreateInternalNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.applicationsService.addInternalNote(
      params.applicationId,
      user.id,
      dto.note,
    );
  }

  @Patch(':applicationId/notes/:noteId')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit an internal note (author only)' })
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateInternalNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.applicationsService.updateInternalNote(noteId, user.id, dto.note);
  }

  @Delete(':applicationId/notes/:noteId')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an internal note' })
  async deleteNote(
    @Param('noteId') noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.applicationsService.deleteInternalNote(noteId, user.id);
  }

  // M-Assign assignable-users moved to the top of the controller
  // (above `@Get(':applicationId')`) to win Express's first-match
  // route resolution.

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
  // Module 9 — gated by applications.approve (NOT applications.update)
  // because issuing a visa is the final blessing on the case;
  // operators have applications.update for note-taking but should
  // not have authority to mint visas. Admin + super-admin in seed.
  @RequirePermissions('applications.approve')
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
  // Module 9 — gated by applications.approve (admin/super-admin
  // only). The SLA estimate is a customer-facing promise; operators
  // (review staff) shouldn't shift it unilaterally.
  @RequirePermissions('applications.approve')
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
    /** Module 9b — customer document resubmission. Same controller
     *  prefix as the visa download so URLs stay grouped under
     *  /portal/applications/:id/applicants/:applicantId/... */
    private readonly customerPortalService: CustomerPortalService,
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

  /**
   * M11.12 (BUG O) — Alias for the frontend, which calls
   * `/portal/applications/:id` (without the `me/` prefix). The
   * existing `me/applications/:id` route stays for back-compat;
   * both delegate to `findByIdForPortal` which enforces the portal
   * identity ownership check. Without this alias the /me document
   * upload flow 404s when it tries to refresh detail post-upload.
   */
  @Get('applications/:applicationId')
  @ApiOperation({
    summary: 'Get application by ID (Portal alias)',
    description:
      'Same as `me/applications/:applicationId`. Both routes return the application owned by the current portal identity; 404 if it belongs to a different identity. Frontend `portal.ts` calls this shorter path post-upload to refresh detail.',
  })
  @ApiResponse({ status: 200, description: 'Application details', type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findMyApplicationAlias(
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
