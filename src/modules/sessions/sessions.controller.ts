import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { SessionListResponseDto, RevokeAllSessionsResponseDto } from './dto';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { CurrentUserData } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('sessions/me')
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

  /**
   * Module 6b — Admin-scoped session list for the user-detail page.
   * Gated by `sessions.read`; surfaces every active session for the
   * target user so the admin can see "Chrome on Safari, Macbook
   * Air, Baku, last active 2m ago" rows and Revoke individual ones.
   */
  @Get('users/:userId/sessions')
  @RequirePermissions('sessions.read')
  @ApiOperation({
    summary: 'Get active sessions for a user (admin)',
    description:
      'Admin lookup of any user\'s active sessions. Each row includes IP, userAgent, createdAt, lastActivityAt, expiresAt, plus an `isCurrent` flag computed against the calling admin\'s session id (true when the admin is looking at their own session).',
  })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
    type: SessionListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getActiveSessionsForUser(
    @CurrentUser() user: CurrentUserData,
    @Param('userId') userId: string,
  ): Promise<SessionListResponseDto> {
    return this.sessionsService.getActiveSessionsForUser(userId, user.sessionId);
  }

  // NOTE: literal-route DELETE `sessions/revokeAll` MUST be declared
  // before the parameterized `sessions/:sessionId` so Nest's route
  // explorer doesn't bind "revokeAll" as a sessionId param value.
  @Delete('sessions/revokeAll')
  @RequirePermissions('sessions.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke all my sessions',
    description: 'Revoke all of the current user\'s sessions except the one they\'re using.',
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

  @Delete('sessions/:sessionId')
  @RequirePermissions('sessions.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke session',
    description:
      'Revoke a session by ID. Self-revoke (caller revokes own session) is no-audit. Admin-revoke (caller revokes someone else\'s session, gated by `sessions.delete`) emits `session.revoke` with full context. Cannot revoke the session you\'re currently authenticated with — use logout for that.',
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
    description: 'Cannot revoke current session',
  })
  async revokeSession(
    @CurrentUser() user: CurrentUserData,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.sessionsService.revokeSession(user.id, sessionId, user.sessionId);
  }
}
