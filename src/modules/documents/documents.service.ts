import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto, ReviewDocumentDto, DocumentResponseDto, MulterFile } from './dto';
import { NotFoundException, ForbiddenException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { DocumentReviewStatus, ApplicationStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH') || './uploads';
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadPath}`);
    }
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

    return documents.map(doc => this.mapToResponse(doc));
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
   * Upload a document with local filesystem storage
   *
   * Validates:
   * - File size (max 10MB)
   * - MIME type (pdf, jpeg, png)
   * - Applicant ownership
   * - Application is in editable state (DRAFT)
   */
  async upload(
    dto: UploadDocumentDto,
    file: MulterFile,
    portalIdentityId: string,
  ): Promise<DocumentResponseDto> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'File is required' },
      ]);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.FILE_TOO_LARGE,
          message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        },
      ]);
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type', [
        {
          reason: ErrorCodes.FILE_TYPE_NOT_ALLOWED,
          message: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
      ]);
    }

    // Find applicant and verify ownership
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

    // Check if application is editable (only DRAFT status)
    if (applicant.application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Documents can only be uploaded to draft applications',
        },
      ]);
    }

    // Generate safe storage filename
    const fileExtension = path.extname(file.originalname);
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const storageFileName = `${uniqueId}${fileExtension}`;
    const storagePath = `documents/${dto.applicantId}`;
    const fullStoragePath = path.join(this.uploadPath, storagePath);
    const fullFilePath = path.join(fullStoragePath, storageFileName);

    // Ensure directory exists
    if (!fs.existsSync(fullStoragePath)) {
      fs.mkdirSync(fullStoragePath, { recursive: true });
    }

    // Write file to disk
    try {
      fs.writeFileSync(fullFilePath, file.buffer);
    } catch (error) {
      this.logger.error(`Failed to write file: ${error}`);
      throw new BadRequestException('File upload failed', [
        { reason: ErrorCodes.FILE_UPLOAD_FAILED, message: 'Failed to save file to storage' },
      ]);
    }

    // Create document record
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

    this.logger.log(`Document uploaded: ${document.id} for applicant: ${dto.applicantId}`);
    return this.mapToResponse(document);
  }

  /**
   * Soft delete a document
   * Note: File is kept on disk for audit purposes. Manual cleanup may be needed.
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

    // Check if application is editable (only DRAFT status)
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
