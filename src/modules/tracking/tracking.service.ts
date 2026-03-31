import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackApplicationDto, TrackingResponseDto } from './dto';
import { NotFoundException } from '@/common/exceptions';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(dto: TrackApplicationDto): Promise<TrackingResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: {
        email: dto.email,
        applicationCode: dto.applicationCode,
        deletedAt: null,
      },
      include: {
        application: {
          include: {
            destinationCountry: true,
            visaType: true,
          },
        },
      },
    });

    if (!applicant || !applicant.application) {
      throw new NotFoundException(
        'Application not found. Please check your email and application code.',
      );
    }

    this.logger.log(
      `Application tracked: ${dto.applicationCode} by ${dto.email}`,
    );

    return {
      status: applicant.application.currentStatus,
      applicantInfo: {
        id: applicant.id,
        email: applicant.email,
        phone: applicant.phone || undefined,
        applicationCode: applicant.applicationCode!,
        status: applicant.status,
        isMainApplicant: applicant.isMainApplicant,
      },
      destinationCountry: applicant.application.destinationCountry?.name,
      visaType: applicant.application.visaType?.label,
      submittedAt: applicant.application.createdAt,
      expectedCompletionAt: applicant.application.expedited
        ? new Date(
            applicant.application.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000,
          )
        : new Date(
            applicant.application.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000,
          ),
    };
  }
}
