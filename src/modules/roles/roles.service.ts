import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  RoleListResponseDto,
  GetRolesQueryDto,
} from './dto';
import { NotFoundException, ConflictException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { isSystemRole } from '../accessControl/system-protection.constants';

/**
 * Module 6 — Roles service.
 *
 * System protection (Modul 6 D2 — all sharp):
 *   • System roles (superAdmin / admin / operator) cannot be deleted —
 *     existing rule, kept.
 *   • System role `key` cannot be renamed — runtime references to
 *     `superAdmin` etc. would silently break (PermissionsGuard,
 *     `isSuperAdminRole`, audit filters all key on the literal string).
 *   • POST endpoint forces `isSystem=false` — admins cannot mint new
 *     "system" roles via the API; system flag is only set by the seed.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(query: GetRolesQueryDto): Promise<RoleListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.isSystem !== undefined) where.isSystem = query.isSystem;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          _count: { select: { users: { where: { deletedAt: null } } } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.role.count({ where }),
    ]);

    const items = roles.map((role) => this.mapToResponse(role));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(role);
  }

  /**
   * Create new role. `isSystem` from the DTO is ignored — admin cannot
   * mint system roles via the API; that flag is reserved for the seed.
   */
  async create(dto: CreateRoleDto, actorUserId?: string): Promise<RoleResponseDto> {
    const existingByKey = await this.prisma.role.findFirst({ where: { key: dto.key } });
    if (existingByKey) {
      throw new ConflictException('Role key already exists', [
        { field: 'key', reason: ErrorCodes.CONFLICT, message: 'A role with this key already exists' },
      ]);
    }

    const existingByName = await this.prisma.role.findFirst({ where: { name: dto.name } });
    if (existingByName) {
      throw new ConflictException('Role name already exists', [
        { field: 'name', reason: ErrorCodes.CONFLICT, message: 'A role with this name already exists' },
      ]);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        // Admin cannot mint system roles via the API — only the seed sets it.
        isSystem: false,
      },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.create',
        'Role',
        role.id,
        undefined,
        { key: role.key, name: role.name, description: role.description, isSystem: role.isSystem },
      );
    }

    this.logger.log(`Role created: ${role.id} (${role.key})`);
    return this.mapToResponse(role);
  }

  /**
   * Update role. System role `key` rename is blocked (would silently
   * break runtime references to `superAdmin` etc.). `name` and
   * `description` stay editable on system roles.
   */
  async update(id: string, dto: UpdateRoleDto, actorUserId?: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    // System role `key` rename guard.
    if (dto.key !== undefined && dto.key !== role.key && isSystemRole(role.key)) {
      throw new ConflictException('System role key is locked', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: `Role key "${role.key}" is referenced in code and cannot be renamed. You can still update the name and description.`,
        },
      ]);
    }

    if (dto.key && dto.key !== role.key) {
      const existingByKey = await this.prisma.role.findFirst({ where: { key: dto.key } });
      if (existingByKey) {
        throw new ConflictException('Role key already exists', [
          { field: 'key', reason: ErrorCodes.CONFLICT, message: 'A role with this key already exists' },
        ]);
      }
    }

    if (dto.name && dto.name !== role.name) {
      const existingByName = await this.prisma.role.findFirst({ where: { name: dto.name } });
      if (existingByName) {
        throw new ConflictException('Role name already exists', [
          { field: 'name', reason: ErrorCodes.CONFLICT, message: 'A role with this name already exists' },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.key) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.update',
        'Role',
        id,
        { key: role.key, name: role.name, description: role.description },
        { key: updatedRole.key, name: updatedRole.name, description: updatedRole.description },
      );
    }

    this.logger.log(`Role updated: ${id}`);
    return this.mapToResponse(updatedRole);
  }

  /**
   * Soft delete role. System roles + roles with active users are
   * blocked (existing logic, now with audit logging).
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system role', [
        { reason: ErrorCodes.FORBIDDEN, message: 'System roles cannot be deleted' },
      ]);
    }

    if (role._count.users > 0) {
      throw new ConflictException('Role has active users', [
        {
          reason: ErrorCodes.CONFLICT,
          message: `Cannot delete role with ${role._count.users} active user(s). Reassign users first.`,
        },
      ]);
    }

    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.delete',
        'Role',
        id,
        { key: role.key, name: role.name, description: role.description, isSystem: role.isSystem },
        undefined,
      );
    }

    this.logger.log(`Role soft deleted: ${id}`);
  }

  private mapToResponse(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description || undefined,
      isSystem: role.isSystem,
      userCount: role._count?.users ?? 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
