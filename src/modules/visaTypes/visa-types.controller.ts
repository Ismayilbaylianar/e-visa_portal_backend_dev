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
import { RequirePermissions, Public, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

/**
 * Module 2 — manages visa types (purpose × entries combinations).
 *
 * Class-level @UseGuards(JwtAuthGuard) keeps the guard before
 * PermissionsGuard in the resolved chain (decorators apply bottom-up,
 * NestJS appends method-level guards after class-level ones — inverting
 * them at method scope causes PermissionsGuard to run first against an
 * undefined request.user → 403). Public endpoints opt out via @Public().
 */
@ApiTags('Visa Types')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class VisaTypesController {
  constructor(private readonly visaTypesService: VisaTypesService) {}

  // ==========================================
  // Admin Endpoints
  // ==========================================

  @Get('admin/visaTypes')
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
  @RequirePermissions('visaTypes.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create visa type',
    description: 'Create a new visa type. Conflict check is on (purpose, entries) compound.',
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
  async create(
    @Body() dto: CreateVisaTypeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.create(dto, currentUser.id);
  }

  @Patch('admin/visaTypes/:visaTypeId')
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<VisaTypeResponseDto> {
    return this.visaTypesService.update(visaTypeId, dto, currentUser.id);
  }

  @Delete('admin/visaTypes/:visaTypeId')
  @RequirePermissions('visaTypes.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete visa type',
    description:
      'Soft delete a visa type. Blocked (409) if any active TemplateBinding still references it.',
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
  @ApiResponse({
    status: 409,
    description: 'Visa type is in use by one or more active template bindings',
  })
  async delete(
    @Param('visaTypeId') visaTypeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.visaTypesService.delete(visaTypeId, currentUser.id);
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
