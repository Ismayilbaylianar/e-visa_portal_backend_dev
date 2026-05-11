import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ResultFilesService } from './result-files.service';
import { JwtAuthGuard } from '@/common/guards';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { AuthenticatedUser } from '@/common/types';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * M11.14 (BUG FF — PART 2) — Admin endpoints for issued-visa +
 * supporting files. Public/portal-facing counterparts live in
 * CustomerPortalPublicController so the token-auth flow stays
 * grouped with the rest of the portal-public surface.
 */
@ApiTags('Application Result Files (Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/applications/:applicationId/result-files')
export class ResultFilesController {
  constructor(private readonly resultFiles: ResultFilesService) {}

  @Post()
  @RequirePermissions('applications.update')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a result file (issued visa / supporting doc)',
    description:
      'Multipart upload. Required: file. Optional: description, isPrimary (string "true"/"false"), applicantId. When isPrimary=true, any existing primary on this application is demoted first.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file / unknown applicant' })
  async upload(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: MulterFile,
    @Body() body: { description?: string; isPrimary?: string | boolean; applicantId?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const isPrimary =
      body.isPrimary === true || body.isPrimary === 'true' || body.isPrimary === '1';
    return this.resultFiles.upload({
      applicationId,
      applicantId: body.applicantId || null,
      file,
      description: body.description,
      isPrimary,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
  }

  @Get()
  @RequirePermissions('applications.read')
  @ApiOperation({ summary: 'List result files for an application' })
  async list(@Param('applicationId') applicationId: string) {
    return this.resultFiles.listForApplication(applicationId);
  }

  @Get(':fileId/url')
  @RequirePermissions('applications.read')
  @ApiOperation({
    summary: 'Signed URL for admin preview/download',
    description:
      'Returns a short-lived signed URL the admin browser can open directly. inline=true → inline disposition; inline=false → attachment.',
  })
  async getUrl(
    @Param('applicationId') applicationId: string,
    @Param('fileId') fileId: string,
    @Query('inline') inlineQ?: string,
  ) {
    const inline = inlineQ === 'true' || inlineQ === '1';
    return this.resultFiles.getSignedUrl(applicationId, fileId, inline);
  }

  @Delete(':fileId')
  @RequirePermissions('applications.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a result file' })
  async delete(
    @Param('applicationId') applicationId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resultFiles.softDelete(applicationId, fileId, user.id);
  }
}
