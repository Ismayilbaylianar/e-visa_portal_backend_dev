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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  UpdateApplicantStatusDto,
  ApplicantResponseDto,
} from './dto';
import {
  ApplicationIdParamDto,
  ApplicantIdParamDto,
} from '@/common/dto';
import { CurrentPortalIdentity, CurrentUser } from '@/common/decorators';
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
    return this.applicantsService.findByApplication(
      params.applicationId,
      portalIdentity.id,
    );
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
    return this.applicantsService.findById(
      params.applicantId,
      portalIdentity.id,
    );
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
    return this.applicantsService.create(
      params.applicationId,
      portalIdentity.id,
      dto,
    );
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
    return this.applicantsService.update(
      params.applicantId,
      portalIdentity.id,
      dto,
    );
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
    return this.applicantsService.delete(
      params.applicantId,
      portalIdentity.id,
    );
  }
}

@ApiTags('Applicants - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/applicants')
export class ApplicantsAdminController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Patch(':applicantId/status')
  @ApiOperation({
    summary: 'Update applicant status',
    description: 'Update the status of an applicant (admin only)',
  })
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
    return this.applicantsService.updateStatus(
      params.applicantId,
      user.id,
      dto,
    );
  }
}
