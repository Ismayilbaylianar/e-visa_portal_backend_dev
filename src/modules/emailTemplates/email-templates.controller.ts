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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import {
  EmailTemplateResponseDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto';
import { IdParamDto, PaginationQueryDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Email Templates')
@ApiBearerAuth('JWT-auth')
@Controller('admin/emailTemplates')
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all email templates',
    description: 'Get paginated list of email templates',
  })
  @ApiPaginatedResponse(EmailTemplateResponseDto)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.emailTemplatesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get email template by ID',
    description: 'Get email template details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Email template details',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  async findById(@Param() params: IdParamDto): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.findById(params.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create email template',
    description: 'Create a new email template',
  })
  @ApiResponse({
    status: 201,
    description: 'Email template created successfully',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email template with this key already exists',
  })
  async create(@Body() dto: CreateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update email template',
    description: 'Update email template details',
  })
  @ApiResponse({
    status: 200,
    description: 'Email template updated successfully',
    type: EmailTemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  async update(
    @Param() params: IdParamDto,
    @Body() dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateResponseDto> {
    return this.emailTemplatesService.update(params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete email template',
    description: 'Soft delete an email template',
  })
  @ApiResponse({
    status: 204,
    description: 'Email template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found',
  })
  async delete(@Param() params: IdParamDto): Promise<void> {
    return this.emailTemplatesService.delete(params.id);
  }
}
