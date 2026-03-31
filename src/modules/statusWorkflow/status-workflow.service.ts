import { Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus, ApplicantStatus, PaymentStatus } from '@prisma/client';
import { BadRequestException } from '@/common/exceptions';

type StatusType = ApplicationStatus | ApplicantStatus | PaymentStatus;

@Injectable()
export class StatusWorkflowService {
  private readonly logger = new Logger(StatusWorkflowService.name);

  private readonly applicationStatusTransitions: Map<ApplicationStatus, ApplicationStatus[]> = new Map([
    [ApplicationStatus.DRAFT, [ApplicationStatus.UNPAID, ApplicationStatus.CANCELLED]],
    [ApplicationStatus.UNPAID, [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED]],
    [ApplicationStatus.SUBMITTED, [ApplicationStatus.IN_REVIEW, ApplicationStatus.CANCELLED]],
    [ApplicationStatus.IN_REVIEW, [ApplicationStatus.NEED_DOCS, ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]],
    [ApplicationStatus.NEED_DOCS, [ApplicationStatus.IN_REVIEW, ApplicationStatus.CANCELLED]],
    [ApplicationStatus.APPROVED, [ApplicationStatus.READY_TO_DOWNLOAD]],
    [ApplicationStatus.REJECTED, []],
    [ApplicationStatus.READY_TO_DOWNLOAD, []],
    [ApplicationStatus.CANCELLED, []],
  ]);

  private readonly applicantStatusTransitions: Map<ApplicantStatus, ApplicantStatus[]> = new Map([
    [ApplicantStatus.DRAFT, [ApplicantStatus.SUBMITTED]],
    [ApplicantStatus.SUBMITTED, [ApplicantStatus.IN_REVIEW]],
    [ApplicantStatus.IN_REVIEW, [ApplicantStatus.NEED_DOCS, ApplicantStatus.APPROVED, ApplicantStatus.REJECTED]],
    [ApplicantStatus.NEED_DOCS, [ApplicantStatus.IN_REVIEW]],
    [ApplicantStatus.APPROVED, [ApplicantStatus.READY_TO_DOWNLOAD]],
    [ApplicantStatus.REJECTED, []],
    [ApplicantStatus.READY_TO_DOWNLOAD, []],
  ]);

  private readonly paymentStatusTransitions: Map<PaymentStatus, PaymentStatus[]> = new Map([
    [PaymentStatus.PENDING, [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.EXPIRED, PaymentStatus.CANCELLED]],
    [PaymentStatus.PAID, [PaymentStatus.REFUNDED]],
    [PaymentStatus.FAILED, [PaymentStatus.PENDING]],
    [PaymentStatus.EXPIRED, []],
    [PaymentStatus.CANCELLED, []],
    [PaymentStatus.REFUNDED, []],
  ]);

  validateApplicationTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus): boolean {
    return this.validateTransition(currentStatus, newStatus, this.applicationStatusTransitions);
  }

  validateApplicantTransition(currentStatus: ApplicantStatus, newStatus: ApplicantStatus): boolean {
    return this.validateTransition(currentStatus, newStatus, this.applicantStatusTransitions);
  }

  validatePaymentTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
    return this.validateTransition(currentStatus, newStatus, this.paymentStatusTransitions);
  }

  validateTransition<T extends StatusType>(
    currentStatus: T,
    newStatus: T,
    transitionsMap: Map<T, T[]>,
  ): boolean {
    const allowedTransitions = transitionsMap.get(currentStatus);
    if (!allowedTransitions) {
      return false;
    }
    return allowedTransitions.includes(newStatus);
  }

  assertApplicationTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus): void {
    if (!this.validateApplicationTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  assertApplicantTransition(currentStatus: ApplicantStatus, newStatus: ApplicantStatus): void {
    if (!this.validateApplicantTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  assertPaymentTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): void {
    if (!this.validatePaymentTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  getNextApplicationStatuses(currentStatus: ApplicationStatus): ApplicationStatus[] {
    return this.applicationStatusTransitions.get(currentStatus) ?? [];
  }

  getNextApplicantStatuses(currentStatus: ApplicantStatus): ApplicantStatus[] {
    return this.applicantStatusTransitions.get(currentStatus) ?? [];
  }

  getNextPaymentStatuses(currentStatus: PaymentStatus): PaymentStatus[] {
    return this.paymentStatusTransitions.get(currentStatus) ?? [];
  }
}
