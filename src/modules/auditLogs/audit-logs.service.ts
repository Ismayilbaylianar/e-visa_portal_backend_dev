import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogResponseDto, GetAuditLogsQueryDto } from './dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import { ActorType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export interface CreateAuditLogParams {
  actorUserId?: string;
  actorType: ActorType;
  actionKey: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async create(params: CreateAuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: params.actorUserId,
          actorType: params.actorType,
          actionKey: params.actionKey,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValueJson: params.oldValue,
          newValueJson: params.newValue,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
      this.logger.debug(
        `Audit log created: ${params.actionKey} on ${params.entityType}:${params.entityId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * Helper method for logging admin user actions
   */
  async logAdminAction(
    userId: string,
    actionKey: string,
    entityType: string,
    entityId: string,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.create({
      actorUserId: userId,
      actorType: ActorType.USER,
      actionKey,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper method for logging system actions
   */
  async logSystemAction(
    actionKey: string,
    entityType: string,
    entityId: string,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
  ): Promise<void> {
    await this.create({
      actorType: ActorType.SYSTEM,
      actionKey,
      entityType,
      entityId,
      oldValue,
      newValue,
    });
  }

  async findAll(
    query: GetAuditLogsQueryDto,
  ): Promise<{ items: AuditLogResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    // Type as Prisma.AuditLogWhereInput so the createdAt range +
    // startsWith filter compose correctly without the implicit `any`
    // we had before. All filtered columns are DB-indexed so even a
    // filtered scan over a million rows stays fast.
    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.actorType) where.actorType = query.actorType;

    // actionKeyPrefix wins over actionKey when both are supplied —
    // this matches the brief's "All approvals" pattern where the UI
    // sends `application.` plus optionally an exact key.
    if (query.actionKeyPrefix) {
      where.actionKey = { startsWith: query.actionKeyPrefix };
    } else if (query.actionKey) {
      where.actionKey = query.actionKey;
    }

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
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

    const items = logs.map((log) => this.mapToResponse(log));

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
      throw new NotFoundException('Audit log not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Audit log not found' },
      ]);
    }

    return this.mapToResponse(log);
  }

  /**
   * Module 8 — fix: prior mapper read `log.oldData` / `log.newData`,
   * but the Prisma row exposes `oldValueJson` / `newValueJson` (per
   * the schema's @map). The result was that EVERY audit-detail
   * response had `oldData/newData = undefined` since M1, regardless
   * of what the writer side stored. Rename also surfaces the more
   * intuitive `oldValue` / `newValue` field names to the API.
   */
  private mapToResponse(log: any): AuditLogResponseDto {
    return {
      id: log.id,
      actorUserId: log.actorUserId || undefined,
      actorUser: log.actorUser || undefined,
      actorType: log.actorType || undefined,
      actionKey: log.actionKey,
      entityType: log.entityType,
      entityId: log.entityId || undefined,
      oldValue: (log.oldValueJson ?? undefined) as
        | Record<string, unknown>
        | undefined,
      newValue: (log.newValueJson ?? undefined) as
        | Record<string, unknown>
        | undefined,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      createdAt: log.createdAt,
    };
  }
}
