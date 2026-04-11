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
} from './dto';
import { UnauthorizedException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { JwtPayload } from './strategies/jwt.strategy';

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
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    this.logger.debug('Token refresh attempt');

    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
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
    const isValidToken = await this.verifyTokenHash(dto.refreshToken, session.refreshTokenHash);
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

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresInSeconds: this.accessExpirationSeconds,
    };
  }

  /**
   * Logout user by revoking session
   */
  async logout(dto: LogoutDto): Promise<void> {
    this.logger.debug('Logout attempt');

    // Verify refresh token to get session ID
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
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
}
