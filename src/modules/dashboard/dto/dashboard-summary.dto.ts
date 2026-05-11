import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  // Application counts
  @ApiProperty({ description: 'Total number of applications', example: 1250 })
  totalApplications: number;

  @ApiProperty({ description: 'Number of draft applications', example: 50 })
  draftApplications: number;

  @ApiProperty({ description: 'Number of unpaid applications', example: 30 })
  unpaidApplications: number;

  @ApiProperty({ description: 'Number of submitted applications', example: 100 })
  submittedApplications: number;

  @ApiProperty({ description: 'Number of in-review applications', example: 45 })
  inReviewApplications: number;

  @ApiProperty({
    description:
      'M11.13 BUG V — Number of applications awaiting customer document upload (NEED_DOCS). Feeds the admin "Pending Action" widget alongside submitted + in-review.',
    example: 12,
  })
  needDocsApplications: number;

  @ApiProperty({ description: 'Number of approved applications', example: 800 })
  approvedApplications: number;

  @ApiProperty({ description: 'Number of rejected applications', example: 50 })
  rejectedApplications: number;

  @ApiProperty({
    description:
      'M11.13 BUG V — Number of applications with visas issued and waiting for the customer to download (READY_TO_DOWNLOAD).',
    example: 18,
  })
  readyToDownloadApplications: number;

  // Payment counts
  @ApiProperty({ description: 'Total number of payments', example: 1000 })
  totalPayments: number;

  @ApiProperty({ description: 'Number of paid payments', example: 850 })
  paidPayments: number;

  @ApiProperty({ description: 'Number of failed payments', example: 50 })
  failedPayments: number;

  @ApiProperty({ description: 'Number of pending payments', example: 100 })
  pendingPayments: number;

  // User counts
  @ApiProperty({ description: 'Total number of portal users', example: 5000 })
  totalPortalUsers: number;

  @ApiProperty({ description: 'Total number of admin users', example: 10 })
  totalAdminUsers: number;

  // Revenue
  @ApiProperty({ description: 'Total revenue amount', example: 125000.5 })
  totalRevenue: number;

  @ApiProperty({ description: 'Revenue today', example: 1500.0 })
  revenueToday: number;
}
