import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import {
  UploadDocumentBodyDto,
  ReviewDocumentDto,
  DocumentResponseDto,
  DocumentUrlResponseDto,
} from './dto';
import { ApplicantIdParamDto, DocumentIdParamDto } from '@/common/dto';
import { CurrentPortalIdentity, CurrentUser, RequirePermissions } from '@/common/decorators';
import { PortalAuthGuard, JwtAuthGuard } from '@/common/guards';
import { PortalIdentityUser, AuthenticatedUser } from '@/common/types';

@ApiTags('Documents Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal')
export class DocumentsPortalController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('applicants/:applicantId/documents')
  @ApiOperation({
    summary: 'Get documents for applicant',
    description: 'Get all documents for a specific applicant',
  })
  @ApiResponse({
    status: 200,
    description: 'List of documents',
    type: [DocumentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Applicant not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findByApplicant(
    @Param() params: ApplicantIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<DocumentResponseDto[]> {
    return this.documentsService.findByApplicant(params.applicantId, portalIdentity.id);
  }

  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload document',
    description: 'Upload a new document for an applicant',
  })
  @ApiBody({
    description: 'Document upload with file and metadata',
    type: UploadDocumentBodyDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Applicant not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 415, description: 'File type not allowed' })
  async upload(
    @Body() dto: UploadDocumentBodyDto,
    @UploadedFile() file: any,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.upload(
      {
        documentTypeKey: dto.documentTypeKey,
        applicantId: dto.applicantId,
      },
      file,
      portalIdentity.id,
    );
  }

  @Get('documents/:documentId')
  @ApiOperation({
    summary: 'Get document by ID',
    description: 'Get document details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Document details',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findById(
    @Param() params: DocumentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findById(params.documentId, portalIdentity.id);
  }

  @Get('documents/:documentId/download')
  @ApiOperation({
    summary: 'Download document file',
    description: 'Download the actual file for a document',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream')
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async downloadFile(
    @Param() params: DocumentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } = await this.documentsService.downloadFile(
      params.documentId,
      portalIdentity.id,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  @Get('documents/:documentId/url')
  @ApiOperation({
    summary: 'Get signed URL for document',
    description: 'Get a time-limited signed URL for direct file access',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL',
    type: DocumentUrlResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSignedUrl(
    @Param() params: DocumentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<DocumentUrlResponseDto> {
    const url = await this.documentsService.getSignedUrl(params.documentId, portalIdentity.id);
    return { url, expiresIn: 3600 };
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete document',
    description: 'Soft delete a document',
  })
  @ApiResponse({ status: 204, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async delete(
    @Param() params: DocumentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<void> {
    return this.documentsService.delete(params.documentId, portalIdentity.id);
  }
}

@ApiTags('Documents Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/documents')
export class DocumentsAdminController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':documentId')
  @RequirePermissions('documents.read')
  @ApiOperation({
    summary: 'Get document by ID (admin)',
    description: 'Get document details by ID without ownership check',
  })
  @ApiResponse({
    status: 200,
    description: 'Document details',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findById(@Param() params: DocumentIdParamDto): Promise<DocumentResponseDto> {
    return this.documentsService.findByIdAdmin(params.documentId);
  }

  @Get(':documentId/download')
  @RequirePermissions('documents.download')
  @ApiOperation({
    summary: 'Download document file (admin)',
    description: 'Download the actual file for a document without ownership check',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream')
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async downloadFile(
    @Param() params: DocumentIdParamDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } = await this.documentsService.downloadFileAdmin(
      params.documentId,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  @Patch(':documentId/review')
  @RequirePermissions('documents.review')
  @ApiOperation({
    summary: 'Review document',
    description: 'Review a document and set its status (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Document reviewed successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async review(
    @Param() params: DocumentIdParamDto,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.review(params.documentId, user.id, dto);
  }

  @Get(':documentId/verify')
  @RequirePermissions('documents.verify')
  @ApiOperation({
    summary: 'Verify document integrity',
    description: 'Verify that the document file has not been tampered with',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification result',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        documentId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async verifyIntegrity(
    @Param() params: DocumentIdParamDto,
  ): Promise<{ verified: boolean; documentId: string }> {
    const verified = await this.documentsService.verifyIntegrity(params.documentId);
    return { verified, documentId: params.documentId };
  }

  @Delete(':documentId/hard')
  @RequirePermissions('documents.hard_delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard delete document',
    description:
      'Permanently delete document and file from storage. Irreversible — restricted to superAdmin. Audit trail emits document.hard_delete with originalFileName + storageKey so the destruction is traceable even after the row is gone.',
  })
  @ApiResponse({ status: 204, description: 'Document permanently deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async hardDelete(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.documentsService.hardDelete(params.documentId, user.id);
  }
}
