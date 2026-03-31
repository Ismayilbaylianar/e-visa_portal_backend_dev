import { Controller, Get, Post, Patch, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JobResponseDto, GetJobsQueryDto } from './dto';
import { JobIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Jobs')
@ApiBearerAuth('JWT-auth')
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all jobs',
    description: 'Get paginated list of jobs with optional filters',
  })
  @ApiPaginatedResponse(JobResponseDto)
  async findAll(@Query() query: GetJobsQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':jobId')
  @ApiOperation({
    summary: 'Get job by ID',
    description: 'Get job details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Job details',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async findById(@Param() params: JobIdParamDto): Promise<JobResponseDto> {
    return this.jobsService.findById(params.jobId);
  }

  @Post(':jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry a failed job',
    description: 'Retry a failed or cancelled job',
  })
  @ApiResponse({
    status: 200,
    description: 'Job queued for retry',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be retried',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async retry(@Param() params: JobIdParamDto): Promise<JobResponseDto> {
    return this.jobsService.retry(params.jobId);
  }

  @Patch(':jobId/cancel')
  @ApiOperation({
    summary: 'Cancel a job',
    description: 'Cancel a pending or processing job',
  })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be cancelled',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async cancel(@Param() params: JobIdParamDto): Promise<JobResponseDto> {
    return this.jobsService.cancel(params.jobId);
  }
}
