import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortalSessionResponseDto } from './dto';
import * as crypto from 'crypto';

export interface CreatePortalSessionInput {
  portalIdentityId: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

@Injectable()
export class PortalSessionsService {
  private readonly logger = new Logger(PortalSessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePortalSessionInput): Promise<PortalSessionResponseDto> {
    const refreshTokenHash = this.hashToken(input.refreshToken);

    const session = await this.prisma.portalSession.create({
      data: {
        portalIdentityId: input.portalIdentityId,
        refreshTokenHash,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
      },
    });

    this.logger.log(`Portal session created: ${session.id}`);
    return this.mapToResponse(session);
  }

  async findByIdentity(portalIdentityId: string): Promise<PortalSessionResponseDto[]> {
    const sessions = await this.prisma.portalSession.findMany({
      where: {
        portalIdentityId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(s => this.mapToResponse(s));
  }

  async findByRefreshToken(refreshToken: string): Promise<PortalSessionResponseDto | null> {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.portalSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return null;
    }

    return this.mapToResponse(session);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.portalSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Portal session revoked: ${sessionId}`);
  }

  async revokeAll(portalIdentityId: string): Promise<void> {
    await this.prisma.portalSession.updateMany({
      where: {
        portalIdentityId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`All portal sessions revoked for identity: ${portalIdentityId}`);
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.prisma.portalSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private mapToResponse(session: any): PortalSessionResponseDto {
    return {
      id: session.id,
      portalIdentityId: session.portalIdentityId,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt || undefined,
    };
  }
}
