import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators';
import { LocalStorageProvider } from '../storage/providers/local-storage.provider';
import { StorageService } from '../storage/storage.service';

/**
 * M11.11 (BUG C) — File serving endpoint at /api/v1/files/*.
 *
 * Background: signed URLs returned by `LocalStorageProvider.getSignedUrl`
 * point at `/api/v1/files/<storage_key>?token=<sig>`. Without this
 * controller every signed URL 404'd (the storage layer pretended to
 * sign URLs but no controller actually served them — a long-standing
 * bug surfaced when admins started clicking document Preview).
 *
 * Auth model: HMAC-signed query token (see
 * `LocalStorageProvider.verifySignedToken`). The token encodes the
 * exact storage key + expiry + content-disposition hint, and is
 * validated server-side here. No cookie / Bearer needed because the
 * URL itself carries the credential — that's what makes
 * `window.open(signedUrl)` work for both customer + admin previews.
 *
 * The route uses a wildcard `*storageKey` segment so paths with
 * subdirectories like `documents/<applicantId>/<filename>.jpg`
 * route correctly.
 */
@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly storageService: StorageService,
    private readonly localProvider: LocalStorageProvider,
  ) {}

  @Get('*')
  @Public()
  @ApiOperation({
    summary: 'Serve a stored file via short-lived signed URL',
    description:
      'Validates the HMAC token in the `?token=` query, then streams the file from disk with the right Content-Type / Content-Disposition. Returns 401 on missing/invalid/expired token, 404 when the file is gone.',
  })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 401, description: 'Token missing / invalid / expired' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serve(
    @Req() req: Request,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    // M11.11 (BUG C) — extract the storage key from the URL path
    // directly. Nest's `@Param('storageKey')` with `@Get('*storageKey')`
    // doesn't capture the wildcard segments cleanly across all
    // adapters; we instead strip the route prefix from req.path.
    // req.path here is `/api/v1/files/<key>` — slice off the prefix
    // (note: the global API prefix `/api/v1` is stripped before
    // controller match, so req.path is `/files/<key>`).
    const prefixMatch = req.path.match(/^\/files\/(.+)$/);
    const key = prefixMatch ? decodeURIComponent(prefixMatch[1]) : '';
    if (!key) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        data: null,
        error: { code: 'notFound', message: 'No storage key supplied' },
      });
      return;
    }

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        data: null,
        error: { code: 'unauthorized', message: 'Missing access token' },
      });
      return;
    }

    let payload: { disposition: 'inline' | 'attachment'; filename?: string };
    try {
      payload = this.localProvider.verifySignedToken(token, key);
    } catch (err) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        data: null,
        error: {
          code: 'unauthorized',
          message: err instanceof Error ? err.message : 'Invalid token',
        },
      });
      return;
    }

    // Resolve the file via the storage abstraction. For local
    // provider this returns a Buffer + contentType; we wrap in a
    // StreamableFile so Nest handles the Content-Length header
    // correctly. (Direct stream from disk is also possible via
    // localProvider.createReadStream — buffer is fine for our typical
    // 1-3 MB document sizes.)
    let file: { buffer: Buffer; contentType: string; size: number };
    try {
      file = await this.storageService.download(key);
    } catch (err) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        data: null,
        error: {
          code: 'notFound',
          message: 'File not found',
        },
      });
      return;
    }

    const filename =
      payload.filename ||
      key.split('/').pop() ||
      'download';
    res.set({
      'Content-Type': file.contentType,
      'Content-Length': file.size,
      'Content-Disposition': `${payload.disposition}; filename="${encodeURIComponent(filename)}"`,
      // Don't let intermediaries cache (signed URLs are short-lived
      // and per-request).
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(file.buffer);
  }
}
