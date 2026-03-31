import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TemplateSectionsService } from './template-sections.service';
import {
  CreateTemplateSectionDto,
  UpdateTemplateSectionDto,
  TemplateSectionResponseDto,
} from './dto';
import { TemplateIdParamDto, SectionIdParamDto } from '@/common/dto';

@ApiTags('Template Sections - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class TemplateSectionsController {
  constructor(private readonly templateSectionsService: TemplateSectionsService) {}

  @Post('templates/:templateId/sections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template section',
    description: 'Create a new section under a template',
  })
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
  @ApiOperation({
    summary: 'Update template section',
    description: 'Update template section details',
  })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template section',
    description: 'Soft delete a template section and its fields',
  })
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
