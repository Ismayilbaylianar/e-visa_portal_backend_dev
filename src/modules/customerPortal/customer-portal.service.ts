import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MyApplicationsResponseDto, MyApplicationItemDto } from './dto';

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: MyApplicationItemDto[] = applications.map(app => ({
      id: app.id,
      currentStatus: app.currentStatus,
      paymentStatus: app.paymentStatus,
      totalFeeAmount: app.totalFeeAmount.toString(),
      currencyCode: app.currencyCode,
      expedited: app.expedited,
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
      applicants: app.applicants?.map(applicant => ({
        id: applicant.id,
        isMainApplicant: applicant.isMainApplicant,
        email: applicant.email,
        status: applicant.status,
        applicationCode: applicant.applicationCode || undefined,
      })),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));

    this.logger.log(
      `Retrieved ${items.length} applications for portal identity: ${portalIdentityId}`,
    );

    return {
      items,
      total: items.length,
    };
  }
}
