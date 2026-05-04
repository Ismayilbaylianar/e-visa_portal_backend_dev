import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { SessionResponseDto, SessionListResponseDto, RevokeAllSessionsResponseDto } from './dto';
import { NotFoundException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * Sessions service.
 *
 * Two access modes:
 *
 *   1. Self mode — a user reads/manages THEIR OWN sessions (existing
 *      M1 behavior). Endpoints: GET /admin/sessions/me, DELETE
 *      /admin/sessions/:id (when caller owns it),
 *      DELETE /admin/sessions/revokeAll. Permission gate is
 *      `sessions.read` / `sessions.delete` plus the implicit
 *      ownership check inside the service.
 *
 *   2. Admin mode (Module 6b) — an admin reads/manages SOMEONE ELSE'S
 *      sessions for the user-detail page. Endpoints: GET
 *      /admin/users/:userId/sessions, DELETE /admin/sessions/:id
 *      (when caller does NOT own the session). The same
 *      `sessions.read` / `sessions.delete` permissions gate access;
 *      ownership is no longer required because the perm itself
 *      already implies "operator-grade authority over sessions."
 *      Audit emission `session.revoke` is mandatory in this path so
 *      any cross-user session revoke leaves a paper trail.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

    const sessionDtos: SessionResponseDto[] = sessions.map((session) => ({
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
   * Module 6b — Admin lookup of any user's active sessions. Mirrors
   * `getActiveSessions` shape but the `isCurrent` flag is computed
   * against the ADMIN's session id, not the target user's, so the
   * UI can warn admins they're looking at their own session if the
   * target happens to be themselves.
   */
  async getActiveSessionsForUser(
    targetUserId: string,
    callerSessionId: string,
  ): Promise<SessionListResponseDto> {
    // Verify the user exists so we can return a clean 404 instead of
    // an empty list (which would silently hide typos in the URL).
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: targetUserId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        ipAddress: session.ipAddress || undefined,
        userAgent: session.userAgent || undefined,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        isCurrent: session.id === callerSessionId,
        createdAt: session.createdAt,
      })),
      total: sessions.length,
    };
  }

  /**
   * Revoke a session.
   *
   * Self-revoke: caller revokes their own session. Cannot revoke the
   * session they're currently using (must logout for that).
   *
   * Admin-revoke (Module 6b): caller revokes someone else's session.
   * Gated by `sessions.delete` permission at the controller level; no
   * ownership check here because the permission itself is the gate.
   * Emits `session.revoke` audit with full context.
   */
  async revokeSession(
    callerUserId: string,
    sessionId: string,
    callerSessionId: string,
  ): Promise<void> {
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

    // Block self-revoke of the current session in BOTH modes — even an
    // admin shouldn't be able to lock themselves out by revoking the
    // very session they're authenticated with right now.
    if (session.id === callerSessionId) {
      throw new ForbiddenException('Cannot revoke current session', [
        { reason: ErrorCodes.FORBIDDEN, message: 'Use logout endpoint to revoke current session' },
      ]);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    // Audit only fires when an admin revokes someone else's session —
    // self-revokes from a "Sign out other devices" UI are routine and
    // would flood the audit log with low-signal entries.
    if (session.userId !== callerUserId) {
      await this.auditLogsService.logAdminAction(
        callerUserId,
        'session.revoke',
        'Session',
        sessionId,
        {
          userId: session.userId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
        },
        undefined,
      );
      this.logger.log(
        `Session ${sessionId} (user ${session.userId}) revoked by admin ${callerUserId}`,
      );
    } else {
      this.logger.log(`Session ${sessionId} self-revoked by user ${callerUserId}`);
    }
  }

  /**
   * Revoke all sessions for the current user except the current one
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
