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
   * Get paginated list of users
   */
  async findAll(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

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

    const items = users.map(user => this.mapToResponse(user));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user by ID
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
   * Create new user
   */
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
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

    // Verify role exists if provided
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

    // Hash password
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

    this.logger.log(`User created: ${user.id} (${user.email})`);

    // Audit log
    await this.auditLogsService.logSystemAction('USER_CREATED', 'User', user.id, undefined, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
    });

    return this.mapToResponse(user);
  }

  /**
   * Update user
   */
  async update(id: string, dto: UpdateUserDto, actorUserId?: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    // Check email uniqueness if changing
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

    // Verify role exists if provided
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

    this.logger.log(`User updated: ${id}`);

    // Audit log
    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'USER_UPDATED',
        'User',
        id,
        { email: user.email, fullName: user.fullName, roleId: user.roleId },
        { email: updatedUser.email, fullName: updatedUser.fullName, roleId: updatedUser.roleId },
      );
    }

    return this.mapToResponse(updatedUser);
  }

  /**
   * Update user status
   */
  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorUserId?: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      include: { role: true },
    });

    // If deactivating, revoke all sessions
    if (!dto.isActive) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`All sessions revoked for deactivated user: ${id}`);
    }

    this.logger.log(`User status updated: ${id} -> isActive: ${dto.isActive}`);

    // Audit log
    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'USER_STATUS_CHANGED',
        'User',
        id,
        { isActive: user.isActive },
        { isActive: updatedUser.isActive },
      );
    }

    return this.mapToResponse(updatedUser);
  }

  /**
   * Soft delete user
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    // Soft delete user and revoke all sessions
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

    this.logger.log(`User soft deleted: ${id}`);

    // Audit log
    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'USER_DELETED',
        'User',
        id,
        { id: user.id, email: user.email, fullName: user.fullName },
        undefined,
      );
    }
  }

  /**
   * Map user entity to response DTO (excludes passwordHash)
   */
  private mapToResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId || undefined,
      roleKey: user.role?.key,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
