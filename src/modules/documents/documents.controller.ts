import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentBodyDto, ReviewDocumentDto, DocumentResponseDto } from './dto';
import { ApplicantIdParamDto, DocumentIdParamDto } from '@/common/dto';
import { CurrentPortalIdentity, CurrentUser } from '@/common/decorators';
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
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
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
  @ApiResponse({
    status: 404,
    description: 'Applicant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
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
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  async findById(
    @Param() params: DocumentIdParamDto,
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findById(params.documentId, portalIdentity.id);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete document',
    description: 'Soft delete a document',
  })
  @ApiResponse({
    status: 204,
    description: 'Document deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
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

  @Patch(':documentId/review')
  @ApiOperation({
    summary: 'Review document',
    description: 'Review a document and set its status (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Document reviewed successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async review(
    @Param() params: DocumentIdParamDto,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.review(params.documentId, user.id, dto);
  }
}
