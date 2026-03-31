import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SettingsResponseDto, UpdateSettingsDto } from './dto';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get system settings',
    description: 'Get current system settings',
  })
  @ApiResponse({
    status: 200,
    description: 'System settings',
    type: SettingsResponseDto,
  })
  async get(): Promise<SettingsResponseDto> {
    return this.settingsService.get();
  }

  @Patch()
  @ApiOperation({
    summary: 'Update system settings',
    description: 'Update one or more system settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated system settings',
    type: SettingsResponseDto,
  })
  async update(@Body() dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return this.settingsService.update(dto);
  }
}
