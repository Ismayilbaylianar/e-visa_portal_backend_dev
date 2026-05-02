import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto, DashboardChartsDto } from './dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('dashboard.read')
  @ApiOperation({
    summary: 'Get dashboard summary',
    description: 'Get summary statistics for the admin dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary',
    type: DashboardSummaryDto,
  })
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }

  @Get('charts')
  @RequirePermissions('dashboard.read')
  @ApiOperation({
    summary: 'Get dashboard charts data',
    description: 'Get data for dashboard charts',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard charts data',
    type: DashboardChartsDto,
  })
  async getCharts(): Promise<DashboardChartsDto> {
    return this.dashboardService.getCharts();
  }
}
