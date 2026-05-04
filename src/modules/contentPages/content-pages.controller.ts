import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ContentPagesService } from './content-pages.service';
import {
  ContentPageListResponseDto,
  ContentPageResponseDto,
  CreateContentPageDto,
  UpdateContentPageDto,
} from './dto';
import { CurrentUser, Public, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';

@ApiTags('Content Pages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/content-pages')
export class ContentPagesAdminController {
  constructor(private readonly service: ContentPagesService) {}

  @Get()
  @RequirePermissions('content.read')
  @ApiOperation({ summary: 'List all content pages (admin)' })
  @ApiResponse({ status: 200, type: ContentPageListResponseDto })
  async list(): Promise<ContentPageListResponseDto> {
    return this.service.list();
  }

  @Get(':slug')
  @RequirePermissions('content.read')
  @ApiOperation({ summary: 'Get a content page by slug (admin)' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: ContentPageResponseDto })
  async getBySlug(@Param('slug') slug: string): Promise<ContentPageResponseDto> {
    return this.service.getBySlug(slug);
  }

  @Post()
  @RequirePermissions('content.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new content page' })
  @ApiResponse({ status: 201, type: ContentPageResponseDto })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  async create(
    @Body() dto: CreateContentPageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContentPageResponseDto> {
    return this.service.create(dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Patch(':slug')
  @RequirePermissions('content.update')
  @ApiOperation({ summary: 'Update a content page (partial)' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: ContentPageResponseDto })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateContentPageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContentPageResponseDto> {
    return this.service.update(slug, dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Delete(':slug')
  @RequirePermissions('content.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a content page' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.softDelete(slug, user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}

/**
 * Public read-only endpoint. No auth — but the global throttler
 * still applies. Returns 404 on missing OR unpublished.
 */
@ApiTags('Content Pages - Public')
@Controller('public/content-pages')
export class ContentPagesPublicController {
  constructor(private readonly service: ContentPagesService) {}

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get a published content page by slug' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: ContentPageResponseDto })
  @ApiResponse({ status: 404, description: 'Page not found or unpublished' })
  async getBySlug(@Param('slug') slug: string): Promise<ContentPageResponseDto> {
    return this.service.getPublishedBySlug(slug);
  }
}
