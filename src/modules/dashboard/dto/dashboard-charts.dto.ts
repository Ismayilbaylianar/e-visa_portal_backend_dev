import { ApiProperty } from '@nestjs/swagger';

export class StatusCountDto {
  @ApiProperty({ example: 'PENDING' })
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
  @ApiProperty({ example: '2024-01' })
  month: string;

  @ApiProperty({ example: 50000 })
  revenue: number;
}

export class DashboardChartsDto {
  @ApiProperty({
    description: 'Applications grouped by status',
    type: [StatusCountDto],
  })
  applicationsByStatus: StatusCountDto[];

  @ApiProperty({
    description: 'Applications grouped by country',
    type: [CountryCountDto],
  })
  applicationsByCountry: CountryCountDto[];

  @ApiProperty({
    description: 'Revenue grouped by month',
    type: [MonthlyRevenueDto],
  })
  revenueByMonth: MonthlyRevenueDto[];
}
