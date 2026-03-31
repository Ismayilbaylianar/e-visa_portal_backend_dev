import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class ApplicantInfoDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiPropertyOptional({ description: 'Applicant phone' })
  phone?: string;

  @ApiProperty({ description: 'Application code' })
  applicationCode: string;

  @ApiProperty({ description: 'Applicant status' })
  status: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;
}

export class TrackingResponseDto {
  @ApiProperty({
    description: 'Current application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.SUBMITTED,
  })
  status: ApplicationStatus;

  @ApiProperty({
    description: 'Applicant information',
    type: ApplicantInfoDto,
  })
  applicantInfo: ApplicantInfoDto;

  @ApiPropertyOptional({
    description: 'Destination country name',
    example: 'United States',
  })
  destinationCountry?: string;

  @ApiPropertyOptional({
    description: 'Visa type label',
    example: 'Tourist Visa - 30 Days',
  })
  visaType?: string;

  @ApiProperty({
    description: 'Application submission date',
  })
  submittedAt: Date;

  @ApiPropertyOptional({
    description: 'Expected processing completion date',
  })
  expectedCompletionAt?: Date;
}
