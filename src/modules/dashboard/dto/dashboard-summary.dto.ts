import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Total number of applications',
    example: 1250,
  })
  totalApplications: number;

  @ApiProperty({
    description: 'Number of pending applications',
    example: 45,
  })
  pendingApplications: number;

  @ApiProperty({
    description: 'Number of applications approved today',
    example: 12,
  })
  approvedToday: number;

  @ApiProperty({
    description: 'Total revenue in cents',
    example: 125000,
  })
  revenue: number;
}
