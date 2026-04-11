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
import { TemplateSectionsService } from './template-sections.service';
import {
  CreateTemplateSectionDto,
  UpdateTemplateSectionDto,
  TemplateSectionResponseDto,
} from './dto';
import { TemplateIdParamDto, SectionIdParamDto } from '@/common/dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Template Sections - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class TemplateSectionsController {
  constructor(private readonly templateSectionsService: TemplateSectionsService) {}

  @Post('templates/:templateId/sections')
  @RequirePermissions('templates.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template section',
    description:
      'Create a new section under a template. Section key must be unique within the template.',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({
    status: 201,
    description: 'Template section created successfully',
    type: TemplateSectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Section with this key already exists in the template',
  })
  async create(
    @Param() params: TemplateIdParamDto,
    @Body() dto: CreateTemplateSectionDto,
  ): Promise<TemplateSectionResponseDto> {
    return this.templateSectionsService.create(params.templateId, dto);
  }

  @Patch('templateSections/:sectionId')
  @RequirePermissions('templates.update')
  @ApiOperation({
    summary: 'Update template section',
    description: 'Update template section details',
  })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template section updated successfully',
    type: TemplateSectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template section not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Section with this key already exists in the template',
  })
  async update(
    @Param() params: SectionIdParamDto,
    @Body() dto: UpdateTemplateSectionDto,
  ): Promise<TemplateSectionResponseDto> {
    return this.templateSectionsService.update(params.sectionId, dto);
  }

  @Delete('templateSections/:sectionId')
  @RequirePermissions('templates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template section',
    description: 'Soft delete a template section and all its fields',
  })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiResponse({
    status: 204,
    description: 'Template section deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template section not found',
  })
  async delete(@Param() params: SectionIdParamDto): Promise<void> {
    return this.templateSectionsService.delete(params.sectionId);
  }
}
