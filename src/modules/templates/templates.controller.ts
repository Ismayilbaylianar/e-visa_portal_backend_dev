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
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  TemplateListItemResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { TemplateIdParamDto } from '@/common/dto';
import { RequirePermissions, ApiPaginatedResponse } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Templates - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @RequirePermissions('templates.read')
  @ApiOperation({
    summary: 'Get all templates',
    description:
      'Get paginated list of templates with optional filters. Returns summary list without deeply nested sections/fields.',
  })
  @ApiPaginatedResponse(TemplateListItemResponseDto)
  async findAll(@Query() query: GetTemplatesQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Get(':templateId')
  @RequirePermissions('templates.read')
  @ApiOperation({
    summary: 'Get template by ID',
    description:
      'Get template details by ID including sections and fields ordered by sortOrder. Returns fully nested form structure suitable for admin UI editing.',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template details with nested sections and fields',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async findById(@Param() params: TemplateIdParamDto): Promise<TemplateResponseDto> {
    return this.templatesService.findById(params.templateId);
  }

  @Post()
  @RequirePermissions('templates.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template',
    description: 'Create a new form template. The key must be unique across all templates.',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Template with this key already exists',
  })
  async create(@Body() dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    return this.templatesService.create(dto);
  }

  @Patch(':templateId')
  @RequirePermissions('templates.update')
  @ApiOperation({
    summary: 'Update template',
    description: 'Update template details. Version is not auto-incremented in this stage.',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Template with this key already exists',
  })
  async update(
    @Param() params: TemplateIdParamDto,
    @Body() dto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    return this.templatesService.update(params.templateId, dto);
  }

  @Delete(':templateId')
  @RequirePermissions('templates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template',
    description: 'Soft delete a template and all its sections and fields',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({
    status: 204,
    description: 'Template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async delete(@Param() params: TemplateIdParamDto): Promise<void> {
    return this.templatesService.delete(params.templateId);
  }
}
