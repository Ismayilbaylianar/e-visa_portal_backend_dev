import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FormRendererService } from './form-renderer.service';
import { FormSchemaResponseDto, GetFormSchemaQueryDto } from './dto';
import { PortalAuthGuard } from '@/common/guards';

@ApiTags('Form Renderer - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal/forms')
export class FormRendererController {
  constructor(private readonly formRendererService: FormRendererService) {}

  @Get('schema')
  @ApiOperation({
    summary: 'Get form schema',
    description:
      'Get the form schema (sections and fields) for a specific template binding',
  })
  @ApiResponse({
    status: 200,
    description: 'Form schema with sections and fields',
    type: FormSchemaResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding not found',
  })
  async getSchema(
    @Query() query: GetFormSchemaQueryDto,
  ): Promise<FormSchemaResponseDto> {
    return this.formRendererService.getSchema(query.bindingId);
  }
}
