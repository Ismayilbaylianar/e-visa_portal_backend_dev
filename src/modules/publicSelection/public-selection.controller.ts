import { Controller, Get, Post, Body, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicSelectionService } from './public-selection.service';
import { Public } from '@/common/decorators';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
  GetDestinationsByNationalityQueryDto,
  GetVisaTypesByCombinationQueryDto,
  CascadeDestinationsResponseDto,
  CascadeVisaTypesResponseDto,
  DetectNationalityResponseDto,
} from './dto';

@ApiTags('Public Selection')
@Controller('public/selection')
export class PublicSelectionController {
  constructor(private readonly publicSelectionService: PublicSelectionService) {}

  @Get('options')
  @Public()
  @ApiOperation({
    summary: 'Get selection options',
    description:
      'Get available destination countries, nationality countries, and visa types for application selection. No authentication required. Kept for backwards compatibility — new clients should use the cascade endpoints (destinations, visa-types).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Selection options including destination countries, nationality countries, and visa types',
    type: SelectionOptionsResponseDto,
  })
  async getOptions(): Promise<SelectionOptionsResponseDto> {
    return this.publicSelectionService.getOptions();
  }

  @Post('preview')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get fee preview',
    description:
      'Get fee breakdown and eligibility for a specific nationality, destination, and visa type combination. Returns binding ID and template ID if eligible. Rejects same-country combos with `sameCountryBlocked`. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fee preview with binding and template information',
    type: SelectionPreviewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Same-country combination rejected (sameCountryBlocked)',
  })
  @ApiResponse({
    status: 404,
    description: 'No valid binding found for this combination (bindingNotFound)',
  })
  async getPreview(@Body() dto: SelectionPreviewRequestDto): Promise<SelectionPreviewResponseDto> {
    return this.publicSelectionService.getPreview(dto);
  }

  /**
   * M10 §A — Cascade endpoint 1.
   *
   * Drives the destination dropdown after the user picks (or
   * auto-detects) their nationality. Excludes the user's own country
   * and any destination that has no active fee for them.
   */
  @Get('destinations')
  @Public()
  @ApiOperation({
    summary: 'Get destinations available for a nationality',
    description:
      'Returns the list of destination countries that have at least one active, date-valid TemplateBinding with an active BindingNationalityFee for the given nationality. Excludes the user\'s own country (server-side same-country block).',
  })
  @ApiQuery({ name: 'nationality', description: 'Nationality country UUID', required: true })
  @ApiResponse({
    status: 200,
    description: 'Destinations available for the given nationality',
    type: CascadeDestinationsResponseDto,
  })
  async getDestinations(
    @Query() query: GetDestinationsByNationalityQueryDto,
  ): Promise<CascadeDestinationsResponseDto> {
    return this.publicSelectionService.getDestinationsForNationality(query.nationality);
  }

  /**
   * M10 §A — Cascade endpoint 2.
   *
   * Drives the visa-type dropdown after the user has chosen both
   * nationality and destination. Returns an empty list for
   * same-country combos (the cascade UI shouldn't reach this state,
   * but a direct caller will simply see "no visa types available").
   */
  @Get('visa-types')
  @Public()
  @ApiOperation({
    summary: 'Get visa types for a (nationality, destination) combination',
    description:
      'Returns the visa types that have an active fee for the given nationality at the given destination. Same-country combos return an empty list.',
  })
  @ApiQuery({ name: 'nationality', description: 'Nationality country UUID', required: true })
  @ApiQuery({ name: 'destination', description: 'Destination country UUID', required: true })
  @ApiResponse({
    status: 200,
    description: 'Visa types available for the given combination',
    type: CascadeVisaTypesResponseDto,
  })
  async getVisaTypes(
    @Query() query: GetVisaTypesByCombinationQueryDto,
  ): Promise<CascadeVisaTypesResponseDto> {
    return this.publicSelectionService.getVisaTypesForCombination(
      query.nationality,
      query.destination,
    );
  }

  /**
   * M10 §B — IP-based nationality auto-detect.
   *
   * Returns a country reference when the request IP can be resolved
   * to one of our active nationalities. The geoLookup backend is
   * currently a stub (always null), so this endpoint will return
   * { countryCode: null, fallback: '...' } until M10b wires a real
   * provider. The frontend handles the null case by falling through
   * to the manual dropdown — no breakage during the placeholder
   * period.
   */
  @Get('detect-nationality')
  @Public()
  @ApiOperation({
    summary: 'Auto-detect nationality from request IP',
    description:
      'Resolves the request IP to a country and matches against our active nationalities. Returns null countryCode when geoLookup cannot resolve OR the resolved country is not in our active list — frontend should fall through to the manual dropdown.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detected nationality (countryCode may be null)',
    type: DetectNationalityResponseDto,
  })
  async detectNationality(@Req() req: Request): Promise<DetectNationalityResponseDto> {
    return this.publicSelectionService.detectNationalityByIp(this.extractIpAddress(req));
  }

  /**
   * Mirrors the pattern used in auth/portalAuth controllers — Hetzner
   * is behind a reverse proxy, so we trust X-Forwarded-For (first
   * value) before falling back to req.ip / socket.remoteAddress.
   */
  private extractIpAddress(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      return forwarded.split(',')[0].trim();
    }
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
