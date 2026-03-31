import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PortalAuthService } from './portal-auth.service';
import { SendOtpDto, VerifyOtpDto, PortalAuthResponseDto } from './dto';
import { Public, CurrentPortalIdentity } from '@/common/decorators';
import { PortalIdentityUser } from '@/common/types';
import { RefreshTokenDto } from '../auth/dto';

@ApiTags('Portal Auth')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('sendOtp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP',
    description: 'Send OTP code to the provided email address for portal authentication',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP sent successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email or rate limit exceeded',
  })
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ message: string }> {
    return this.portalAuthService.sendOtp(dto);
  }

  @Post('verifyOtp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verify OTP code and authenticate portal user',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: PortalAuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request): Promise<PortalAuthResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.portalAuthService.verifyOtp(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: PortalAuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<PortalAuthResponseDto> {
    return this.portalAuthService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke current session and logout from portal',
  })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async logout(@CurrentPortalIdentity() identity: PortalIdentityUser): Promise<void> {
    await this.portalAuthService.logout(identity.id);
  }
}
