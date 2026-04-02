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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { VisaTypesService } from './visa-types.service';
import {
  CreateVisaTypeDto,
  UpdateVisaTypeDto,
  VisaTypeResponseDto,
  VisaTypeListResponseDto,
  GetVisaTypesQueryDto,
  PublicVisaTypeListResponseDto,
} from './dto';
import { RequirePermissions, Public } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Visa Types')
@Controller()
export class VisaTypesController {
  constructor(private readonly visaTypesService: VisaTypesService) {}

  // ==========================================
  // Admin Endpoints
  // ==========================================

  @Get('admin/visaTypes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('visaTypes.read')
  @ApiOperation({
    summary: 'Get all visa types (admin)',
    description: 'Get paginated list of visa types with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of visa types',
    type: VisaTypeListResponseDto,
  })
  async findAll(@Query() query: GetVisaTypesQueryDto): Promise<VisaTypeListResponseDto> {
    return this.visaTypesService.findAll(query);
  }

  @Get('admin/visaTypes/:visaTypeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('visaTypes.read')
  @ApiOperation({
    summary: 'Get visa type by ID (admin)',
    description: 'Get visa type details by ID',
  })
  @ApiParam({ name: 'visaTypeId', description: 'Visa type ID' })
  @ApiResponse({
    status: 200,
    description: 'Visa type details',
    type: VisaTypeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  async findById(@Param('visaTypeId') visaTypeId: string): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.findById(visaTypeId);
  }

  @Post('admin/visaTypes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('visaTypes.create')
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
  @ApiResponse({
    status: 409,
    description: 'Visa type with same purpose and entry type already exists',
  })
  async create(@Body() dto: CreateVisaTypeDto): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.create(dto);
  }

  @Patch('admin/visaTypes/:visaTypeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('visaTypes.update')
  @ApiOperation({
    summary: 'Update visa type',
    description: 'Update visa type details',
  })
  @ApiParam({ name: 'visaTypeId', description: 'Visa type ID' })
  @ApiResponse({
    status: 200,
    description: 'Visa type updated successfully',
    type: VisaTypeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Visa type with same purpose and entry type already exists',
  })
  async update(
    @Param('visaTypeId') visaTypeId: string,
    @Body() dto: UpdateVisaTypeDto,
  ): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.update(visaTypeId, dto);
  }

  @Delete('admin/visaTypes/:visaTypeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('visaTypes.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete visa type',
    description: 'Soft delete a visa type',
  })
  @ApiParam({ name: 'visaTypeId', description: 'Visa type ID' })
  @ApiResponse({
    status: 204,
    description: 'Visa type deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Visa type not found',
  })
  async delete(@Param('visaTypeId') visaTypeId: string): Promise<void> {
    return this.visaTypesService.delete(visaTypeId);
  }

  // ==========================================
  // Public Endpoints
  // ==========================================

  @Get('public/visaTypes')
  @Public()
  @ApiOperation({
    summary: 'Get public visa types',
    description: 'Get list of active visa types for public display',
  })
  @ApiResponse({
    status: 200,
    description: 'List of public visa types',
    type: PublicVisaTypeListResponseDto,
  })
  async findAllPublic(): Promise<PublicVisaTypeListResponseDto> {
    return this.visaTypesService.findAllPublic();
  }
}
