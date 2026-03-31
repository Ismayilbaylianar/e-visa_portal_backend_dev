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
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { TemplateIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Templates - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all templates',
    description: 'Get paginated list of templates with optional filters',
  })
  @ApiPaginatedResponse(TemplateResponseDto)
  async findAll(@Query() query: GetTemplatesQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Get(':templateId')
  @ApiOperation({
    summary: 'Get template by ID',
    description: 'Get template details by ID including sections and fields',
  })
  @ApiResponse({
    status: 200,
    description: 'Template details',
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template',
    description: 'Create a new template',
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
  @ApiOperation({
    summary: 'Update template',
    description: 'Update template details',
  })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template',
    description: 'Soft delete a template',
  })
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
