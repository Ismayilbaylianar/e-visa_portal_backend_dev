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
import { CountrySectionsService } from './country-sections.service';
import {
  CreateCountrySectionDto,
  UpdateCountrySectionDto,
  CountrySectionResponseDto,
} from './dto';
import { CountryIdParamDto, SectionIdParamDto } from '@/common/dto';

@ApiTags('Country Sections - Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class CountrySectionsController {
  constructor(private readonly countrySectionsService: CountrySectionsService) {}

  @Post('countries/:countryId/sections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create country section',
    description: 'Create a new section under a country',
  })
  @ApiResponse({
    status: 201,
    description: 'Country section created successfully',
    type: CountrySectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async create(
    @Param() params: CountryIdParamDto,
    @Body() dto: CreateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.create(params.countryId, dto);
  }

  @Patch('countrySections/:sectionId')
  @ApiOperation({
    summary: 'Update country section',
    description: 'Update country section details',
  })
  @ApiResponse({
    status: 200,
    description: 'Country section updated successfully',
    type: CountrySectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country section not found',
  })
  async update(
    @Param() params: SectionIdParamDto,
    @Body() dto: UpdateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.update(params.sectionId, dto);
  }

  @Delete('countrySections/:sectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete country section',
    description: 'Soft delete a country section',
  })
  @ApiResponse({
    status: 204,
    description: 'Country section deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Country section not found',
  })
  async delete(@Param() params: SectionIdParamDto): Promise<void> {
    return this.countrySectionsService.delete(params.sectionId);
  }
}
