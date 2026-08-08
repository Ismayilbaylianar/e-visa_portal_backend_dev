import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions';
import { ApplicationStatus, ActorType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { ErrorCodes } from '@/common/constants';
import {
  MyApplicationsResponseDto,
  MyApplicationItemDto,
  MyApplicationApplicantDto,
} from './dto';

/**
 * Customer-side portal logic. Owns the /me/applications listing.
 * (The M9b document-resubmission flow was removed in Stage 3 — extra
 * documents are now requested by email, outside the system.)
 */
@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  /**
   * Internal document type for the issued visa PDF. Mirrored from
   * ApplicantsService — kept duplicated rather than imported to avoid
   * a forwardRef chain just for one constant.
   */
  private static readonly ISSUED_VISA_DOC_TYPE = 'issued_visa';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================
  // Listing
  // =========================================================

  async getMyApplications(portalIdentityId: string): Promise<MyApplicationsResponseDto> {
    const applications = await this.prisma.application.findMany({
      where: {
        portalIdentityId,
        deletedAt: null,
      },
      include: {
        destinationCountry: true,
        visaType: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          // Pull just enough document data to compute hasIssuedVisa +
          // uploadedDocumentTypes without leaking storage internals.
          include: {
            documents: {
              where: { deletedAt: null },
              select: { documentTypeKey: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: MyApplicationItemDto[] = applications.map((app) => {
      const mainApplicant = app.applicants?.find((a) => a.isMainApplicant);
      // The brief asks for an application-level `applicationCode` —
      // we lift it from the main applicant since that's where the
      // backend currently stores it. (Per-applicant codes also exist
      // on each applicant entry below.)
      const applicationCode = mainApplicant?.applicationCode ?? undefined;

      const mappedApplicants: MyApplicationApplicantDto[] = (app.applicants ?? []).map(
        (applicant) => {
          const docTypes = applicant.documents?.map((d) => d.documentTypeKey) ?? [];
          const hasIssuedVisa = docTypes.includes(CustomerPortalService.ISSUED_VISA_DOC_TYPE);
          const uploadedDocumentTypes = docTypes.filter(
            (t) => t !== CustomerPortalService.ISSUED_VISA_DOC_TYPE,
          );
          return {
            id: applicant.id,
            isMainApplicant: applicant.isMainApplicant,
            email: applicant.email,
            status: applicant.status,
            applicationCode: applicant.applicationCode || undefined,
            hasIssuedVisa,
            uploadedDocumentTypes,
          };
        },
      );

      return {
        id: app.id,
        applicationCode,
        currentStatus: app.currentStatus,
        paymentStatus: app.paymentStatus,
        totalFeeAmount: app.totalFeeAmount.toString(),
        currencyCode: app.currencyCode,
        expedited: app.expedited,
        requestedDocumentTypes: app.requestedDocumentTypes?.length
          ? app.requestedDocumentTypes
          : undefined,
        estimatedProcessingDays: app.estimatedProcessingDays ?? null,
        estimatedTimeUpdatedAt: app.estimatedTimeUpdatedAt ?? null,
        rejectionReason: app.rejectionReason || undefined,
        adminNote: app.adminNote || undefined,
        destinationCountry: app.destinationCountry
          ? {
              id: app.destinationCountry.id,
              name: app.destinationCountry.name,
              isoCode: app.destinationCountry.isoCode,
            }
          : undefined,
        visaType: app.visaType
          ? {
              id: app.visaType.id,
              purpose: app.visaType.purpose,
              label: app.visaType.label,
            }
          : undefined,
        applicants: mappedApplicants,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    });

    this.logger.log(
      `Retrieved ${items.length} applications for portal identity: ${portalIdentityId}`,
    );

    return {
      items,
      total: items.length,
    };
  }

}
