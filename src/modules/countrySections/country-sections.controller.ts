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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayUnique } from 'class-validator';
import { CountrySectionsService } from './country-sections.service';
import { CreateCountrySectionDto, UpdateCountrySectionDto } from './dto';
import { CountrySectionResponseDto } from '../countries/dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

/**
 * Inline DTO — colocated with the controller because it's a one-shot
 * payload that doesn't need its own dto/ file. Mirrors the templates
 * ReorderSectionsDto shape so the admin frontend can reuse the same
 * client-side helpers across both reorder surfaces.
 */
class ReorderCountrySectionsDto {
  @ApiProperty({
    description:
      'Section IDs in the desired final order. Must include every active section under the country page; partial reorders are rejected.',
    type: [String],
    example: ['<uuid>', '<uuid>'],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID' })
  @ArrayUnique({ message: 'IDs must be unique' })
  orderedIds!: string[];
}

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

  @Patch('admin/countryPages/:countryPageId/sections/reorder')
  @RequirePermissions('countryPages.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reorder sections under a country page',
    description:
      'Bulk update sortOrder for all sections in the country page. Body must list every section id in the desired order; partial reorders are rejected (prevents accidental data inconsistency). Mirrors the template section reorder pattern.',
  })
  @ApiParam({ name: 'countryPageId', description: 'CountryPage UUID' })
  @ApiResponse({ status: 204, description: 'Sections reordered successfully' })
  @ApiResponse({ status: 404, description: 'CountryPage not found' })
  @ApiResponse({ status: 409, description: 'orderedIds does not match the page sections' })
  async reorderSections(
    @Param('countryPageId') countryPageId: string,
    @Body() dto: ReorderCountrySectionsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.countrySectionsService.reorderSections(
      countryPageId,
      dto.orderedIds,
      currentUser.id,
    );
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
