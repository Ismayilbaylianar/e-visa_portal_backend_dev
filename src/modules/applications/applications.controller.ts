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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
} from './dto';
import { ApplicationIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse, CurrentPortalIdentity } from '@/common/decorators';
import { PortalAuthGuard } from '@/common/guards';
import { PortalIdentityUser } from '@/common/types';

@ApiTags('Applications - Admin')
@ApiBearerAuth('JWT-auth')
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
  async findById(
    @Param() params: ApplicationIdParamDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findById(params.applicationId);
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
    return this.applicationsService.findByIdForPortal(
      params.applicationId,
      portalIdentity.id,
    );
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
    return this.applicationsService.update(
      params.applicationId,
      dto,
      portalIdentity.id,
    );
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
    return this.applicationsService.submitForReview(
      params.applicationId,
      portalIdentity.id,
    );
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
    return this.applicationsService.submit(
      params.applicationId,
      portalIdentity.id,
    );
  }

  @Get('applications/resume/:resumeToken')
  @ApiOperation({
    summary: 'Get application by resume token',
    description: 'Resume an application using the resume token (Portal)',
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
  async getByResumeToken(
    @Param('resumeToken') resumeToken: string,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.getByResumeToken(resumeToken);
  }
}
