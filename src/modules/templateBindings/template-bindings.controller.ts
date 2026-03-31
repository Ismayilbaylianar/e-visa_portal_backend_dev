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
import { TemplateBindingsService } from './template-bindings.service';
import {
  CreateTemplateBindingDto,
  UpdateTemplateBindingDto,
  TemplateBindingResponseDto,
  GetTemplateBindingsQueryDto,
} from './dto';
import { BindingIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Template Bindings - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/templateBindings')
export class TemplateBindingsController {
  constructor(private readonly templateBindingsService: TemplateBindingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all template bindings',
    description: 'Get paginated list of template bindings with optional filters',
  })
  @ApiPaginatedResponse(TemplateBindingResponseDto)
  async findAll(@Query() query: GetTemplateBindingsQueryDto) {
    return this.templateBindingsService.findAll(query);
  }

  @Get(':bindingId')
  @ApiOperation({
    summary: 'Get template binding by ID',
    description: 'Get template binding details by ID including related entities',
  })
  @ApiResponse({
    status: 200,
    description: 'Template binding details',
    type: TemplateBindingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding not found',
  })
  async findById(@Param() params: BindingIdParamDto): Promise<TemplateBindingResponseDto> {
    return this.templateBindingsService.findById(params.bindingId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template binding',
    description: 'Create a new template binding linking destination country, visa type, and template',
  })
  @ApiResponse({
    status: 201,
    description: 'Template binding created successfully',
    type: TemplateBindingResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Template binding already exists for this combination',
  })
  async create(@Body() dto: CreateTemplateBindingDto): Promise<TemplateBindingResponseDto> {
    return this.templateBindingsService.create(dto);
  }

  @Patch(':bindingId')
  @ApiOperation({
    summary: 'Update template binding',
    description: 'Update template binding details',
  })
  @ApiResponse({
    status: 200,
    description: 'Template binding updated successfully',
    type: TemplateBindingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Template binding already exists for this combination',
  })
  async update(
    @Param() params: BindingIdParamDto,
    @Body() dto: UpdateTemplateBindingDto,
  ): Promise<TemplateBindingResponseDto> {
    return this.templateBindingsService.update(params.bindingId, dto);
  }

  @Delete(':bindingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template binding',
    description: 'Soft delete a template binding',
  })
  @ApiResponse({
    status: 204,
    description: 'Template binding deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding not found',
  })
  async delete(@Param() params: BindingIdParamDto): Promise<void> {
    return this.templateBindingsService.delete(params.bindingId);
  }
}
