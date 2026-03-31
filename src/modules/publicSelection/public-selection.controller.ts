import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PublicSelectionService } from './public-selection.service';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
} from './dto';

@ApiTags('Public Selection')
@Controller('public/selection')
export class PublicSelectionController {
  constructor(private readonly publicSelectionService: PublicSelectionService) {}

  @Get('options')
  @ApiOperation({
    summary: 'Get selection options',
    description:
      'Get available countries and visa types for application selection',
  })
  @ApiResponse({
    status: 200,
    description: 'Selection options',
    type: SelectionOptionsResponseDto,
  })
  async getOptions(): Promise<SelectionOptionsResponseDto> {
    return this.publicSelectionService.getOptions();
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get fee preview',
    description:
      'Get fee breakdown and availability for a specific nationality, destination, and visa type combination',
  })
  @ApiResponse({
    status: 200,
    description: 'Fee preview and availability',
    type: SelectionPreviewResponseDto,
  })
  async getPreview(
    @Body() dto: SelectionPreviewRequestDto,
  ): Promise<SelectionPreviewResponseDto> {
    return this.publicSelectionService.getPreview(dto);
  }
}
