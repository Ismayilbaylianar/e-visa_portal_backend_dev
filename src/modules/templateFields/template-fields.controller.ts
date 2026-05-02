import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TemplateFieldsService } from './template-fields.service';
import { CreateTemplateFieldDto, UpdateTemplateFieldDto, TemplateFieldResponseDto } from './dto';
import { SectionIdParamDto, FieldIdParamDto } from '@/common/dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';
import {
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Inline DTO for the bulk field reorder endpoint. Each item carries its
 * destination sectionId so the same payload supports both in-place
 * reorder (all items same section) and cross-section moves (one item's
 * sectionId changes).
 */
class ReorderFieldItemDto {
  @ApiProperty({ description: 'Field ID', example: '<uuid>' })
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id!: string;

  @ApiProperty({ description: 'Target section ID for this field', example: '<uuid>' })
  @IsUUID('4', { message: 'sectionId must be a valid UUID' })
  sectionId!: string;

  @ApiProperty({ description: 'New sort order (0-based)', example: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

class ReorderFieldsDto {
  @ApiProperty({ type: [ReorderFieldItemDto], description: 'All fields with their new section + sortOrder' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderFieldItemDto)
  items!: ReorderFieldItemDto[];
}

@ApiTags('Template Fields - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class TemplateFieldsController {
  constructor(private readonly templateFieldsService: TemplateFieldsService) {}

  @Post('templateSections/:sectionId/fields')
  @RequirePermissions('templates.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template field',
    description:
      'Create a new field under a template section. fieldKey must be unique within the entire template (across all sections) for future-safe form data handling.',
  })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiResponse({
    status: 201,
    description: 'Template field created successfully',
    type: TemplateFieldResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template section not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Field with this key already exists in the template',
  })
  async create(
    @Param() params: SectionIdParamDto,
    @Body() dto: CreateTemplateFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.create(params.sectionId, dto, user.id);
  }

  @Patch('templateSections/:sectionId/fields/reorder')
  @RequirePermissions('templates.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reorder fields within or across sections',
    description:
      'Bulk update fields with new sortOrder + (optionally) new sectionId. Supports both in-place reorder (all items same sectionId) and cross-section moves (one or more items pointing at a different sectionId, must be in the same template). Atomic transaction — partial failures roll back.',
  })
  @ApiResponse({ status: 204, description: 'Fields reordered successfully' })
  @ApiResponse({ status: 404, description: 'Source section / target section / field not found' })
  @ApiResponse({ status: 409, description: 'Cross-template move attempted' })
  async reorderFields(
    @Param() params: SectionIdParamDto,
    @Body() dto: ReorderFieldsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.templateFieldsService.reorderFields(params.sectionId, dto.items, user.id);
  }

  @Patch('templateFields/:fieldId')
  @RequirePermissions('templates.update')
  @ApiOperation({
    summary: 'Update template field',
    description: 'Update template field details',
  })
  @ApiParam({ name: 'fieldId', description: 'Field UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template field updated successfully',
    type: TemplateFieldResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template field not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Field with this key already exists in the template',
  })
  async update(
    @Param() params: FieldIdParamDto,
    @Body() dto: UpdateTemplateFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.update(params.fieldId, dto, user.id);
  }

  @Delete('templateFields/:fieldId')
  @RequirePermissions('templates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template field',
    description: 'Soft delete a template field',
  })
  @ApiParam({ name: 'fieldId', description: 'Field UUID' })
  @ApiResponse({
    status: 204,
    description: 'Template field deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template field not found',
  })
  async delete(
    @Param() params: FieldIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.templateFieldsService.delete(params.fieldId, user.id);
  }
}
