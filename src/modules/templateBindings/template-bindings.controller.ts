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
import { TemplateBindingsService } from './template-bindings.service';
import {
  CreateTemplateBindingDto,
  UpdateTemplateBindingDto,
  TemplateBindingResponseDto,
  TemplateBindingListItemResponseDto,
  GetTemplateBindingsQueryDto,
} from './dto';
import { BindingIdParamDto } from '@/common/dto';
import { RequirePermissions, ApiPaginatedResponse, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Template Bindings - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/templateBindings')
export class TemplateBindingsController {
  constructor(private readonly templateBindingsService: TemplateBindingsService) {}

  @Get()
  @RequirePermissions('templateBindings.read')
  @ApiOperation({
    summary: 'Get all template bindings',
    description:
      'Get paginated list of template bindings with optional filters. Returns summary list without nested nationality fees.',
  })
  @ApiPaginatedResponse(TemplateBindingListItemResponseDto)
  async findAll(@Query() query: GetTemplateBindingsQueryDto) {
    return this.templateBindingsService.findAll(query);
  }

  @Get(':bindingId')
  @RequirePermissions('templateBindings.read')
  @ApiOperation({
    summary: 'Get template binding by ID',
    description:
      'Get template binding details by ID including related entities and nationality fees ordered by country name.',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template binding details with nested nationality fees',
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
  @RequirePermissions('templateBindings.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template binding',
    description:
      'Create a new template binding linking destination country, visa type, and template. Only one active binding allowed per destination country + visa type combination.',
  })
  @ApiResponse({
    status: 201,
    description: 'Template binding created successfully',
    type: TemplateBindingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Referenced country, visa type, or template not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Template binding already exists for this destination country and visa type combination',
  })
  async create(
    @Body() dto: CreateTemplateBindingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateBindingResponseDto> {
    return this.templateBindingsService.create(dto, user.id);
  }

  @Patch(':bindingId')
  @RequirePermissions('templateBindings.update')
  @ApiOperation({
    summary: 'Update template binding',
    description: 'Update template binding details including validity dates',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateBindingResponseDto> {
    return this.templateBindingsService.update(params.bindingId, dto, user.id);
  }

  @Delete(':bindingId')
  @RequirePermissions('templateBindings.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template binding',
    description:
      'Soft-deletes a template binding and cascades the soft-delete to its nationality fees in one transaction. Hard-blocked (409) when any Application still references the binding — caller must complete/cancel/refund those apps first.',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
  @ApiResponse({
    status: 204,
    description: 'Template binding deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Binding has active applications — cannot delete',
  })
  async delete(
    @Param() params: BindingIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.templateBindingsService.delete(params.bindingId, user.id);
  }
}
