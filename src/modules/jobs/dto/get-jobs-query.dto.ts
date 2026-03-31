import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto';

export class GetJobsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by job type',
    example: 'EMAIL_SEND',
  })
  @IsOptional()
  @IsString()
  jobType?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  status?: string;
}
