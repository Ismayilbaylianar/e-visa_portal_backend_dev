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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  RequestDocumentsDto,
} from './dto';
import { ApplicationIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse, CurrentPortalIdentity, CurrentUser } from '@/common/decorators';
import { PortalAuthGuard, JwtAuthGuard } from '@/common/guards';
import { PortalIdentityUser, AuthenticatedUser } from '@/common/types';

@ApiTags('Applications - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/applications')
export class ApplicationsAdminController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all applications',
    description: 'Get paginated list of applications with optional filters (Admin)',
  })
  @ApiPaginatedResponse(ApplicationResponseDto)
  async findAll(@Query() query: GetApplicationsQueryDto) {
    return this.applicationsService.findAll(query);
  }

  @Get(':applicationId')
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
}

@ApiTags('Applications - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal')
export class ApplicationsPortalController {
  constructor(private readonly applicationsService: ApplicationsService) {}

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
}
