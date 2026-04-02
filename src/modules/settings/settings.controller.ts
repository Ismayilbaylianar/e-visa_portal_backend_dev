import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, SettingsResponseDto } from './dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

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
    description: 'Get current system settings. Creates default settings if none exist.',
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
    description: 'Update system settings. Only provided fields will be updated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    type: SettingsResponseDto,
  })
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return this.settingsService.updateSettings(dto);
  }
}
