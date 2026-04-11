import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { PortalSessionsService } from '../portalSessions/portal-sessions.service';
import { SendOtpDto, VerifyOtpDto, PortalAuthResponseDto, SendOtpResponseDto } from './dto';
import { UnauthorizedException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { OtpPurpose } from '@prisma/client';
import * as crypto from 'crypto';

interface PortalJwtPayload {
  sub: string;
  email: string;
  type: 'portal_access' | 'portal_refresh';
}

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS: number;
  private readonly REFRESH_TOKEN_EXPIRY_SECONDS: number;
  private readonly isDevelopment: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly portalSessionsService: PortalSessionsService,
  ) {
    this.ACCESS_TOKEN_EXPIRY_SECONDS = this.configService.get<number>(
      'JWT_PORTAL_ACCESS_EXPIRATION_SECONDS',
      3600,
    );
    this.REFRESH_TOKEN_EXPIRY_SECONDS = this.configService.get<number>(
      'JWT_PORTAL_REFRESH_EXPIRATION_SECONDS',
      604800,
    );
    this.isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';
  }

  /**
   * Send OTP to the provided email address
   * In development mode, the OTP code is returned in the response for testing
   */
  async sendOtp(dto: SendOtpDto): Promise<SendOtpResponseDto> {
    const email = dto.email.toLowerCase().trim();
    this.logger.debug(`Send OTP request for email: ${email}`);

    // Generate OTP code
    const otpCode = this.generateOtpCode();
    const codeHash = this.hashCode(otpCode);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unused OTPs for this email
    await this.prisma.otpCode.updateMany({
      where: {
        email,
        purpose: OtpPurpose.LOGIN,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new OTP
    await this.prisma.otpCode.create({
      data: {
        email,
        codeHash,
        purpose: OtpPurpose.LOGIN,
        expiresAt,
      },
    });

    this.logger.log(`OTP generated for ${email}, expires at ${expiresAt.toISOString()}`);

    // In development mode, return the OTP code for testing
    // In production, this would be sent via email
    const response: SendOtpResponseDto = {
      message: 'OTP sent successfully',
      expiresAt,
    };

    if (this.isDevelopment) {
      response.devOtpCode = otpCode;
      this.logger.warn(`[DEV MODE] OTP code for ${email}: ${otpCode}`);
    }

    return response;
  }

  /**
   * Verify OTP and authenticate user
   * Creates portal identity if it doesn't exist
   */
  async verifyOtp(
    dto: VerifyOtpDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PortalAuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    this.logger.debug(`Verify OTP request for email: ${email}`);

    const codeHash = this.hashCode(dto.otpCode);

    // Find valid OTP
    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        email,
        codeHash,
        purpose: OtpPurpose.LOGIN,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid OTP code', [
        { reason: ErrorCodes.OTP_INVALID, message: 'The OTP code is invalid' },
      ]);
    }

    // Check if expired
    if (otpCode.expiresAt < new Date()) {
      throw new BadRequestException('OTP code has expired', [
        {
          reason: ErrorCodes.OTP_EXPIRED,
          message: 'The OTP code has expired. Please request a new one.',
        },
      ]);
    }

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { usedAt: new Date() },
    });

    // Find or create portal identity
    let portalIdentity = await this.prisma.portalIdentity.findUnique({
      where: { email },
    });

    if (!portalIdentity) {
      portalIdentity = await this.prisma.portalIdentity.create({
        data: {
          email,
          isActive: true,
          lastVerifiedAt: new Date(),
        },
      });
      this.logger.log(`New portal identity created: ${portalIdentity.id}`);
    } else {
      // Update last verified
      portalIdentity = await this.prisma.portalIdentity.update({
        where: { id: portalIdentity.id },
        data: { lastVerifiedAt: new Date() },
      });
    }

    // Check if identity is active
    if (!portalIdentity.isActive) {
      throw new UnauthorizedException('Account is inactive', [
        { reason: ErrorCodes.ACCOUNT_INACTIVE, message: 'Your account has been deactivated' },
      ]);
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(portalIdentity.id, email);

    // Create session
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await this.portalSessionsService.create({
      portalIdentityId: portalIdentity.id,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    });

    this.logger.log(`Portal identity authenticated: ${portalIdentity.id}`);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      portalIdentity: {
        id: portalIdentity.id,
        email: portalIdentity.email,
        isActive: portalIdentity.isActive,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<PortalAuthResponseDto> {
    this.logger.debug('Portal token refresh attempt');

    // Verify refresh token
    let payload: PortalJwtPayload;
    try {
      payload = this.jwtService.verify<PortalJwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_PORTAL_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token', [
        {
          reason: ErrorCodes.INVALID_TOKEN,
          message: 'The refresh token is invalid or has expired',
        },
      ]);
    }

    if (payload.type !== 'portal_refresh') {
      throw new UnauthorizedException('Invalid token type', [
        { reason: ErrorCodes.INVALID_TOKEN, message: 'Invalid token type' },
      ]);
    }

    // Find session by refresh token
    const session = await this.portalSessionsService.findByRefreshToken(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Session not found or expired', [
        {
          reason: ErrorCodes.SESSION_EXPIRED,
          message: 'Your session has expired. Please log in again.',
        },
      ]);
    }

    // Get portal identity
    const portalIdentity = await this.prisma.portalIdentity.findUnique({
      where: { id: payload.sub },
    });

    if (!portalIdentity || !portalIdentity.isActive) {
      throw new UnauthorizedException('Account not found or inactive', [
        { reason: ErrorCodes.ACCOUNT_INACTIVE, message: 'Your account is not available' },
      ]);
    }

    // Revoke old session
    await this.portalSessionsService.revoke(session.id);

    // Generate new tokens
    const tokens = await this.generateTokens(portalIdentity.id, portalIdentity.email);

    // Create new session
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await this.portalSessionsService.create({
      portalIdentityId: portalIdentity.id,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });

    this.logger.log(`Portal token refreshed for identity: ${portalIdentity.id}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      portalIdentity: {
        id: portalIdentity.id,
        email: portalIdentity.email,
        isActive: portalIdentity.isActive,
      },
    };
  }

  /**
   * Logout by revoking session with matching refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    this.logger.debug('Portal logout attempt');

    const session = await this.portalSessionsService.findByRefreshToken(refreshToken);
    if (session) {
      await this.portalSessionsService.revoke(session.id);
      this.logger.log(`Portal session revoked: ${session.id}`);
    }
  }

  /**
   * Validate access token and return portal identity
   */
  async validateAccessToken(token: string): Promise<{ id: string; email: string } | null> {
    try {
      const payload = this.jwtService.verify<PortalJwtPayload>(token, {
        secret: this.configService.get<string>('JWT_PORTAL_ACCESS_SECRET'),
      });

      if (payload.type !== 'portal_access') {
        return null;
      }

      const portalIdentity = await this.prisma.portalIdentity.findUnique({
        where: { id: payload.sub },
      });

      if (!portalIdentity || !portalIdentity.isActive) {
        return null;
      }

      return {
        id: portalIdentity.id,
        email: portalIdentity.email,
      };
    } catch {
      return null;
    }
  }

  private async generateTokens(
    portalIdentityId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: PortalJwtPayload = {
      sub: portalIdentityId,
      email,
      type: 'portal_access',
    };

    const refreshPayload: PortalJwtPayload = {
      sub: portalIdentityId,
      email,
      type: 'portal_refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('JWT_PORTAL_ACCESS_SECRET'),
        expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_PORTAL_REFRESH_SECRET'),
        expiresIn: this.REFRESH_TOKEN_EXPIRY_SECONDS,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateOtpCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += digits[crypto.randomInt(0, digits.length)];
    }
    return code;
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
