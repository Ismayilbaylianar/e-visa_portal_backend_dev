import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto';

export class GetApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  destinationCountryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  visaTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter applications created from this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter applications created until this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
