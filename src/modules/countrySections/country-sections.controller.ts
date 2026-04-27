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
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Country Sections')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class CountrySectionsController {
  constructor(private readonly countrySectionsService: CountrySectionsService) {}

  @Post('admin/countryPages/:countryPageId/sections')
  @RequirePermissions('countryPages.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a section under a country page',
    description:
      'Sections are the content blocks (Overview / Requirements / FAQ / etc.) shown on a published CountryPage.',
  })
  @ApiParam({ name: 'countryPageId', description: 'CountryPage UUID' })
  @ApiResponse({ status: 201, type: CountrySectionResponseDto })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  async create(
    @Param('countryPageId') countryPageId: string,
    @Body() dto: CreateCountrySectionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.create(countryPageId, dto, currentUser.id);
  }

  @Patch('admin/countrySections/:sectionId')
  @RequirePermissions('countryPages.update')
  @ApiOperation({ summary: 'Update country section' })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiResponse({ status: 200, type: CountrySectionResponseDto })
  @ApiResponse({ status: 404, description: 'Section not found' })
  async update(
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateCountrySectionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CountrySectionResponseDto> {
    return this.countrySectionsService.update(sectionId, dto, currentUser.id);
  }

  @Delete('admin/countrySections/:sectionId')
  @RequirePermissions('countryPages.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a country section' })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Section not found' })
  async delete(
    @Param('sectionId') sectionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.countrySectionsService.delete(sectionId, currentUser.id);
  }
}
