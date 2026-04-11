import { ApiProperty } from '@nestjs/swagger';

export class StatusCountDto {
  @ApiProperty({ example: 'SUBMITTED' })
  status: string;

  @ApiProperty({ example: 45 })
  count: number;
}

export class CountryCountDto {
  @ApiProperty({ example: 'US' })
  countryCode: string;

  @ApiProperty({ example: 'United States' })
  countryName: string;

  @ApiProperty({ example: 120 })
  count: number;
}

export class MonthlyRevenueDto {
  @ApiProperty({ example: '2026-01' })
  month: string;

  @ApiProperty({ example: 50000.0 })
  revenue: number;
}

export class DailyCountDto {
  @ApiProperty({ example: '2026-04-01' })
  date: string;

  @ApiProperty({ example: 15 })
  count: number;
}

export class DashboardChartsDto {
  @ApiProperty({
    description: 'Applications grouped by status',
    type: [StatusCountDto],
  })
  applicationsByStatus: StatusCountDto[];

  @ApiProperty({
    description: 'Payments grouped by status',
    type: [StatusCountDto],
  })
  paymentsByStatus: StatusCountDto[];

  @ApiProperty({
    description: 'Applications grouped by destination country (top 10)',
    type: [CountryCountDto],
  })
  applicationsByDestination: CountryCountDto[];

  @ApiProperty({
    description: 'Revenue grouped by month (last 6 months)',
    type: [MonthlyRevenueDto],
  })
  revenueByMonth: MonthlyRevenueDto[];

  @ApiProperty({
    description: 'Daily application counts (last 30 days)',
    type: [DailyCountDto],
  })
  recentDailyApplications: DailyCountDto[];
}
