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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CountryPageImagesService } from './country-page-images.service';
import {
  CountryPageImageListResponseDto,
  CountryPageImageResponseDto,
  ReorderCountryPageImagesDto,
  UpdateCountryPageImageDto,
  UploadCountryPageImageBodyDto,
} from './dto';
import { CurrentUser, Public, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';
import type { MulterFile } from '../documents/dto';

@ApiTags('Country Page Images')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/countryPages/:slug/images')
export class CountryPageImagesAdminController {
  constructor(private readonly service: CountryPageImagesService) {}

  @Get()
  @RequirePermissions('countryPages.read')
  @ApiOperation({ summary: 'List all images for a country page (admin)' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: CountryPageImageListResponseDto })
  async list(@Param('slug') slug: string): Promise<CountryPageImageListResponseDto> {
    return this.service.list(slug);
  }

  /**
   * Reorder route declared BEFORE `:id` so Nest doesn't route
   * `/reorder` into the by-id update handler.
   */
  @Patch('reorder')
  @RequirePermissions('countryPages.update')
  @ApiOperation({ summary: 'Bulk reorder country page images (drag-drop)' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: CountryPageImageListResponseDto })
  async reorder(
    @Param('slug') slug: string,
    @Body() dto: ReorderCountryPageImagesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CountryPageImageListResponseDto> {
    return this.service.reorder(
      slug,
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Post()
  @RequirePermissions('countryPages.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a hero-slider image' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 201, type: CountryPageImageResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('slug') slug: string,
    @UploadedFile() file: MulterFile,
    @Body() body: UploadCountryPageImageBodyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CountryPageImageResponseDto> {
    return this.service.create(
      slug,
      file,
      body.altText,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Patch(':id')
  @RequirePermissions('countryPages.update')
  @ApiOperation({ summary: 'Update an image (alt text, isPublished)' })
  @ApiParam({ name: 'slug' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: CountryPageImageResponseDto })
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCountryPageImageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CountryPageImageResponseDto> {
    return this.service.update(
      slug,
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermissions('countryPages.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an image + best-effort storage cleanup' })
  @ApiParam({ name: 'slug' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.delete(slug, id, user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}

@ApiTags('Country Page Images - Public')
@Controller('public/countryPages/:slug/images')
export class CountryPageImagesPublicController {
  constructor(private readonly service: CountryPageImagesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public list of published hero images for a country page' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: CountryPageImageListResponseDto })
  async listPublished(
    @Param('slug') slug: string,
  ): Promise<CountryPageImageListResponseDto> {
    return this.service.listPublishedBySlug(slug);
  }
}
