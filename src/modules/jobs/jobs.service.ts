import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobResponseDto, GetJobsQueryDto, JobExecutionDto } from './dto';
import { NotFoundException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import { JobStatus, JobExecutionStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetJobsQueryDto,
  ): Promise<{ items: JobResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.jobType) {
      where.jobType = query.jobType;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.job.count({ where }),
    ]);

    const items = jobs.map(job => this.mapToResponse(job));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Job not found' },
      ]);
    }

    return this.mapToResponse(job);
  }

  /**
   * Retry a failed or cancelled job
   *
   * Behavior:
   * - Only FAILED or CANCELLED jobs can be retried
   * - Increments retry count
   * - Resets status to PENDING
   * - Creates a job execution record for tracking
   */
  async retry(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Job not found' },
      ]);
    }

    const retryableStatuses: JobStatus[] = [JobStatus.FAILED, JobStatus.CANCELLED];
    if (!retryableStatuses.includes(job.status)) {
      throw new BadRequestException('Job cannot be retried', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Only failed or cancelled jobs can be retried. Current status: ${job.status}`,
        },
      ]);
    }

    if (job.retryCount >= job.maxRetryCount) {
      throw new BadRequestException('Maximum retry attempts reached', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Maximum retry count (${job.maxRetryCount}) reached`,
        },
      ]);
    }

    const updatedJob = await this.prisma.$transaction(async prisma => {
      // Update job status
      const updated = await prisma.job.update({
        where: { id },
        data: {
          status: JobStatus.PENDING,
          retryCount: { increment: 1 },
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
        },
        include: {
          executions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Create execution record for retry
      await prisma.jobExecution.create({
        data: {
          jobId: id,
          executionStatus: JobExecutionStatus.PENDING,
        },
      });

      return updated;
    });

    this.logger.log(`Job retried: ${id} (attempt ${updatedJob.retryCount})`);
    return this.mapToResponse(updatedJob);
  }

  /**
   * Cancel a pending or processing job
   *
   * Behavior:
   * - Only PENDING or PROCESSING jobs can be cancelled
   * - COMPLETED or already CANCELLED jobs cannot be cancelled
   * - Creates a job execution record for tracking
   */
  async cancel(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Job not found' },
      ]);
    }

    const nonCancellableStatuses: JobStatus[] = [JobStatus.COMPLETED, JobStatus.CANCELLED];
    if (nonCancellableStatuses.includes(job.status)) {
      throw new BadRequestException('Job cannot be cancelled', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Cannot cancel a ${job.status.toLowerCase()} job`,
        },
      ]);
    }

    const updatedJob = await this.prisma.$transaction(async prisma => {
      const updated = await prisma.job.update({
        where: { id },
        data: {
          status: JobStatus.CANCELLED,
          finishedAt: new Date(),
        },
        include: {
          executions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Create execution record for cancellation
      await prisma.jobExecution.create({
        data: {
          jobId: id,
          executionStatus: JobExecutionStatus.CANCELLED,
          finishedAt: new Date(),
        },
      });

      return updated;
    });

    this.logger.log(`Job cancelled: ${id}`);
    return this.mapToResponse(updatedJob);
  }

  /**
   * Create a new job
   */
  async create(params: {
    jobType: string;
    payload: Record<string, any>;
    scheduledAt?: Date;
    maxRetryCount?: number;
  }): Promise<JobResponseDto> {
    const job = await this.prisma.job.create({
      data: {
        jobType: params.jobType,
        payloadJson: params.payload,
        scheduledAt: params.scheduledAt,
        maxRetryCount: params.maxRetryCount ?? 3,
        status: JobStatus.PENDING,
      },
    });

    this.logger.log(`Job created: ${job.id} (${params.jobType})`);
    return this.mapToResponse(job);
  }

  private mapToResponse(job: any): JobResponseDto {
    return {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      payload: job.payloadJson || undefined,
      result: undefined,
      errorMessage: job.errorMessage || undefined,
      retryCount: job.retryCount,
      maxRetries: job.maxRetryCount,
      scheduledAt: job.scheduledAt || undefined,
      startedAt: job.startedAt || undefined,
      completedAt: job.finishedAt || undefined,
      executions: job.executions?.map((e: any) => ({
        id: e.id,
        executionStatus: e.executionStatus,
        startedAt: e.startedAt,
        finishedAt: e.finishedAt || undefined,
        errorMessage: e.errorMessage || undefined,
        createdAt: e.createdAt,
      })),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
