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
import { CountriesService } from './countries.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  CountryResponseDto,
  PublicCountryResponseDto,
  GetCountriesQueryDto,
  GetPublicCountriesQueryDto,
} from './dto';
import { CountryIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse, Public } from '@/common/decorators';

@ApiTags('Countries - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/countries')
export class AdminCountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all countries',
    description: 'Get paginated list of countries with optional filters',
  })
  @ApiPaginatedResponse(CountryResponseDto)
  async findAll(@Query() query: GetCountriesQueryDto) {
    return this.countriesService.findAll(query);
  }

  @Get(':countryId')
  @ApiOperation({
    summary: 'Get country by ID',
    description: 'Get country details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Country details',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async findById(@Param() params: CountryIdParamDto): Promise<CountryResponseDto> {
    return this.countriesService.findById(params.countryId);
  }

  @Post()
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
    description: 'Country with this slug or ISO code already exists',
  })
  async create(@Body() dto: CreateCountryDto): Promise<CountryResponseDto> {
    return this.countriesService.create(dto);
  }

  @Patch(':countryId')
  @ApiOperation({
    summary: 'Update country',
    description: 'Update country details',
  })
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
    description: 'Country with this slug or ISO code already exists',
  })
  async update(
    @Param() params: CountryIdParamDto,
    @Body() dto: UpdateCountryDto,
  ): Promise<CountryResponseDto> {
    return this.countriesService.update(params.countryId, dto);
  }

  @Delete(':countryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete country',
    description: 'Soft delete a country',
  })
  @ApiResponse({
    status: 204,
    description: 'Country deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async delete(@Param() params: CountryIdParamDto): Promise<void> {
    return this.countriesService.delete(params.countryId);
  }
}

@ApiTags('Countries - Public')
@Controller('public/countries')
export class PublicCountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all published countries',
    description: 'Get paginated list of published and active countries for public access',
  })
  @ApiPaginatedResponse(PublicCountryResponseDto)
  async findAll(@Query() query: GetPublicCountriesQueryDto) {
    return this.countriesService.findAllPublic(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get country by slug',
    description: 'Get published country details by slug for public access',
  })
  @ApiResponse({
    status: 200,
    description: 'Country details',
    type: PublicCountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async findBySlug(@Param('slug') slug: string): Promise<PublicCountryResponseDto> {
    return this.countriesService.findBySlug(slug);
  }
}
