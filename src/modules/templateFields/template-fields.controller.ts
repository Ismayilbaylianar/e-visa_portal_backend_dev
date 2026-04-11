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
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

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
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.create(params.sectionId, dto);
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
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.update(params.fieldId, dto);
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
  async delete(@Param() params: FieldIdParamDto): Promise<void> {
    return this.templateFieldsService.delete(params.fieldId);
  }
}
