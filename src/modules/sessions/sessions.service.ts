import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionResponseDto, SessionListResponseDto, RevokeAllSessionsResponseDto } from './dto';
import { NotFoundException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active sessions for the current user
   */
  async getActiveSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionListResponseDto> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    const sessionDtos: SessionResponseDto[] = sessions.map(session => ({
      id: session.id,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      isCurrent: session.id === currentSessionId,
      createdAt: session.createdAt,
    }));

    return {
      sessions: sessionDtos,
      total: sessionDtos.length,
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string, currentSessionId: string): Promise<void> {
    // Find the session
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Session does not exist or is already revoked' },
      ]);
    }

    // Ensure user owns this session
    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You can only revoke your own sessions' },
      ]);
    }

    // Prevent revoking current session through this endpoint
    if (session.id === currentSessionId) {
      throw new ForbiddenException('Cannot revoke current session', [
        { reason: ErrorCodes.FORBIDDEN, message: 'Use logout endpoint to revoke current session' },
      ]);
    }

    // Revoke the session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Session ${sessionId} revoked by user ${userId}`);
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<RevokeAllSessionsResponseDto> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentSessionId },
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);

    return {
      revokedCount: result.count,
    };
  }
}
