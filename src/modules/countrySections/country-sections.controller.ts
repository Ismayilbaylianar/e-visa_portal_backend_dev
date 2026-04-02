import {
  Controller,
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
import { CountrySectionsService } from './country-sections.service';
import { CreateCountrySectionDto, UpdateCountrySectionDto } from './dto';
import { CountrySectionResponseDto } from '../countries/dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Country Sections')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class CountrySectionsController {
  constructor(private readonly countrySectionsService: CountrySectionsService) {}

  @Post('admin/countries/:countryId/sections')
  @RequirePermissions('countries.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create country section',
    description: 'Create a new section for a country',
  })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({
    status: 201,
    description: 'Section created successfully',
    type: CountrySectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async create(
    @Param('countryId') countryId: string,
    @Body() dto: CreateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.create(countryId, dto);
  }

  @Patch('admin/countrySections/:sectionId')
  @RequirePermissions('countries.update')
  @ApiOperation({
    summary: 'Update country section',
    description: 'Update a country section',
  })
  @ApiParam({ name: 'sectionId', description: 'Section ID' })
  @ApiResponse({
    status: 200,
    description: 'Section updated successfully',
    type: CountrySectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
  })
  async update(
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.update(sectionId, dto);
  }

  @Delete('admin/countrySections/:sectionId')
  @RequirePermissions('countries.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete country section',
    description: 'Soft delete a country section',
  })
  @ApiParam({ name: 'sectionId', description: 'Section ID' })
  @ApiResponse({
    status: 204,
    description: 'Section deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
  })
  async delete(@Param('sectionId') sectionId: string): Promise<void> {
    return this.countrySectionsService.delete(sectionId);
  }
}
