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
import { CountryPagesService } from './country-pages.service';
import {
  CreateCountryPageDto,
  UpdateCountryPageDto,
  GetCountryPagesQueryDto,
  CountryPageResponseDto,
  CountryPageListResponseDto,
  PublicCountryPageResponseDto,
  PublicCountryPageListResponseDto,
} from './dto';
import { RequirePermissions, Public, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Country Pages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class CountryPagesController {
  constructor(private readonly countryPagesService: CountryPagesService) {}

  // ==========================================
  // Admin endpoints
  // ==========================================

  @Get('admin/countryPages')
  @RequirePermissions('countryPages.read')
  @ApiOperation({ summary: 'List country pages' })
  @ApiResponse({ status: 200, type: CountryPageListResponseDto })
  async findAll(@Query() query: GetCountryPagesQueryDto): Promise<CountryPageListResponseDto> {
    return this.countryPagesService.findAll(query);
  }

  @Get('admin/countryPages/:countryPageId')
  @RequirePermissions('countryPages.read')
  @ApiOperation({ summary: 'Get country page by ID (with sections)' })
  @ApiParam({ name: 'countryPageId', description: 'CountryPage UUID' })
  @ApiResponse({ status: 200, type: CountryPageResponseDto })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  async findById(
    @Param('countryPageId') countryPageId: string,
  ): Promise<CountryPageResponseDto> {
    return this.countryPagesService.findById(countryPageId);
  }

  @Post('admin/countryPages')
  @RequirePermissions('countryPages.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create country page',
    description:
      'Creates a publishable marketing page bound to a Country. One page per country (countryId is unique on the page table). Slug is globally unique.',
  })
  @ApiResponse({ status: 201, type: CountryPageResponseDto })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiResponse({ status: 409, description: 'Slug or countryId already exists' })
  async create(
    @Body() dto: CreateCountryPageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountryPageResponseDto> {
    return this.countryPagesService.create(dto, currentUser.id);
  }

  @Patch('admin/countryPages/:countryPageId')
  @RequirePermissions('countryPages.update')
  @ApiOperation({ summary: 'Update country page' })
  @ApiParam({ name: 'countryPageId', description: 'CountryPage UUID' })
  @ApiResponse({ status: 200, type: CountryPageResponseDto })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  @ApiResponse({ status: 409, description: 'Slug already used by another page' })
  async update(
    @Param('countryPageId') countryPageId: string,
    @Body() dto: UpdateCountryPageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountryPageResponseDto> {
    return this.countryPagesService.update(countryPageId, dto, currentUser.id);
  }

  @Delete('admin/countryPages/:countryPageId')
  @RequirePermissions('countryPages.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete country page (cascades to sections)',
    description:
      'Safe to delete: TemplateBindings, BindingNationalityFees, and Applications all reference Country, not CountryPage.',
  })
  @ApiParam({ name: 'countryPageId', description: 'CountryPage UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  async delete(
    @Param('countryPageId') countryPageId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.countryPagesService.delete(countryPageId, currentUser.id);
  }

  // ==========================================
  // Public endpoints
  // ==========================================

  @Get('public/countryPages')
  @Public()
  @ApiOperation({ summary: 'List published country pages' })
  @ApiResponse({ status: 200, type: PublicCountryPageListResponseDto })
  async findAllPublic(): Promise<PublicCountryPageListResponseDto> {
    return this.countryPagesService.findAllPublic();
  }

  @Get('public/countryPages/:slug')
  @Public()
  @ApiOperation({
    summary: 'Get published country page by slug',
    description:
      'Public detail with sections. Replaces the legacy /public/countries/:slug route which was tied to the conflated countries.slug column.',
  })
  @ApiParam({ name: 'slug', description: 'Country page slug', example: 'turkey' })
  @ApiResponse({ status: 200, type: PublicCountryPageResponseDto })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  async findBySlugPublic(@Param('slug') slug: string): Promise<PublicCountryPageResponseDto> {
    return this.countryPagesService.findBySlugPublic(slug);
  }
}
