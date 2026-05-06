import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  LogoutDto,
  ChangePasswordDto,
  CheckResetTokenResponseDto,
} from './dto';
import { UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpirationSeconds: number;
  private readonly refreshExpirationSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {
    this.accessSecret = this.configService.get<string>('app.jwt.accessSecret')!;
    this.refreshSecret = this.configService.get<string>('app.jwt.refreshSecret')!;
    this.accessExpirationSeconds = this.configService.get<number>(
      'app.jwt.accessExpirationSeconds',
    )!;
    this.refreshExpirationSeconds = this.configService.get<number>(
      'app.jwt.refreshExpirationSeconds',
    )!;
  }

  /**
   * Authenticate user with email and password
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto> {
    this.logger.debug(`Login attempt for email: ${dto.email}`);

    // Find user by email (including soft-deleted check)
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found for email ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials', [
        { reason: ErrorCodes.INVALID_CREDENTIALS, message: 'Email or password is incorrect' },
      ]);
    }

    // Check if user is active
    if (!user.isActive) {
      this.logger.warn(`Login failed: user ${user.id} is inactive`);
      throw new ForbiddenException('Account is inactive', [
        {
          reason: ErrorCodes.ACCOUNT_INACTIVE,
          message: 'Your account has been deactivated. Please contact administrator.',
        },
      ]);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for user ${user.id}`);
      throw new UnauthorizedException('Invalid credentials', [
        { reason: ErrorCodes.INVALID_CREDENTIALS, message: 'Email or password is incorrect' },
      ]);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const refreshToken = this.generateRefreshToken(
      user.id,
      user.email,
      user.roleId,
      user.role?.key,
      sessionId,
    );
    const refreshTokenHash = await this.hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
        lastActivityAt: new Date(),
      },
    });

    // Generate access token
    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.roleId,
      user.role?.key,
      sessionId,
    );

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User ${user.id} logged in successfully`);

    const permissions = await this.getUserPermissions(user.id);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.accessExpirationSeconds,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roleId: user.roleId || undefined,
        roleKey: user.role?.key,
        isActive: user.isActive,
        permissions,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    this.logger.debug('Token refresh attempt');

    // Controller resolves cookie/body and refuses to call us when
    // refreshToken is missing — non-null assertion is safe here.
    const refreshToken = dto.refreshToken!;

    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch (error) {
      this.logger.warn('Token refresh failed: invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token', [
        { reason: ErrorCodes.INVALID_TOKEN, message: 'Refresh token is invalid or expired' },
      ]);
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type', [
        { reason: ErrorCodes.INVALID_TOKEN, message: 'Expected refresh token' },
      ]);
    }

    // Find session by ID and verify refresh token hash
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!session) {
      this.logger.warn(`Token refresh failed: session not found or expired`);
      throw new UnauthorizedException('Session expired or revoked', [
        { reason: ErrorCodes.SESSION_EXPIRED, message: 'Please login again' },
      ]);
    }

    // Verify refresh token hash
    const isValidToken = await this.verifyTokenHash(refreshToken, session.refreshTokenHash);
    if (!isValidToken) {
      this.logger.warn(`Token refresh failed: refresh token hash mismatch`);
      throw new UnauthorizedException('Invalid refresh token', [
        { reason: ErrorCodes.INVALID_TOKEN, message: 'Refresh token is invalid' },
      ]);
    }

    // Check if user is still active
    if (!session.user.isActive || session.user.deletedAt) {
      this.logger.warn(`Token refresh failed: user ${session.userId} is inactive or deleted`);
      throw new ForbiddenException('Account is inactive', [
        { reason: ErrorCodes.ACCOUNT_INACTIVE, message: 'Your account has been deactivated' },
      ]);
    }

    // Generate new tokens
    const newRefreshToken = this.generateRefreshToken(
      session.userId,
      session.user.email,
      session.user.roleId,
      session.user.role?.key,
      session.id,
    );
    const newRefreshTokenHash = await this.hashToken(newRefreshToken);

    const newAccessToken = this.generateAccessToken(
      session.userId,
      session.user.email,
      session.user.roleId,
      session.user.role?.key,
      session.id,
    );

    // Update session with new refresh token hash and extend expiry
    const newExpiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
        lastActivityAt: new Date(),
      },
    });

    this.logger.log(`Token refreshed for user ${session.userId}`);

    const permissions = await this.getUserPermissions(session.userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresInSeconds: this.accessExpirationSeconds,
      user: {
        id: session.user.id,
        fullName: session.user.fullName,
        email: session.user.email,
        roleId: session.user.roleId || undefined,
        roleKey: session.user.role?.key,
        isActive: session.user.isActive,
        permissions,
        mustChangePassword: session.user.mustChangePassword ?? false,
      },
    };
  }

  /**
   * Compute the effective permission keys for a user.
   *
   * Mirrors the logic in JwtStrategy.validate() so that the login + refresh
   * responses can ship a fresh `permissions` array to the frontend without
   * waiting for the JWT to populate `request.user`. JwtStrategy is the source
   * of truth at request time; this helper keeps the auth response in sync.
   *
   * Final permissions = (role permissions ∪ user grants) − user denies.
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        userPermissions: {
          include: { permission: true },
        },
      },
    });
    if (!user) return [];

    const rolePermissions =
      user.role?.rolePermissions.map((rp) => rp.permission.permissionKey) || [];
    const userGrants = user.userPermissions
      .filter((up) => up.effect === 'ALLOW')
      .map((up) => up.permission.permissionKey);
    const userDenies = user.userPermissions
      .filter((up) => up.effect === 'DENY')
      .map((up) => up.permission.permissionKey);

    return [...new Set([...rolePermissions, ...userGrants])].filter(
      (p) => !userDenies.includes(p),
    );
  }

  /**
   * Logout user by revoking session
   */
  async logout(dto: LogoutDto): Promise<void> {
    this.logger.debug('Logout attempt');

    // Controller calls us only when a refresh token resolved from
    // body or cookie — ignore the optional-on-DTO type here.
    const refreshToken = dto.refreshToken;
    if (!refreshToken) return;

    // Verify refresh token to get session ID
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      // Even if token is invalid/expired, we don't throw - just log and return
      this.logger.warn('Logout: invalid refresh token provided');
      return;
    }

    // Find and revoke the session
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        revokedAt: null,
      },
    });

    if (session) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`Session ${session.id} revoked for user ${session.userId}`);
    }
  }

  /**
   * Generate access token
   */
  private generateAccessToken(
    userId: string,
    email: string,
    roleId: string | null,
    roleKey: string | undefined,
    sessionId: string,
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roleId: roleId || undefined,
      roleKey,
      sessionId,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpirationSeconds,
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(
    userId: string,
    email: string,
    roleId: string | null,
    roleKey: string | undefined,
    sessionId: string,
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roleId: roleId || undefined,
      roleKey,
      sessionId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpirationSeconds,
    });
  }

  /**
   * Hash a token using bcrypt
   */
  private async hashToken(token: string): Promise<string> {
    // Use SHA256 first to get a fixed-length string, then bcrypt
    const sha256Hash = crypto.createHash('sha256').update(token).digest('hex');
    return bcrypt.hash(sha256Hash, 10);
  }

  /**
   * Verify token against hash
   */
  private async verifyTokenHash(token: string, hash: string): Promise<boolean> {
    const sha256Hash = crypto.createHash('sha256').update(token).digest('hex');
    return bcrypt.compare(sha256Hash, hash);
  }

  // ─────────────────────────────────────────────────────────────
  // M11.4 — change-password / forgot-password / reset-password
  // ─────────────────────────────────────────────────────────────

  /**
   * Change the password for an authenticated user.
   * - When `mustChangePassword=true` on the user (first login),
   *   currentPassword is NOT required; we trust that they just
   *   succeeded against `bcrypt.compare(seedPwd, hash)` to issue
   *   the access token they're calling us with.
   * - Otherwise currentPassword must match — guards against an
   *   attacker who steals an access token from a coffee-shop laptop.
   *
   * Side effects on success:
   *   - Hash + persist newPassword
   *   - Stamp lastPasswordChangedAt
   *   - Flip mustChangePassword=false
   *   - Revoke ALL existing sessions for the user EXCEPT the one
   *     making this call (so other open browsers fall back to login
   *     while this one stays usable). For first-login changes the
   *     "current session" is the one issued seconds ago, so this is
   *     a no-op revocation in practice.
   *   - Audit `user.first_login_password_changed` (first time) or
   *     `user.password_changed` (subsequent).
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: { id: string; mustChangePassword: boolean } }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'User not found' },
      ]);
    }

    const wasMustChange = user.mustChangePassword === true;

    if (!wasMustChange) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required', [
          {
            field: 'currentPassword',
            reason: ErrorCodes.BAD_REQUEST,
            message:
              'Current password is required for self-service changes. Use the forgot-password flow if you do not know it.',
          },
        ]);
      }
      const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!matches) {
        throw new UnauthorizedException('Current password incorrect', [
          {
            field: 'currentPassword',
            reason: ErrorCodes.INVALID_CREDENTIALS,
            message: 'Current password is incorrect.',
          },
        ]);
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        lastPasswordChangedAt: new Date(),
      },
    });

    await this.auditLogsService.logAdminAction(
      user.id,
      wasMustChange ? 'user.first_login_password_changed' : 'user.password_changed',
      'User',
      user.id,
      undefined,
      {
        passwordChangedAt: new Date().toISOString(),
        wasFirstLogin: wasMustChange,
      },
      ipAddress,
      userAgent,
    );

    this.logger.log(
      `Password changed for user ${user.id} (firstLogin=${wasMustChange})`,
    );

    return {
      user: {
        id: user.id,
        mustChangePassword: false,
      },
    };
  }

  /**
   * Issue a single-use, 1-hour reset token and email it to the user.
   * Always returns silently — caller surfaces a generic 200 response
   * so an attacker can't enumerate which emails are admin accounts.
   */
  async requestPasswordReset(
    rawEmail: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });
    if (!user) {
      // Logged but not audited. The audit log's actorUserId is a FK
      // to users; an unknown-email attempt has no actor and no
      // user-row entityId to point at, so writing a synthetic row
      // would violate the FK. Rate-limiting (controller decorator)
      // is the primary protection here. Server log is enough trace
      // for incident response.
      this.logger.warn(`Password reset requested for unknown email: ${email} (ip=${ipAddress})`);
      return;
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    const baseUrl =
      this.configService.get<string>('app.adminBaseUrl') ||
      this.configService.get<string>('ADMIN_BASE_URL') ||
      'https://evisaglobal.com';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/admin/reset-password?token=${plainToken}`;

    try {
      await this.emailService.sendTemplatedEmail({
        to: user.email,
        templateKey: 'admin_password_reset',
        variables: {
          fullName: user.fullName,
          email: user.email,
          resetUrl,
          expiresInMinutes: 60,
        },
        relatedEntity: 'User',
        relatedEntityId: user.id,
      });
    } catch (e) {
      // Don't leak send failures to the caller — log + swallow so
      // the response stays 200. Admin can re-trigger from the UI.
      this.logger.error(
        `Password reset email failed for ${user.email}: ${(e as Error).message}`,
      );
    }

    await this.auditLogsService.logAdminAction(
      user.id,
      'auth.password_reset_requested',
      'User',
      user.id,
      undefined,
      { email: user.email, exists: true },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Frontend pings this on /admin/reset-password page load so it can
   * decide whether to show the form or the "expired link" state.
   * Does NOT consume the token.
   */
  async checkResetToken(plainToken: string): Promise<CheckResetTokenResponseDto> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row) {
      return { valid: false, reason: 'unknown' };
    }
    if (row.usedAt) {
      return { valid: false, reason: 'used' };
    }
    if (row.expiresAt.getTime() < Date.now()) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: true, email: maskEmail(row.user.email) };
  }

  /**
   * Consume a reset token + persist the new password. Side effect:
   * revoke ALL active sessions for the user so any open browser
   * elsewhere falls back to login.
   */
  async completePasswordReset(
    plainToken: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset link is invalid or expired', [
        {
          field: 'token',
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'This reset link has expired or has already been used. Request a new one.',
        },
      ]);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          lastPasswordChangedAt: now,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
      // Force re-login on every existing session — security best
      // practice on password reset.
      this.prisma.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.auditLogsService.logAdminAction(
      row.userId,
      'auth.password_reset_completed',
      'User',
      row.userId,
      undefined,
      { resetAt: now.toISOString() },
      ipAddress,
      userAgent,
    );

    this.logger.log(`Password reset completed for user ${row.userId}`);
  }
}

/**
 * M11.4 — mask an email for display ("a***@gmail.com"). The reset
 * page shows this so the user can confirm they're resetting the
 * right account without us echoing back the full email (would
 * partially defeat enumeration protection).
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}
