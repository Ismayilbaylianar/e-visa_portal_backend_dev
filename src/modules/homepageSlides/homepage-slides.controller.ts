import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { HomepageSlidesService } from './homepage-slides.service';
import {
  CreateHomepageSlideBodyDto,
  HomepageSlideListResponseDto,
  HomepageSlideResponseDto,
  ReorderHomepageSlidesDto,
  UpdateHomepageSlideDto,
} from './dto';
import { CurrentUser, Public, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';
import type { MulterFile } from '../documents/dto';

@ApiTags('Homepage Slides')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/homepage-slides')
export class HomepageSlidesAdminController {
  constructor(private readonly service: HomepageSlidesService) {}

  @Get()
  @RequirePermissions('homepageSlides.read')
  @ApiOperation({ summary: 'List all homepage slides (admin)' })
  @ApiResponse({ status: 200, type: HomepageSlideListResponseDto })
  async list(): Promise<HomepageSlideListResponseDto> {
    return this.service.list();
  }

  @Patch('reorder')
  @RequirePermissions('homepageSlides.update')
  @ApiOperation({ summary: 'Bulk reorder slides (drag-drop)' })
  @ApiResponse({ status: 200, type: HomepageSlideListResponseDto })
  async reorder(
    @Body() dto: ReorderHomepageSlidesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HomepageSlideListResponseDto> {
    return this.service.reorder(dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post()
  @RequirePermissions('homepageSlides.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a homepage slide (image optional)' })
  @ApiResponse({ status: 201, type: HomepageSlideResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateHomepageSlideBodyDto,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HomepageSlideResponseDto> {
    return this.service.create(
      dto,
      file,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Patch(':id')
  @RequirePermissions('homepageSlides.update')
  @ApiOperation({ summary: 'Update slide text fields / visibility' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: HomepageSlideResponseDto })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHomepageSlideDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HomepageSlideResponseDto> {
    return this.service.update(id, dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Delete(':id')
  @RequirePermissions('homepageSlides.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete slide + best-effort storage cleanup' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.delete(id, user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}

@ApiTags('Homepage Slides - Public')
@Controller('public/homepage-slides')
export class HomepageSlidesPublicController {
  constructor(private readonly service: HomepageSlidesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public list of published homepage slides' })
  @ApiResponse({ status: 200, type: HomepageSlideListResponseDto })
  async listPublished(): Promise<HomepageSlideListResponseDto> {
    return this.service.listPublished();
  }
}
