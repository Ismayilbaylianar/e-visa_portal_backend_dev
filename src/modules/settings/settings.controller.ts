import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, SettingsResponseDto } from './dto';
import { Public, RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

/**
 * Module 4 — Admin Settings (singleton).
 *
 * No POST / DELETE — there is exactly one settings row per environment.
 * GET auto-creates the row with defaults on first read; PATCH updates it
 * in place and emits a single audit log entry per save with full
 * before/after snapshots.
 *
 * Class-level @UseGuards(JwtAuthGuard) keeps JwtAuthGuard before
 * PermissionsGuard in the resolved chain (Modul 1 / 1.5 / 2 / 3 lesson).
 */
@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({
    summary: 'Get settings',
    description:
      'Get current system settings. Creates default settings if none exist.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current settings',
    type: SettingsResponseDto,
  })
  async getSettings(): Promise<SettingsResponseDto> {
    return this.settingsService.getSettings();
  }

  @Patch()
  @RequirePermissions('settings.update')
  @ApiOperation({
    summary: 'Update settings',
    description:
      'Update system settings. Only provided fields are updated; the rest stay as-is. A single audit log entry (settings.update) is emitted per save with full before/after snapshots.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    type: SettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (invalid email / URL / out-of-range integer)',
  })
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.updateSettings(dto, currentUser.id);
  }
}

/**
 * M11.10 (maintenance toggle) — Public read of maintenance state.
 * Consumed by the customer /apply page (and any other surface that
 * wants to gate flows on the toggle). Returns ONLY the maintenance
 * fields — every other settings field stays admin-only.
 */
@ApiTags('System - Public')
@Controller('public/system')
export class PublicSystemController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('maintenance')
  @Public()
  @ApiOperation({
    summary: 'Public maintenance-mode status',
    description:
      'Returns whether new applications are currently disabled, plus the admin-edited message to display. Cached server-side (5s TTL) so a burst of /apply page-loads only hits the DB once.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', example: false },
        message: { type: 'string', nullable: true, example: 'We are upgrading the system. Service will resume at 02:00 UTC.' },
      },
    },
  })
  async getMaintenanceState(): Promise<{ enabled: boolean; message: string | null }> {
    return this.settingsService.getMaintenanceState();
  }
}
