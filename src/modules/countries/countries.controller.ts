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
import { CountriesService } from './countries.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  CountryResponseDto,
  CountryListResponseDto,
  GetCountriesQueryDto,
  PublicCountryResponseDto,
  PublicCountryListResponseDto,
} from './dto';
import { RequirePermissions, Public, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Countries')
@Controller()
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  // ==========================================
  // Admin Endpoints
  // ==========================================

  @Get('admin/countries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('countries.read')
  @ApiOperation({
    summary: 'Get all countries (admin)',
    description: 'Get paginated list of countries with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of countries',
    type: CountryListResponseDto,
  })
  async findAll(@Query() query: GetCountriesQueryDto): Promise<CountryListResponseDto> {
    return this.countriesService.findAll(query);
  }

  @Get('admin/countries/:countryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('countries.read')
  @ApiOperation({
    summary: 'Get country by ID (admin)',
    description: 'Get country details by ID including sections',
  })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({
    status: 200,
    description: 'Country details',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async findById(@Param('countryId') countryId: string): Promise<CountryResponseDto> {
    return this.countriesService.findById(countryId);
  }

  @Post('admin/countries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('countries.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create country',
    description: 'Create a new country',
  })
  @ApiResponse({
    status: 201,
    description: 'Country created successfully',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Slug or ISO code already exists',
  })
  async create(
    @Body() dto: CreateCountryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountryResponseDto> {
    return this.countriesService.create(dto, currentUser.id);
  }

  @Patch('admin/countries/:countryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('countries.update')
  @ApiOperation({
    summary: 'Update country',
    description: 'Update country details',
  })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({
    status: 200,
    description: 'Country updated successfully',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Slug or ISO code already exists',
  })
  async update(
    @Param('countryId') countryId: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountryResponseDto> {
    return this.countriesService.update(countryId, dto, currentUser.id);
  }

  @Delete('admin/countries/:countryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('countries.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete country',
    description: 'Soft delete a country and its sections',
  })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({
    status: 204,
    description: 'Country deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async delete(
    @Param('countryId') countryId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.countriesService.delete(countryId, currentUser.id);
  }

  // ==========================================
  // Public Endpoints
  // ==========================================

  @Get('public/countries')
  @Public()
  @ApiOperation({
    summary: 'Get public countries',
    description: 'Get list of published and active countries for public display',
  })
  @ApiResponse({
    status: 200,
    description: 'List of public countries',
    type: PublicCountryListResponseDto,
  })
  async findAllPublic(): Promise<PublicCountryListResponseDto> {
    return this.countriesService.findAllPublic();
  }

  @Get('public/countries/:slug')
  @Public()
  @ApiOperation({
    summary: 'Get public country by slug',
    description: 'Get published country details by slug',
  })
  @ApiParam({ name: 'slug', description: 'Country slug', example: 'turkey' })
  @ApiResponse({
    status: 200,
    description: 'Country details',
    type: PublicCountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async findBySlugPublic(@Param('slug') slug: string): Promise<PublicCountryResponseDto> {
    return this.countriesService.findBySlugPublic(slug);
  }
}
