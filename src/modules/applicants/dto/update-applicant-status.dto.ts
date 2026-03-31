import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicantStatus } from '@/common/enums';

export class UpdateApplicantStatusDto {
  @ApiProperty({
    description: 'New applicant status',
    enum: ApplicantStatus,
    example: ApplicantStatus.IN_REVIEW,
  })
  @IsEnum(ApplicantStatus)
  status: ApplicantStatus;

  @ApiPropertyOptional({
    description: 'Note explaining the status change',
    example: 'Documents verified successfully',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
