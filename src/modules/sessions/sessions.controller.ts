import { Controller, Get, Delete, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { SessionListResponseDto, RevokeAllSessionsResponseDto } from './dto';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { CurrentUserData } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('me')
  @RequirePermissions('sessions.read')
  @ApiOperation({
    summary: 'Get my active sessions',
    description: 'Get all active sessions for the current authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
    type: SessionListResponseDto,
  })
  async getActiveSessions(@CurrentUser() user: CurrentUserData): Promise<SessionListResponseDto> {
    return this.sessionsService.getActiveSessions(user.id, user.sessionId);
  }

  @Delete(':sessionId')
  @RequirePermissions('sessions.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke session',
    description: 'Revoke a specific session by ID. Cannot revoke current session.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID to revoke' })
  @ApiResponse({
    status: 204,
    description: 'Session revoked successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot revoke current session or access denied',
  })
  async revokeSession(
    @CurrentUser() user: CurrentUserData,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.sessionsService.revokeSession(user.id, sessionId, user.sessionId);
  }

  @Delete('revokeAll')
  @RequirePermissions('sessions.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke all sessions',
    description: 'Revoke all sessions except the current one',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions revoked successfully',
    type: RevokeAllSessionsResponseDto,
  })
  async revokeAllSessions(
    @CurrentUser() user: CurrentUserData,
  ): Promise<RevokeAllSessionsResponseDto> {
    return this.sessionsService.revokeAllSessions(user.id, user.sessionId);
  }
}
