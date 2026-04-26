import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StorageConfigService } from '../storage';
import { UploadDocumentDto, ReviewDocumentDto, DocumentResponseDto, MulterFile } from './dto';
import { NotFoundException, ForbiddenException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { DocumentReviewStatus, ApplicationStatus } from '@prisma/client';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly allowedMimeTypes: string[];
  private readonly allowedExtensions: string[];
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly storageConfigService: StorageConfigService,
  ) {
    const validationConfig = this.storageConfigService.getValidationConfig();
    this.allowedMimeTypes = validationConfig.allowedMimeTypes;
    this.allowedExtensions = validationConfig.allowedExtensions;
    this.maxFileSizeBytes = validationConfig.maxFileSizeBytes;

    this.logger.log(
      `DocumentsService initialized with ${this.storageService.getProviderName()} storage provider`,
    );
  }

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
      throw new NotFoundException('Applicant not found', [
        { reason: ErrorCodes.APPLICANT_NOT_FOUND, message: 'Applicant does not exist' },
      ]);
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
      ]);
    }

    const documents = await this.prisma.document.findMany({
      where: { applicationApplicantId: applicantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((doc) => this.mapToResponse(doc));
  }

  /**
   * Find document by ID
   */
  async findById(documentId: string, portalIdentityId: string): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        applicationApplicant: {
          include: { application: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    if (document.applicationApplicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this document' },
      ]);
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
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    return this.mapToResponse(document);
  }

  /**
   * Upload a document using storage abstraction
   *
   * Validates:
   * - File size
   * - MIME type
   * - File extension
   * - Applicant ownership
   * - Application is in editable state (DRAFT)
   */
  async upload(
    dto: UploadDocumentDto,
    file: MulterFile,
    portalIdentityId: string,
  ): Promise<DocumentResponseDto> {
    this.validateFile(file);

    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: dto.applicantId, deletedAt: null },
      include: { application: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        { reason: ErrorCodes.APPLICANT_NOT_FOUND, message: 'Applicant does not exist' },
      ]);
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
      ]);
    }

    if (applicant.application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Documents can only be uploaded to draft applications',
        },
      ]);
    }

    const prefix = `documents/${dto.applicantId}`;

    try {
      const uploadResult = await this.storageService.upload(file.buffer, {
        contentType: file.mimetype,
        prefix,
        originalFilename: file.originalname,
        metadata: {
          applicantId: dto.applicantId,
          documentTypeKey: dto.documentTypeKey,
        },
      });

      const document = await this.prisma.document.create({
        data: {
          applicationApplicantId: dto.applicantId,
          documentTypeKey: dto.documentTypeKey,
          originalFileName: file.originalname,
          storageFileName: uploadResult.filename,
          storagePath: prefix,
          storageKey: uploadResult.storageKey,
          storageProvider: this.storageService.getProviderName(),
          mimeType: file.mimetype,
          fileSize: uploadResult.size,
          checksum: uploadResult.checksum,
          reviewStatus: DocumentReviewStatus.PENDING,
          uploadedAt: new Date(),
        },
      });

      this.logger.log(
        `Document uploaded: ${document.id} for applicant: ${dto.applicantId} (${uploadResult.storageKey})`,
      );

      return this.mapToResponse(document);
    } catch (error) {
      this.logger.error(`Failed to upload document: ${error.message}`, error.stack);
      throw new BadRequestException('File upload failed', [
        { reason: ErrorCodes.FILE_UPLOAD_FAILED, message: 'Failed to save file to storage' },
      ]);
    }
  }

  /**
   * Download a document file
   */
  async downloadFile(
    documentId: string,
    portalIdentityId: string,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        applicationApplicant: {
          include: { application: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    if (document.applicationApplicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this document' },
      ]);
    }

    return this.getDocumentFile(document);
  }

  /**
   * Download a document file (admin - no ownership check)
   */
  async downloadFileAdmin(
    documentId: string,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    return this.getDocumentFile(document);
  }

  /**
   * Get signed URL for document access
   */
  async getSignedUrl(documentId: string, portalIdentityId: string): Promise<string> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        applicationApplicant: {
          include: { application: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    if (document.applicationApplicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this document' },
      ]);
    }

    const storageKey = this.getStorageKey(document);
    return this.storageService.getSignedUrl(storageKey, {
      expiresIn: 3600,
      contentDisposition: `attachment; filename="${document.originalFileName}"`,
    });
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
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    if (document.applicationApplicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this document' },
      ]);
    }

    if (document.applicationApplicant.application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Documents can only be deleted from draft applications',
        },
      ]);
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Document soft deleted: ${documentId}`);
  }

  /**
   * Hard delete a document and its file from storage (admin only)
   */
  async hardDelete(documentId: string): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    const storageKey = this.getStorageKey(document);

    try {
      await this.storageService.delete(storageKey);
      this.logger.log(`File deleted from storage: ${storageKey}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${storageKey} - ${error.message}`);
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    this.logger.log(`Document hard deleted: ${documentId}`);
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
      throw new NotFoundException('Document not found', [
        { reason: ErrorCodes.DOCUMENT_NOT_FOUND, message: 'Document does not exist' },
      ]);
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        reviewStatus: dto.reviewStatus,
        reviewNote: dto.reviewNote || null,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });

    this.logger.log(`Document reviewed: ${documentId} with status: ${dto.reviewStatus}`);
    return this.mapToResponse(updatedDocument);
  }

  /**
   * Verify document file integrity
   */
  async verifyIntegrity(documentId: string): Promise<boolean> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!document || !document.checksum) {
      return false;
    }

    const storageKey = this.getStorageKey(document);
    return this.storageService.verifyChecksum(storageKey, document.checksum);
  }

  private validateFile(file: MulterFile): void {
    if (!file) {
      throw new BadRequestException('No file provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'File is required' },
      ]);
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.FILE_TOO_LARGE,
          message: `File size exceeds maximum allowed (${this.maxFileSizeBytes / 1024 / 1024}MB)`,
        },
      ]);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type', [
        {
          reason: ErrorCodes.FILE_TYPE_NOT_ALLOWED,
          message: `Allowed types: ${this.allowedMimeTypes.join(', ')}`,
        },
      ]);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (this.allowedExtensions.length > 0 && !this.allowedExtensions.includes(ext)) {
      throw new BadRequestException('Invalid file extension', [
        {
          reason: ErrorCodes.FILE_EXTENSION_NOT_ALLOWED,
          message: `Allowed extensions: ${this.allowedExtensions.join(', ')}`,
        },
      ]);
    }

    const sanitizedName = this.sanitizeFilename(file.originalname);
    if (sanitizedName !== file.originalname && sanitizedName.includes('..')) {
      throw new BadRequestException('Invalid filename', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Filename contains invalid characters' },
      ]);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '.');
  }

  private getStorageKey(document: any): string {
    if (document.storageKey) {
      return document.storageKey;
    }
    return `${document.storagePath}/${document.storageFileName}`;
  }

  private async getDocumentFile(
    document: any,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const storageKey = this.getStorageKey(document);

    try {
      const result = await this.storageService.download(storageKey);
      return {
        buffer: result.buffer,
        contentType: result.contentType,
        filename: document.originalFileName,
      };
    } catch (error) {
      this.logger.error(`Failed to download file: ${storageKey}`, error);
      throw new NotFoundException('File not found', [
        { reason: ErrorCodes.FILE_NOT_FOUND, message: 'Document file not found in storage' },
      ]);
    }
  }

  private mapToResponse(document: any): DocumentResponseDto {
    return {
      id: document.id,
      applicationApplicantId: document.applicationApplicantId,
      documentTypeKey: document.documentTypeKey,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      reviewStatus: document.reviewStatus,
      reviewNote: document.reviewNote || null,
      uploadedAt: document.uploadedAt,
      reviewedAt: document.reviewedAt || null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
