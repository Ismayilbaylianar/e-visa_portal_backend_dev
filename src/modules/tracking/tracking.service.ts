import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TrackApplicationDto,
  TrackingResponseDto,
  StatusHistoryItemDto,
  BookingTrackingResponseDto,
} from './dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * M11.10 (BUG 4) — Search by EITHER applicant code (APP-YYYY-NNNNNN)
   * OR booking reference code (REF-YYYY-NNNNNN).
   *
   *   - REF code     → matches `applications.reference_code`. Returns
   *                    the whole booking with every applicant's
   *                    status + history. Email must match the portal
   *                    identity OR any applicant email.
   *   - APP code     → matches `application_applicants.application_code`.
   *                    Returns the booking too (so the customer always
   *                    sees their siblings' progress) — single-applicant
   *                    bookings render as a list of one.
   *
   * Email match is case-insensitive against either the portal
   * identity email or any applicant email under the booking. This
   * supports the multi-applicant case where the booking-owner uses
   * email A but applicant 2 has email B.
   *
   * Returns the new BookingTrackingResponseDto (was the older
   * single-applicant TrackingResponseDto). Frontend hooks should
   * accept both shapes during the transition window — see the API
   * client.
   */
  async search(dto: TrackApplicationDto): Promise<BookingTrackingResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const code = (dto.applicationCode ?? '').trim();

    let applicationId: string | null = null;

    // 1. REF code path — case-insensitive email match against the
    //    booking owner's portal identity OR any applicant on the
    //    booking. The OR is typed via Prisma.ApplicationWhereInput[]
    //    so TS accepts the heterogeneous shape (some clauses
    //    target the relation, others traverse one level deeper).
    if (code.toUpperCase().startsWith('REF-')) {
      const appOrClauses: Prisma.ApplicationWhereInput[] = [
        { portalIdentity: { email: { equals: email, mode: 'insensitive' } } },
        {
          applicants: {
            some: {
              email: { equals: email, mode: 'insensitive' },
              deletedAt: null,
            },
          },
        },
      ];
      const application = await this.prisma.application.findFirst({
        where: {
          referenceCode: code,
          deletedAt: null,
          OR: appOrClauses,
        },
        select: { id: true },
      });
      if (application) applicationId = application.id;
    } else {
      // 2. APP code path — same logic from the applicant side. The
      //    OR includes either the applicant's own email match or
      //    a match through the parent application's portal identity
      //    or sibling applicants.
      const apOrClauses: Prisma.ApplicationApplicantWhereInput[] = [
        { email: { equals: email, mode: 'insensitive' } },
        {
          application: {
            portalIdentity: { email: { equals: email, mode: 'insensitive' } },
          },
        },
        {
          application: {
            applicants: {
              some: {
                email: { equals: email, mode: 'insensitive' },
                deletedAt: null,
              },
            },
          },
        },
      ];
      const applicant = await this.prisma.applicationApplicant.findFirst({
        where: {
          applicationCode: code,
          deletedAt: null,
          OR: apOrClauses,
        },
        select: { applicationId: true },
      });
      if (applicant) applicationId = applicant.applicationId;
    }

    if (!applicationId) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message:
            'No booking found with this email and code combination. Check the code and try again.',
        },
      ]);
    }

    // Load the booking + every applicant + each applicant's status
    // history. Single round-trip.
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: {
        id: true,
        referenceCode: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          select: {
            applicationCode: true,
            status: true,
            resultFileName: true,
            resultStorageKey: true,
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!application) {
      // Race: application was soft-deleted between the two lookups.
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application no longer exists' },
      ]);
    }

    const applicants: TrackingResponseDto[] = application.applicants.map((ap) => {
      const statusHistory: StatusHistoryItemDto[] = ap.statusHistory.map((h) => ({
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        note: h.note || null,
        changedAt: h.createdAt,
      }));
      return {
        applicationCode: ap.applicationCode ?? '',
        referenceCode: application.referenceCode ?? null,
        currentStatus: ap.status,
        statusHistory,
        resultAvailable: !!(ap.resultFileName && ap.resultStorageKey),
        resultFileName: ap.resultFileName ?? null,
      };
    });

    this.logger.log(
      `[BUG 4] tracked booking ${application.referenceCode ?? application.id} via ${code} (${applicants.length} applicant(s))`,
    );

    return {
      referenceCode: application.referenceCode ?? '',
      applicants,
    };
  }
}
