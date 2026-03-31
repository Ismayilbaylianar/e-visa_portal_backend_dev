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
import { BindingNationalityFeesService } from './binding-nationality-fees.service';
import {
  CreateBindingNationalityFeeDto,
  UpdateBindingNationalityFeeDto,
  BindingNationalityFeeResponseDto,
} from './dto';
import { BindingIdParamDto, FeeIdParamDto } from '@/common/dto';

@ApiTags('Binding Nationality Fees - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class BindingNationalityFeesController {
  constructor(
    private readonly bindingNationalityFeesService: BindingNationalityFeesService,
  ) {}

  @Post('templateBindings/:bindingId/nationalityFees')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create nationality fee for binding',
    description: 'Create a new nationality-specific fee for a template binding',
  })
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
  ): Promise<BindingNationalityFeeResponseDto> {
    return this.bindingNationalityFeesService.create(params.bindingId, dto);
  }

  @Patch('bindingNationalityFees/:feeId')
  @ApiOperation({
    summary: 'Update nationality fee',
    description: 'Update an existing binding nationality fee',
  })
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
  ): Promise<BindingNationalityFeeResponseDto> {
    return this.bindingNationalityFeesService.update(params.feeId, dto);
  }

  @Delete('bindingNationalityFees/:feeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete nationality fee',
    description: 'Soft delete a binding nationality fee',
  })
  @ApiResponse({
    status: 204,
    description: 'Nationality fee deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Nationality fee not found',
  })
  async delete(@Param() params: FeeIdParamDto): Promise<void> {
    return this.bindingNationalityFeesService.delete(params.feeId);
  }
}
