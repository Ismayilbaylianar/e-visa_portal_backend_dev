import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogResponseDto, GetAuditLogsQueryDto } from './dto';
import { NotFoundException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetAuditLogsQueryDto,
  ): Promise<{ items: AuditLogResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }
    if (query.actionKey) {
      where.actionKey = query.actionKey;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(query.dateTo);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
            select: { id: true, fullName: true, email: true },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = logs.map(log => this.mapToResponse(log));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<AuditLogResponseDto> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actorUser: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    return this.mapToResponse(log);
  }

  private mapToResponse(log: any): AuditLogResponseDto {
    return {
      id: log.id,
      actorUserId: log.actorUserId || undefined,
      actorUser: log.actorUser || undefined,
      actionKey: log.actionKey,
      entityType: log.entityType,
      entityId: log.entityId || undefined,
      oldData: log.oldData || undefined,
      newData: log.newData || undefined,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      createdAt: log.createdAt,
    };
  }
}
