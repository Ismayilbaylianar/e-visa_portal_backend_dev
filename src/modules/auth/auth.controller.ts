import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  LogoutDto,
} from './dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckResetTokenResponseDto } from './dto/check-reset-token.dto';
import { Public, RateLimitAuthLogin, RateLimitAuthRefresh, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import type { AuthenticatedUser } from '@/common/types/request.type';

/**
 * M11.4 — refresh token cookie config. Single source of truth so
 * login/refresh/logout always set/clear the same cookie.
 *
 * Path is scoped to the auth namespace — limits cookie exposure to
 * the only endpoints that need it (less risk if XSS happens on
 * unrelated parts of the API).
 *
 * SameSite=Lax is required because the admin SPA + API are on
 * different subdomains (admin/evisaglobal.com → api.evisaglobal.com).
 * Strict would block the cookie cross-subdomain.
 */
const REFRESH_COOKIE_NAME = 'evisa_admin_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/admin/auth';
const REFRESH_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

function readRefreshCookie(req: Request): string | undefined {
  // No cookie-parser in this project — manual parse keeps the
  // dependency tree lean. Cookie header format: "k1=v1; k2=v2".
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const pair of raw.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

function setRefreshCookie(res: Response, token: string) {
  // Production runs behind nginx with HTTPS, so Secure must be true.
  // In local dev (NODE_ENV !== 'production') we drop Secure so
  // localhost http requests still receive the cookie.
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_S * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}

@ApiTags('Auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @RateLimitAuthLogin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate admin user with email and password. Returns JWT tokens. Rate limited to 10 requests per minute. M11.4: also sets the httpOnly `evisa_admin_refresh` cookie so hard refreshes restore the session via /admin/auth/refresh.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: 403,
    description: 'Account is inactive',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ipAddress, userAgent);
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('refresh')
  @Public()
  @RateLimitAuthRefresh()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Get new access token + rotated refresh token. M11.4: refresh token is read from the httpOnly cookie when the request body omits it; when present in the body the body wins (back-compat for older clients).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(req);
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required', [
        {
          field: 'refreshToken',
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'Refresh token must be supplied in the body or via the `evisa_admin_refresh` cookie.',
        },
      ]);
    }
    const result = await this.authService.refreshToken({ refreshToken });
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revoke the refresh token. M11.4: token is read from cookie OR body. The cookie is always cleared (Max-Age=0) so the browser drops it.',
  })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = dto?.refreshToken ?? readRefreshCookie(req);
    // Always clear the cookie even if no token is present — defensive,
    // makes the endpoint idempotent for the "user clicks logout twice"
    // case after their session was already revoked elsewhere.
    clearRefreshCookie(res);
    if (refreshToken) {
      await this.authService.logout({ refreshToken });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // M11.4 — Forgot / reset password (PART 3) + first-login change (PART 4)
  // ────────────────────────────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @RateLimitAuthLogin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email',
    description:
      'Always returns 200 to prevent email enumeration. If a user exists with the supplied email, a reset link is mailed via Resend. Token TTL: 1 hour, single-use, hashed in DB.',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(
      dto.email,
      this.extractIpAddress(req),
      req.headers['user-agent'],
    );
    return {
      message:
        'If an account exists with this email, you will receive a reset link shortly.',
    };
  }

  @Get('check-reset-token/:token')
  @Public()
  @ApiOperation({
    summary: 'Validate a password reset token without consuming it',
    description:
      'Frontend calls this on /admin/reset-password page load to decide whether to render the form or the "expired link" state.',
  })
  async checkResetToken(@Param('token') token: string): Promise<CheckResetTokenResponseDto> {
    return this.authService.checkResetToken(token);
  }

  @Post('reset-password')
  @Public()
  @RateLimitAuthLogin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a password reset',
    description:
      'Consumes the reset token and sets the new password. Side effect: revokes ALL existing refresh sessions for the user so any other open browser is forced back to login.',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.authService.completePasswordReset(
      dto.token,
      dto.newPassword,
      this.extractIpAddress(req),
      req.headers['user-agent'],
    );
    return {
      message:
        'Password has been reset. Please log in with your new password.',
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change the logged-in admin password',
    description:
      'Used by the first-login forced-change modal AND by future profile pages. When `mustChangePassword=true` on the user, `currentPassword` is not required (the user just authenticated with the seeded one). Otherwise `currentPassword` is mandatory and must match.',
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ user: { id: string; mustChangePassword: boolean } }> {
    return this.authService.changePassword(
      user.id,
      dto,
      this.extractIpAddress(req),
      req.headers['user-agent'],
    );
  }

  private extractIpAddress(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      return forwarded.split(',')[0].trim();
    }
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
