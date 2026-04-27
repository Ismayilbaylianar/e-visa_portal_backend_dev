import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CountriesService } from './countries.service';
import {
  UpdateCountryDto,
  CountryResponseDto,
  CountryListResponseDto,
  GetCountriesQueryDto,
  PublicCountryListResponseDto,
} from './dto';
import { RequirePermissions, Public, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Countries')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  // ==========================================
  // Admin Endpoints — read + override only.
  // Country reference data is seeded from UN ISO 3166-1; no create/delete.
  // ==========================================

  @Get('admin/countries')
  @RequirePermissions('countries.read')
  @ApiOperation({
    summary: 'List countries (reference)',
    description:
      'Paginated UN ISO 3166-1 reference list. Supports continent / hasPage / search filters.',
  })
  @ApiResponse({ status: 200, type: CountryListResponseDto })
  async findAll(@Query() query: GetCountriesQueryDto): Promise<CountryListResponseDto> {
    return this.countriesService.findAll(query);
  }

  @Get('admin/countries/:countryId')
  @RequirePermissions('countries.read')
  @ApiOperation({ summary: 'Get country by ID' })
  @ApiParam({ name: 'countryId', description: 'Country UUID' })
  @ApiResponse({ status: 200, type: CountryResponseDto })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async findById(@Param('countryId') countryId: string): Promise<CountryResponseDto> {
    return this.countriesService.findById(countryId);
  }

  @Patch('admin/countries/:countryId')
  @RequirePermissions('countries.update')
  @ApiOperation({
    summary: 'Override reference fields on a country',
    description:
      'Limited admin override: name typo, flag emoji, continent code, region label, isActive. Does not affect publishable content (see CountryPages).',
  })
  @ApiParam({ name: 'countryId', description: 'Country UUID' })
  @ApiResponse({ status: 200, type: CountryResponseDto })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async update(
    @Param('countryId') countryId: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountryResponseDto> {
    return this.countriesService.update(countryId, dto, currentUser.id);
  }

  // ==========================================
  // Public endpoint — flat list (paired with smart filter in Sprint 4)
  // ==========================================

  @Get('public/countries')
  @Public()
  @ApiOperation({
    summary: 'Public country list',
    description:
      'Returns all active reference countries. Public selection dropdowns combine this with TemplateBinding existence to derive the offerable destination/nationality lists.',
  })
  @ApiResponse({ status: 200, type: PublicCountryListResponseDto })
  async findAllPublic(): Promise<PublicCountryListResponseDto> {
    return this.countriesService.findAllPublic();
  }
}
