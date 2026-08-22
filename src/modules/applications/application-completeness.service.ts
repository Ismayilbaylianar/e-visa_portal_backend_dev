import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@/common/exceptions';
import { collectCompletenessErrors } from './application-completeness';

/**
 * Required-field validation for an application's applicant forms.
 *
 * Lives in its own service rather than on ApplicationsService because
 * PaymentsService needs it too: ApplicationsModule already imports
 * PaymentsModule (accept/cancel/reject move money), so injecting
 * ApplicationsService into PaymentsService would close a dependency
 * cycle. This only needs Prisma, so both modules can provide it
 * directly and neither has to know about the other.
 */
@Injectable()
export class ApplicationCompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check every applicant's `formDataJson` against the template's
   * active field definitions. Throws with one detail per missing
   * field, naming the applicant, so the UI can point at it rather
   * than showing a generic failure.
   *
   * Silently passes when the application has no template — there is
   * nothing to validate against, and refusing would block a booking
   * for a configuration problem the customer cannot fix.
   */
  async assertComplete(applicationId: string): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: {
        templateId: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            applicationCode: true,
            isMainApplicant: true,
            formDataJson: true,
          },
        },
      },
    });
    if (!application?.templateId || application.applicants.length === 0) return;

    const sections = await this.prisma.templateSection.findMany({
      where: { templateId: application.templateId, isActive: true, deletedAt: null },
      include: {
        fields: {
          where: { isActive: true, deletedAt: null },
          select: {
            fieldKey: true,
            label: true,
            fieldType: true,
            isRequired: true,
            isActive: true,
            validationRulesJson: true,
            visibilityRulesJson: true,
          },
        },
      },
    });

    const errors = collectCompletenessErrors(
      sections.flatMap((s) => s.fields),
      application.applicants,
    );
    if (errors.length === 0) return;

    throw new BadRequestException('Application is incomplete', errors);
  }
}
