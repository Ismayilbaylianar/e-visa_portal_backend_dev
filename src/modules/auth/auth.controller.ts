import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  LogoutDto,
} from './dto';
import { Public, RateLimitAuthLogin, RateLimitAuthRefresh } from '@/common/decorators';

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
      'Authenticate admin user with email and password. Returns JWT tokens. Rate limited to 10 requests per minute.',
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
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @Public()
  @RateLimitAuthRefresh()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token and refresh token using a valid refresh token.',
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
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke the session associated with the provided refresh token.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout(dto);
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
