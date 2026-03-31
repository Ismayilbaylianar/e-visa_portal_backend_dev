import { Controller, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { SessionResponseDto, CurrentSessionResponseDto } from './dto';
import { CurrentUser } from '@/common/decorators';
import { AuthenticatedUser } from '@/common/types';
import { SessionIdParamDto } from '@/common/dto';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@Controller('admin/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current session',
    description: 'Get details of the current authenticated session',
  })
  @ApiResponse({
    status: 200,
    description: 'Current session details',
    type: CurrentSessionResponseDto,
  })
  async getCurrentSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentSessionResponseDto> {
    // TODO: Get actual session ID from request
    const sessionId = 'current-session-id';
    return this.sessionsService.getCurrentSession(user.id, sessionId);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke session',
    description: 'Revoke a specific session by ID',
  })
  @ApiResponse({
    status: 204,
    description: 'Session revoked successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SessionIdParamDto,
  ): Promise<void> {
    await this.sessionsService.revokeSession(user.id, params.sessionId);
  }

  @Delete('revokeAll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke all sessions',
    description: 'Revoke all sessions except the current one',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions revoked successfully',
    schema: {
      properties: {
        revokedCount: { type: 'number', example: 5 },
      },
    },
  })
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ revokedCount: number }> {
    // TODO: Get actual session ID from request
    const currentSessionId = 'current-session-id';
    const count = await this.sessionsService.revokeAllSessions(user.id, currentSessionId);
    return { revokedCount: count };
  }
}
