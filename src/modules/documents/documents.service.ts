import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UploadDocumentDto,
  ReviewDocumentDto,
  DocumentResponseDto,
} from './dto';
import { NotFoundException, ForbiddenException } from '@/common/exceptions';
import { DocumentReviewStatus } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all documents for an applicant
   */
  async findByApplicant(
    applicantId: string,
    portalIdentityId: string,
  ): Promise<DocumentResponseDto[]> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: { application: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this applicant');
    }

    const documents = await this.prisma.document.findMany({
      where: { applicationApplicantId: applicantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map(doc => this.mapToResponse(doc));
  }

  /**
   * Find document by ID
   */
  async findById(
    documentId: string,
    portalIdentityId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        applicationApplicant: {
          include: { application: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (
      document.applicationApplicant.application.portalIdentityId !==
      portalIdentityId
    ) {
      throw new ForbiddenException('Access denied to this document');
    }

    return this.mapToResponse(document);
  }

  /**
   * Find document by ID (admin - no ownership check)
   */
  async findByIdAdmin(documentId: string): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.mapToResponse(document);
  }

  /**
   * Upload a document (placeholder - actual file handling to be implemented)
   */
  async upload(
    dto: UploadDocumentDto,
    file: { originalname: string; mimetype: string; size: number },
    portalIdentityId: string,
  ): Promise<DocumentResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: dto.applicantId, deletedAt: null },
      include: { application: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this applicant');
    }

    // TODO: Implement actual file storage (S3, Azure Blob, etc.)
    const storageFileName = `${Date.now()}_${file.originalname}`;
    const storagePath = `documents/${dto.applicantId}`;

    const document = await this.prisma.document.create({
      data: {
        applicationApplicantId: dto.applicantId,
        documentTypeKey: dto.documentTypeKey,
        originalFileName: file.originalname,
        storageFileName,
        storagePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        reviewStatus: DocumentReviewStatus.PENDING,
        uploadedAt: new Date(),
      },
    });

    this.logger.log(
      `Document uploaded: ${document.id} for applicant: ${dto.applicantId}`,
    );
    return this.mapToResponse(document);
  }

  /**
   * Soft delete a document
   */
  async delete(documentId: string, portalIdentityId: string): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        applicationApplicant: {
          include: { application: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (
      document.applicationApplicant.application.portalIdentityId !==
      portalIdentityId
    ) {
      throw new ForbiddenException('Access denied to this document');
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Document deleted: ${documentId}`);
  }

  /**
   * Review a document (admin only)
   */
  async review(
    documentId: string,
    userId: string,
    dto: ReviewDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        reviewStatus: dto.reviewStatus,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });

    this.logger.log(
      `Document reviewed: ${documentId} with status: ${dto.reviewStatus}`,
    );
    return this.mapToResponse(updatedDocument);
  }

  private mapToResponse(document: any): DocumentResponseDto {
    return {
      id: document.id,
      applicantId: document.applicationApplicantId,
      documentTypeKey: document.documentTypeKey,
      originalFileName: document.originalFileName,
      storageKey: `${document.storagePath}/${document.storageFileName}`,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      reviewStatus: document.reviewStatus,
      reviewNote: document.reviewNote || undefined,
      uploadedAt: document.uploadedAt,
      reviewedAt: document.reviewedAt || undefined,
      reviewedByUserId: document.reviewedByUserId || undefined,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
