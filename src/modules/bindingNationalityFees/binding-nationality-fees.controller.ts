import {
  Controller,
  Get,
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
import { BindingNationalityFeesService } from './binding-nationality-fees.service';
import {
  CreateBindingNationalityFeeDto,
  UpdateBindingNationalityFeeDto,
  BindingNationalityFeeResponseDto,
  BulkCopyFeesDto,
  BulkCopyFeesResultDto,
} from './dto';
import { BindingIdParamDto, FeeIdParamDto } from '@/common/dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Binding Nationality Fees - Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class BindingNationalityFeesController {
  constructor(private readonly bindingNationalityFeesService: BindingNationalityFeesService) {}

  @Get('templateBindings/:bindingId/nationalityFees')
  @RequirePermissions('templateBindings.read')
  @ApiOperation({
    summary: 'List nationality fees for a binding',
    description:
      'Returns active nationality fees under one binding, ordered by country name. Use this when you need fees only (the binding detail endpoint already includes fees nested).',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
  @ApiResponse({
    status: 200,
    description: 'Nationality fees',
    type: [BindingNationalityFeeResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Template binding not found' })
  async findByBinding(
    @Param() params: BindingIdParamDto,
  ): Promise<BindingNationalityFeeResponseDto[]> {
    return this.bindingNationalityFeesService.findByBinding(params.bindingId);
  }

  @Post('templateBindings/:bindingId/nationalityFees')
  @RequirePermissions('templateBindings.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create nationality fee for binding',
    description:
      'Create a new nationality-specific fee for a template binding. Nationality must be unique within the binding.',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
  @ApiResponse({
    status: 201,
    description: 'Nationality fee created successfully',
    type: BindingNationalityFeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding or nationality country not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Fee already exists for this nationality in this binding',
  })
  async create(
    @Param() params: BindingIdParamDto,
    @Body() dto: CreateBindingNationalityFeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BindingNationalityFeeResponseDto> {
    return this.bindingNationalityFeesService.create(params.bindingId, dto, user.id);
  }

  @Post('templateBindings/:bindingId/nationalityFees/bulk-copy')
  @RequirePermissions('templateBindings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk copy fees from one nationality to many on the same binding',
    description:
      'Reads the source nationality fee and clones its values onto each target nationality under the same binding. `overwriteExisting=false` (default) skips targets that already have a fee. All writes happen in one transaction so the binding never lands in a partially-applied state.',
  })
  @ApiParam({ name: 'bindingId', description: 'Template binding UUID' })
  @ApiResponse({
    status: 200,
    description: 'Bulk copy summary with per-target outcome',
    type: BulkCopyFeesResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template binding or source fee not found',
  })
  async bulkCopy(
    @Param() params: BindingIdParamDto,
    @Body() dto: BulkCopyFeesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkCopyFeesResultDto> {
    return this.bindingNationalityFeesService.bulkCopy(params.bindingId, dto, user.id);
  }

  @Patch('bindingNationalityFees/:feeId')
  @RequirePermissions('templateBindings.update')
  @ApiOperation({
    summary: 'Update nationality fee',
    description: 'Update an existing binding nationality fee',
  })
  @ApiParam({ name: 'feeId', description: 'Nationality fee UUID' })
  @ApiResponse({
    status: 200,
    description: 'Nationality fee updated successfully',
    type: BindingNationalityFeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Nationality fee not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Fee already exists for this nationality in this binding',
  })
  async update(
    @Param() params: FeeIdParamDto,
    @Body() dto: UpdateBindingNationalityFeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BindingNationalityFeeResponseDto> {
    return this.bindingNationalityFeesService.update(params.feeId, dto, user.id);
  }

  @Delete('bindingNationalityFees/:feeId')
  @RequirePermissions('templateBindings.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete nationality fee',
    description: 'Soft delete a binding nationality fee',
  })
  @ApiParam({ name: 'feeId', description: 'Nationality fee UUID' })
  @ApiResponse({
    status: 204,
    description: 'Nationality fee deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Nationality fee not found',
  })
  async delete(
    @Param() params: FeeIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.bindingNationalityFeesService.delete(params.feeId, user.id);
  }
}
