import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto, DashboardChartsDto } from './dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
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
