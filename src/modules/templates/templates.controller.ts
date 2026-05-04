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
// M11.2 — bulk-upsert lives on the templates URL space but routes
// through the bindings service.
import { TemplateBindingsService } from '../templateBindings/template-bindings.service';
import {
  BulkUpsertDestinationsDto,
  BulkUpsertDestinationsResponseDto,
} from '../templateBindings/dto';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  TemplateListItemResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { TemplateIdParamDto } from '@/common/dto';
import { RequirePermissions, ApiPaginatedResponse, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';
import { IsArray, IsString, IsUUID, ArrayUnique, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Inline DTOs kept colocated with the controller — small one-shot
 * payloads that don't need their own dto/ files. Validation matches
 * the existing CreateTemplateDto rules where applicable.
 */
class ReorderSectionsDto {
  @ApiProperty({
    description: 'Section IDs in the desired final order. Must include every active section in the template.',
    type: [String],
    example: ['<uuid>', '<uuid>'],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID' })
  @ArrayUnique({ message: 'IDs must be unique' })
  orderedIds!: string[];
}

class DuplicateTemplateDto {
  @ApiProperty({ description: 'Name for the new template', example: 'Tourism V2 Draft' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Unique key (camelCase recommended)', example: 'tourismStandardV2' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z][a-zA-Z0-9_]*$/, {
    message: 'Key must start with lowercase letter; letters/digits/underscore only',
  })
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

@ApiTags('Templates - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly templateBindingsService: TemplateBindingsService,
  ) {}

  /**
   * M11.2 — Bulk-upsert destinations for one (template, nationality,
   * visaType) combo. Atomic — all-or-nothing. Returns counts
   * (created/updated/deleted/skipped).
   */
  @Post(':templateId/destinations/bulk-upsert')
  @RequirePermissions('templateBindings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk upsert destinations for a (template, nationality, visa type) scope',
    description:
      'Atomic — every binding row created/updated/deleted in a single transaction. Boilerplate templates rejected with 400.',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({ status: 200, type: BulkUpsertDestinationsResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed or boilerplate template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async bulkUpsertDestinations(
    @Param() params: TemplateIdParamDto,
    @Body() dto: BulkUpsertDestinationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkUpsertDestinationsResponseDto> {
    return this.templateBindingsService.bulkUpsertDestinations(
      params.templateId,
      dto,
      user.id,
    );
  }

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
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateResponseDto> {
    return this.templatesService.create(dto, user.id);
  }

  @Post(':templateId/duplicate')
  @RequirePermissions('templates.duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Duplicate template',
    description:
      'Deep-clone the template plus all its sections + fields in a single transaction. New template starts at version 1 with an independent lifecycle. Bindings + applications are NOT copied.',
  })
  @ApiResponse({ status: 201, type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Source template not found' })
  @ApiResponse({ status: 409, description: 'New key conflicts with existing template' })
  async duplicate(
    @Param() params: TemplateIdParamDto,
    @Body() dto: DuplicateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateResponseDto> {
    return this.templatesService.duplicate(params.templateId, dto, user.id);
  }

  @Patch(':templateId/sections/reorder')
  @RequirePermissions('templates.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reorder sections',
    description:
      'Bulk update sortOrder for all sections in the template. Body must list every section id in the desired order; partial reorders are rejected (prevents accidental data inconsistency).',
  })
  @ApiResponse({ status: 204, description: 'Sections reordered successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 409, description: 'orderedIds does not match the template sections' })
  async reorderSections(
    @Param() params: TemplateIdParamDto,
    @Body() dto: ReorderSectionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.templatesService.reorderSections(params.templateId, dto.orderedIds, user.id);
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateResponseDto> {
    return this.templatesService.update(params.templateId, dto, user.id);
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
  async delete(
    @Param() params: TemplateIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.templatesService.delete(params.templateId, user.id);
  }
}
