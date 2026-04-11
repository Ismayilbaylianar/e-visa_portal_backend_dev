import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { TrackApplicationDto, TrackingResponseDto } from './dto';

@ApiTags('Tracking - Public')
@Controller('public/tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track application status',
    description: 'Search for an application using email and application code to check its status',
  })
  @ApiResponse({
    status: 200,
    description: 'Application tracking information',
    type: TrackingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async search(@Body() dto: TrackApplicationDto): Promise<TrackingResponseDto> {
    return this.trackingService.search(dto);
  }
}
