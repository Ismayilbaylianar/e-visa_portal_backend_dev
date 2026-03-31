import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobResponseDto, GetJobsQueryDto } from './dto';
import { NotFoundException, BadRequestException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

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
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.mapToResponse(job);
  }

  async retry(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') {
      throw new BadRequestException('Only failed or cancelled jobs can be retried');
    }

    if (job.retryCount >= job.maxRetryCount) {
      throw new BadRequestException('Maximum retry attempts reached');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    });

    this.logger.log(`Job retried: ${id}`);
    return this.mapToResponse(updatedJob);
  }

  async cancel(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel a completed or already cancelled job');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
      },
    });

    this.logger.log(`Job cancelled: ${id}`);
    return this.mapToResponse(updatedJob);
  }

  private mapToResponse(job: any): JobResponseDto {
    return {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      payload: job.payload || undefined,
      result: job.result || undefined,
      errorMessage: job.errorMessage || undefined,
      retryCount: job.retryCount,
      maxRetries: job.maxRetryCount,
      startedAt: job.startedAt || undefined,
      completedAt: job.finishedAt || undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
