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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VisaTypesService } from './visa-types.service';
import {
  CreateVisaTypeDto,
  UpdateVisaTypeDto,
  VisaTypeResponseDto,
  GetVisaTypesQueryDto,
} from './dto';
import { VisaTypeIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse, Public } from '@/common/decorators';

@ApiTags('Visa Types - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/visaTypes')
export class VisaTypesAdminController {
  constructor(private readonly visaTypesService: VisaTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all visa types',
    description: 'Get paginated list of visa types with optional filters',
  })
  @ApiPaginatedResponse(VisaTypeResponseDto)
  async findAll(@Query() query: GetVisaTypesQueryDto) {
    return this.visaTypesService.findAll(query);
  }

  @Get(':visaTypeId')
  @ApiOperation({
    summary: 'Get visa type by ID',
    description: 'Get visa type details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Visa type details',
    type: VisaTypeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  async findById(@Param() params: VisaTypeIdParamDto): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.findById(params.visaTypeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create visa type',
    description: 'Create a new visa type',
  })
  @ApiResponse({
    status: 201,
    description: 'Visa type created successfully',
    type: VisaTypeResponseDto,
  })
  async create(@Body() dto: CreateVisaTypeDto): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.create(dto);
  }

  @Patch(':visaTypeId')
  @ApiOperation({
    summary: 'Update visa type',
    description: 'Update visa type details',
  })
  @ApiResponse({
    status: 200,
    description: 'Visa type updated successfully',
    type: VisaTypeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  async update(
    @Param() params: VisaTypeIdParamDto,
    @Body() dto: UpdateVisaTypeDto,
  ): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.update(params.visaTypeId, dto);
  }

  @Delete(':visaTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete visa type',
    description: 'Soft delete a visa type',
  })
  @ApiResponse({
    status: 204,
    description: 'Visa type deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  async delete(@Param() params: VisaTypeIdParamDto): Promise<void> {
    return this.visaTypesService.delete(params.visaTypeId);
  }
}

@ApiTags('Visa Types - Public')
@Controller('public/visaTypes')
export class VisaTypesPublicController {
  constructor(private readonly visaTypesService: VisaTypesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get active visa types',
    description: 'Get list of all active visa types for public display',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active visa types',
    type: [VisaTypeResponseDto],
  })
  async findAllActive(): Promise<VisaTypeResponseDto[]> {
    return this.visaTypesService.findAllActive();
  }
}
