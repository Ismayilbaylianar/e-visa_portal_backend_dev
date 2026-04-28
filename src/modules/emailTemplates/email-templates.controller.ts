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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  EmailTemplateResponseDto,
  EmailTemplateListResponseDto,
  GetEmailTemplatesQueryDto,
} from './dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

/**
 * Module 3 — Admin Email Template management.
 *
 * Class-level @UseGuards(JwtAuthGuard) keeps JwtAuthGuard before
 * PermissionsGuard in the resolved chain (Modul 1 / 1.5 / 2 lesson —
 * inverting at method scope causes PermissionsGuard to run first
 * against an undefined request.user → 403).
 */
@ApiTags('Email Templates')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/emailTemplates')
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @RequirePermissions('emailTemplates.read')
  @ApiOperation({
    summary: 'Get all email templates',
    description:
      'Get paginated list of email templates with optional filters. Sort defaults to templateKey asc.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of email templates',
    type: EmailTemplateListResponseDto,
  })
  async findAll(@Query() query: GetEmailTemplatesQueryDto): Promise<EmailTemplateListResponseDto> {
    return this.emailTemplatesService.findAll(query);
  }

  @Get(':templateId')
  @RequirePermissions('emailTemplates.read')
  @ApiOperation({
    summary: 'Get email template by ID',
    description: 'Get email template details by ID',
  })
  @ApiParam({ name: 'templateId', description: 'Email template ID' })
  @ApiResponse({
    status: 200,
    description: 'Email template details',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  async findById(@Param('templateId') templateId: string): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.findById(templateId);
  }

  @Post()
  @RequirePermissions('emailTemplates.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create email template',
    description:
      'Create a new email template. templateKey must be lowercase snake_case and unique.',
  })
  @ApiResponse({
    status: 201,
    description: 'Email template created successfully',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Template key already exists',
  })
  async create(
    @Body() dto: CreateEmailTemplateDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.create(dto, currentUser.id);
  }

  @Patch(':templateId')
  @RequirePermissions('emailTemplates.update')
  @ApiOperation({
    summary: 'Update email template',
    description:
      'Update email template details. System templates can update any field except templateKey (rename is blocked because the key is referenced in code).',
  })
  @ApiParam({ name: 'templateId', description: 'Email template ID' })
  @ApiResponse({
    status: 200,
    description: 'Email template updated successfully',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Template key already exists, or system template templateKey rename was attempted',
  })
  async update(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.update(templateId, dto, currentUser.id);
  }

  @Delete(':templateId')
  @RequirePermissions('emailTemplates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete email template',
    description:
      'Soft delete an email template. System templates (otp_verification, application_status_update, generic_notification, payment_confirmation, raw_email) cannot be deleted because email.service.ts references them by templateKey at runtime.',
  })
  @ApiParam({ name: 'templateId', description: 'Email template ID' })
  @ApiResponse({
    status: 204,
    description: 'Email template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'System template cannot be deleted',
  })
  async delete(
    @Param('templateId') templateId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.emailTemplatesService.delete(templateId, currentUser.id);
  }
}
