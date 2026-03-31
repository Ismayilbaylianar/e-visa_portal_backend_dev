import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';

export class PortalIdentityDto {
  @ApiProperty({ description: 'Portal identity ID' })
  id: string;

  @ApiProperty({ description: 'Portal identity email' })
  email: string;
}

export class CountryDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'Country slug' })
  slug: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;
}

export class VisaTypeDto {
  @ApiProperty({ description: 'Visa type ID' })
  id: string;

  @ApiProperty({ description: 'Visa purpose' })
  purpose: string;

  @ApiProperty({ description: 'Validity in days' })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days' })
  maxStay: number;

  @ApiProperty({ description: 'Entry type' })
  entries: string;

  @ApiProperty({ description: 'Display label' })
  label: string;
}

export class TemplateDto {
  @ApiProperty({ description: 'Template ID' })
  id: string;

  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiProperty({ description: 'Template key' })
  key: string;

  @ApiProperty({ description: 'Template version' })
  version: number;
}

export class ApplicantDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiPropertyOptional({ description: 'Applicant phone' })
  phone?: string;

  @ApiProperty({ description: 'Form data (JSON)' })
  formDataJson: any;

  @ApiProperty({ description: 'Applicant status' })
  status: string;

  @ApiPropertyOptional({ description: 'Application code' })
  applicationCode?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ApplicationResponseDto {
  @ApiProperty({
    description: 'Application ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Portal identity ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  portalIdentityId: string;

  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  visaTypeId: string;

  @ApiProperty({
    description: 'Template ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  templateId: string;

  @ApiProperty({
    description: 'Template binding ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  templateBindingId: string;

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

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment deadline',
  })
  paymentDeadlineAt?: Date;

  @ApiProperty({
    description: 'Resume token for continuing application',
    example: 'abc123xyz789',
  })
  resumeToken: string;

  @ApiProperty({
    description: 'Current application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.DRAFT,
  })
  currentStatus: ApplicationStatus;

  @ApiPropertyOptional({
    type: PortalIdentityDto,
    description: 'Portal identity details',
  })
  portalIdentity?: PortalIdentityDto;

  @ApiPropertyOptional({
    type: CountryDto,
    description: 'Nationality country details',
  })
  nationalityCountry?: CountryDto;

  @ApiPropertyOptional({
    type: CountryDto,
    description: 'Destination country details',
  })
  destinationCountry?: CountryDto;

  @ApiPropertyOptional({
    type: VisaTypeDto,
    description: 'Visa type details',
  })
  visaType?: VisaTypeDto;

  @ApiPropertyOptional({
    type: TemplateDto,
    description: 'Template details',
  })
  template?: TemplateDto;

  @ApiPropertyOptional({
    type: [ApplicantDto],
    description: 'Application applicants',
  })
  applicants?: ApplicantDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
