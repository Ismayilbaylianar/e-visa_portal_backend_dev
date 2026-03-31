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
import { TemplateFieldsService } from './template-fields.service';
import {
  CreateTemplateFieldDto,
  UpdateTemplateFieldDto,
  TemplateFieldResponseDto,
} from './dto';
import { SectionIdParamDto, FieldIdParamDto } from '@/common/dto';

@ApiTags('Template Fields - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class TemplateFieldsController {
  constructor(private readonly templateFieldsService: TemplateFieldsService) {}

  @Post('templateSections/:sectionId/fields')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template field',
    description: 'Create a new field under a template section',
  })
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
    description: 'Field with this key already exists in the section',
  })
  async create(
    @Param() params: SectionIdParamDto,
    @Body() dto: CreateTemplateFieldDto,
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.create(params.sectionId, dto);
  }

  @Patch('templateFields/:fieldId')
  @ApiOperation({
    summary: 'Update template field',
    description: 'Update template field details',
  })
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
    description: 'Field with this key already exists in the section',
  })
  async update(
    @Param() params: FieldIdParamDto,
    @Body() dto: UpdateTemplateFieldDto,
  ): Promise<TemplateFieldResponseDto> {
    return this.templateFieldsService.update(params.fieldId, dto);
  }

  @Delete('templateFields/:fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template field',
    description: 'Soft delete a template field',
  })
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
