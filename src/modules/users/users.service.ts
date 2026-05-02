import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserResponseDto,
  UserListResponseDto,
  GetUsersQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { isSuperAdminRole } from '../accessControl/system-protection.constants';

/**
 * Module 6 — Admin Users service.
 *
 * Audit action keys are lowercase.dot to match the convention adopted
 * across Modules 1–5 (`country.update`, `visaType.create`, etc.). The
 * earlier UPPERCASE_SNAKE keys (`USER_CREATED`) were inconsistent and
 * broke audit log filters that group by `user.*`.
 *
 * System protection (Modul 6 D2 — all sharp):
 *   • Super admin user cannot be deleted, deactivated, or have its
 *     role changed (would break god-mode).
 *   • Self-modify is blocked for delete + status changes (lock-out
 *     prevention; admin can still PATCH their own profile fields).
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly bcryptSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.bcryptSaltRounds = this.configService.get<number>('app.bcrypt.saltRounds') || 12;
  }

  /**
   * Get paginated list of users.
   */
  async findAll(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.roleId) where.roleId = query.roleId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { role: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => this.mapToResponse(user));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get user by ID.
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(user);
  }

  /**
   * Create new user.
   */
  async create(dto: CreateUserDto, actorUserId?: string): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use', [
        {
          field: 'email',
          reason: ErrorCodes.CONFLICT,
          message: 'A user with this email already exists',
        },
      ]);
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, deletedAt: null },
      });
      if (!role) {
        throw new NotFoundException('Role not found', [
          {
            field: 'roleId',
            reason: ErrorCodes.ROLE_NOT_FOUND,
            message: 'The specified role does not exist',
          },
        ]);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash,
        roleId: dto.roleId,
        isActive: dto.isActive ?? true,
      },
      include: { role: true },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'user.create',
        'User',
        user.id,
        undefined,
        {
          email: user.email,
          fullName: user.fullName,
          roleId: user.roleId,
          roleKey: user.role?.key,
          isActive: user.isActive,
        },
      );
    }

    this.logger.log(`User created: ${user.id} (${user.email})`);
    return this.mapToResponse(user);
  }

  /**
   * Update user.
   *
   * Super admin protection: blocks role change on a super admin account
   * — would silently demote god-mode and could lock the org out of the
   * UAM screens entirely.
   */
  async update(id: string, dto: UpdateUserDto, actorUserId?: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    // Super admin role change guard — admin cannot demote a super admin
    // to operator and lock the org out of UAM controls.
    if (
      dto.roleId !== undefined &&
      dto.roleId !== user.roleId &&
      isSuperAdminRole(user.role?.key)
    ) {
      throw new ConflictException('Super admin role cannot be changed', [
        {
          field: 'roleId',
          reason: ErrorCodes.CONFLICT,
          message:
            'The super admin user role is locked. Demoting it would lock the org out of access management.',
        },
      ]);
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase() },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use', [
          {
            field: 'email',
            reason: ErrorCodes.CONFLICT,
            message: 'A user with this email already exists',
          },
        ]);
      }
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, deletedAt: null },
      });
      if (!role) {
        throw new NotFoundException('Role not found', [
          {
            field: 'roleId',
            reason: ErrorCodes.ROLE_NOT_FOUND,
            message: 'The specified role does not exist',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.fullName) updateData.fullName = dto.fullName;
    if (dto.email) updateData.email = dto.email.toLowerCase();
    if (dto.roleId !== undefined) updateData.roleId = dto.roleId;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'user.update',
        'User',
        id,
        { email: user.email, fullName: user.fullName, roleId: user.roleId, roleKey: user.role?.key },
        {
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          roleId: updatedUser.roleId,
          roleKey: updatedUser.role?.key,
        },
      );
    }

    this.logger.log(`User updated: ${id}`);
    return this.mapToResponse(updatedUser);
  }

  /**
   * Update user status (active / inactive).
   *
   * Blocks:
   *   • Deactivating the super admin (god-mode loss).
   *   • Self-deactivation (admin can't lock themselves out).
   */
  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorUserId?: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    // Self-deactivation guard — but allow self-activation (no harm in
    // re-enabling yourself, and the admin would already be locked out
    // if they were inactive in the first place).
    if (dto.isActive === false && actorUserId === id) {
      throw new ConflictException('Cannot deactivate your own account', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message:
            'You cannot deactivate your own account. Ask another administrator to perform this action.',
        },
      ]);
    }

    // Super admin deactivation guard.
    if (dto.isActive === false && isSuperAdminRole(user.role?.key)) {
      throw new ConflictException('Cannot deactivate super admin', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message:
            'The super admin user is protected from deactivation. Deactivating it would lock the org out of access management.',
        },
      ]);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      include: { role: true },
    });

    if (!dto.isActive) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`All sessions revoked for deactivated user: ${id}`);
    }

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'user.status.change',
        'User',
        id,
        { isActive: user.isActive },
        { isActive: updatedUser.isActive },
      );
    }

    this.logger.log(`User status updated: ${id} -> isActive: ${dto.isActive}`);
    return this.mapToResponse(updatedUser);
  }

  /**
   * Soft delete user.
   *
   * Blocks:
   *   • Deleting the super admin user.
   *   • Self-deletion (lock-out prevention).
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    if (actorUserId === id) {
      throw new ConflictException('Cannot delete your own account', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message:
            'You cannot delete your own account. Ask another administrator to perform this action.',
        },
      ]);
    }

    if (isSuperAdminRole(user.role?.key)) {
      throw new ConflictException('Cannot delete super admin', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message:
            'The super admin user is protected from deletion. Deleting it would lock the org out of access management.',
        },
      ]);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'user.delete',
        'User',
        id,
        {
          email: user.email,
          fullName: user.fullName,
          roleId: user.roleId,
          roleKey: user.role?.key,
        },
        undefined,
      );
    }

    this.logger.log(`User soft deleted: ${id}`);
  }

  /**
   * Map user entity to response DTO (excludes passwordHash). Surfaces
   * `roleName` so the admin UI doesn't need a second fetch to render
   * the role badge label.
   */
  private mapToResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId || undefined,
      roleKey: user.role?.key,
      roleName: user.role?.name,
      isSuperAdmin: isSuperAdminRole(user.role?.key),
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
