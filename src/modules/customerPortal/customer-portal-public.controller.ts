import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PortalTokenService } from '../applications/portal-token.service';
import { ErrorCodes } from '@/common/constants';
import { BadRequestException, NotFoundException } from '@/common/exceptions';

/**
 * M11.13 (BUG U + T) — Public deep-link redemption.
 *
 * Customer clicks the button in a status email which lands them on
 * `/portal/[code]?token=...` on the frontend. The page POSTs the
 * token here; we verify, fetch the booking, and return a slim
 * payload tailored for the deep-link page.
 *
 * No portal session is created — the token IS the credential for
 * this one render. Subsequent actions (upload via /me, download
 * via the visa endpoints) use the standard portal auth flow.
 */
export class RedeemPortalTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}

@ApiTags('Customer Portal — Public')
@Controller('public/portal')
export class CustomerPortalPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portalToken: PortalTokenService,
  ) {}

  @Post('redeem')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem a portal deep-link token',
    description:
      'Verifies a signed portal token (from a status email) and returns booking + applicants + status. No session created — single-use display only.',
  })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 400, description: 'Malformed / invalid / expired token' })
  @ApiResponse({ status: 404, description: 'Application no longer exists' })
  async redeem(@Body() dto: RedeemPortalTokenDto) {
    let payload;
    try {
      payload = this.portalToken.verify(dto.token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired token', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            err instanceof Error ? err.message : 'Could not verify portal token',
        },
      ]);
    }

    const application = await this.prisma.application.findFirst({
      where: { id: payload.applicationId, deletedAt: null },
      include: {
        portalIdentity: { select: { email: true } },
        destinationCountry: { select: { isoCode: true, name: true, flagEmoji: true } },
        visaType: { select: { purpose: true, label: true } },
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          include: {
            statusHistory: { orderBy: { createdAt: 'asc' } },
            documents: {
              where: { deletedAt: null },
              select: { id: true, documentTypeKey: true, originalFileName: true },
            },
          },
        },
        documentRequests: {
          where: { status: { in: ['pending', 'partial'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application no longer exists' },
      ]);
    }

    // Email audience check — token's email must match either the
    // portal identity OR any applicant email. Prevents replaying a
    // token meant for applicant A on applicant B's booking (same
    // applicationId, different recipient).
    const audienceEmails = new Set<string>();
    if (application.portalIdentity?.email) {
      audienceEmails.add(application.portalIdentity.email.toLowerCase().trim());
    }
    for (const a of application.applicants) {
      if (a.email) audienceEmails.add(a.email.toLowerCase().trim());
    }
    if (!audienceEmails.has(payload.email)) {
      throw new BadRequestException('Token audience mismatch', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'This link was issued for a different recipient.',
        },
      ]);
    }

    return {
      intent: payload.intent,
      applicationId: application.id,
      referenceCode: application.referenceCode,
      currentStatus: application.currentStatus,
      paymentStatus: application.paymentStatus,
      destination: application.destinationCountry
        ? {
            isoCode: application.destinationCountry.isoCode,
            name: application.destinationCountry.name,
            flagEmoji: application.destinationCountry.flagEmoji ?? null,
          }
        : null,
      visaType: application.visaType
        ? {
            purpose: application.visaType.purpose,
            label: application.visaType.label,
          }
        : null,
      portalEmail: application.portalIdentity?.email ?? null,
      applicants: application.applicants.map((a) => {
        const fd = (a.formDataJson ?? {}) as Record<string, any>;
        const first = fd.firstName || fd.first_name || '';
        const last = fd.lastName || fd.last_name || '';
        const fullName = `${first} ${last}`.trim() || null;
        return {
          id: a.id,
          applicationCode: a.applicationCode ?? null,
          status: a.status,
          isMainApplicant: a.isMainApplicant,
          email: a.email,
          fullName,
          documentTypeKeys: a.documents?.map((d) => d.documentTypeKey) ?? [],
          hasIssuedVisa: !!a.resultStorageKey,
          resultFileName: a.resultFileName ?? null,
          statusHistory: a.statusHistory.map((h) => ({
            oldStatus: h.oldStatus,
            newStatus: h.newStatus,
            note: h.note ?? null,
            changedAt: h.createdAt,
          })),
        };
      }),
      requestedDocumentTypes: application.requestedDocumentTypes ?? [],
      pendingDocumentRequest: application.documentRequests?.[0]
        ? {
            id: application.documentRequests[0].id,
            customMessage: application.documentRequests[0].customMessage,
            items: application.documentRequests[0].items.map((it) => ({
              id: it.id,
              name: it.documentName,
              acceptedFormats: it.acceptedFormats,
              maxSizeMb: it.maxSizeMb,
              uploaded: !!it.uploadedDocumentId,
            })),
          }
        : null,
      createdAt: application.createdAt,
    };
  }
}
