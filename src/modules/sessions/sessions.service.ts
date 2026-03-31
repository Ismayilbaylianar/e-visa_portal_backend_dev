import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionResponseDto, CurrentSessionResponseDto } from './dto';
import { NotFoundException } from '@/common/exceptions';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current session details
   */
  async getCurrentSession(
    userId: string,
    currentSessionId: string,
  ): Promise<CurrentSessionResponseDto> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: currentSessionId,
        userId,
        revokedAt: null,
      },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      id: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        roleId: session.user.roleId || undefined,
        roleName: session.user.role?.name,
      },
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt || undefined,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
  }

  /**
   * Revoke all sessions for a user except current
   */
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId && { id: { not: exceptSessionId } }),
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);
    return result.count;
  }
}
