import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FormRendererService } from './form-renderer.service';
import { FormSchemaResponseDto, GetFormSchemaQueryDto } from './dto';
import { PortalAuthGuard } from '@/common/guards';
import { CurrentPortalIdentity } from '@/common/decorators';
import { PortalIdentityUser } from '@/common/types';

@ApiTags('Form Renderer - Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal/forms')
export class FormRendererController {
  constructor(private readonly formRendererService: FormRendererService) {}

  @Get('schema')
  @ApiOperation({
    summary: 'Get form schema',
    description: `Get the form schema (sections and fields) for rendering.
    
Resolution logic:
- If applicationId is provided, uses the application's resolved template
- If applicantId is provided, verifies ownership and uses the related application's template
- If templateBindingId is provided, resolves template from binding

At least one parameter must be provided. Portal user can only access schemas tied to their own applications.`,
  })
  @ApiQuery({ name: 'templateBindingId', required: false, description: 'Template binding ID' })
  @ApiQuery({
    name: 'applicationId',
    required: false,
    description: "Application ID (uses application's template)",
  })
  @ApiQuery({
    name: 'applicantId',
    required: false,
    description: 'Applicant ID (verifies ownership)',
  })
  @ApiResponse({
    status: 200,
    description: 'Form schema with sections and fields ordered by sortOrder',
    type: FormSchemaResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'At least one query parameter required',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not your application/applicant',
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding/application/applicant not found',
  })
  async getSchema(
    @Query() query: GetFormSchemaQueryDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<FormSchemaResponseDto> {
    return this.formRendererService.getSchema(query, portalIdentity.id);
  }
}
