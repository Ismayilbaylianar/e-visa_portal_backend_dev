import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackApplicationDto, TrackingResponseDto, StatusHistoryItemDto } from './dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search for application status using email and application code
   *
   * Tracking is based on applicant-level code.
   * Email must match the applicant's email.
   */
  async search(dto: TrackApplicationDto): Promise<TrackingResponseDto> {
    const email = dto.email.toLowerCase().trim();

    // Find applicant by email and application code
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        applicationCode: dto.applicationCode,
        deletedAt: null,
      },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'No application found with this email and application code combination',
        },
      ]);
    }

    // Map status history
    const statusHistory: StatusHistoryItemDto[] = applicant.statusHistory.map(history => ({
      oldStatus: history.oldStatus,
      newStatus: history.newStatus,
      note: history.note || null,
      changedAt: history.createdAt,
    }));

    // Check if result file is available
    const resultAvailable = !!(applicant.resultFileName && applicant.resultStorageKey);

    this.logger.log(`Application tracked: ${dto.applicationCode} by ${email}`);

    return {
      applicationCode: applicant.applicationCode!,
      currentStatus: applicant.status,
      statusHistory,
      resultAvailable,
      resultFileName: applicant.resultFileName || null,
    };
  }
}
