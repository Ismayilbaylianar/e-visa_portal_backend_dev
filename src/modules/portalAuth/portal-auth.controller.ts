import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PortalAuthService } from './portal-auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshPortalTokenDto,
  LogoutPortalDto,
  PortalAuthResponseDto,
  SendOtpResponseDto,
} from './dto';
import { Public, RateLimitOtpSend, RateLimitOtpVerify, RateLimitAuthRefresh } from '@/common/decorators';

@ApiTags('Portal Auth')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('sendOtp')
  @Public()
  @RateLimitOtpSend()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP',
    description:
      'Send OTP code to the provided email address for portal authentication. In development mode, the OTP code is returned in the response. Rate limited to 5 requests per minute.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: SendOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: Request): Promise<SendOtpResponseDto> {
    const ipAddress = this.extractIpAddress(req);
    return this.portalAuthService.sendOtp(dto, ipAddress);
  }

  @Post('verifyOtp')
  @Public()
  @RateLimitOtpVerify()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify OTP code and authenticate portal user. Creates portal identity if it does not exist. Rate limited to 10 requests per minute.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully, returns access and refresh tokens',
    type: PortalAuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP (otpInvalid, otpExpired)',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request): Promise<PortalAuthResponseDto> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = req.headers['user-agent'];
    return this.portalAuthService.verifyOtp(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @Public()
  @RateLimitAuthRefresh()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access and refresh tokens using the current refresh token',
  })
  @ApiBody({ type: RefreshPortalTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: PortalAuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() dto: RefreshPortalTokenDto): Promise<PortalAuthResponseDto> {
    return this.portalAuthService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke the session associated with the provided refresh token',
  })
  @ApiBody({ type: LogoutPortalDto })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  async logout(@Body() dto: LogoutPortalDto): Promise<void> {
    await this.portalAuthService.logout(dto.refreshToken);
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
