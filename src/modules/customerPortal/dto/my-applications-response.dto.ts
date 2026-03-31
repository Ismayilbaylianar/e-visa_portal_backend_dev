import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';

export class MyApplicationCountryDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;
}

export class MyApplicationVisaTypeDto {
  @ApiProperty({ description: 'Visa type ID' })
  id: string;

  @ApiProperty({ description: 'Visa purpose' })
  purpose: string;

  @ApiProperty({ description: 'Display label' })
  label: string;
}

export class MyApplicationApplicantDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiProperty({ description: 'Applicant status' })
  status: string;

  @ApiPropertyOptional({ description: 'Application code' })
  applicationCode?: string;
}

export class MyApplicationItemDto {
  @ApiProperty({
    description: 'Application ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Current application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.DRAFT,
  })
  currentStatus: ApplicationStatus;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @ApiProperty({
    description: 'Total fee amount',
    example: '150.00',
  })
  totalFeeAmount: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Whether expedited processing is requested',
    example: false,
  })
  expedited: boolean;

  @ApiPropertyOptional({
    type: MyApplicationCountryDto,
    description: 'Destination country details',
  })
  destinationCountry?: MyApplicationCountryDto;

  @ApiPropertyOptional({
    type: MyApplicationVisaTypeDto,
    description: 'Visa type details',
  })
  visaType?: MyApplicationVisaTypeDto;

  @ApiPropertyOptional({
    type: [MyApplicationApplicantDto],
    description: 'Application applicants',
  })
  applicants?: MyApplicationApplicantDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class MyApplicationsResponseDto {
  @ApiProperty({
    type: [MyApplicationItemDto],
    description: 'List of user applications',
  })
  items: MyApplicationItemDto[];

  @ApiProperty({
    description: 'Total number of applications',
    example: 5,
  })
  total: number;
}
