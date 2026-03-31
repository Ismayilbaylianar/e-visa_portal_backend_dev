import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpPurpose } from '@prisma/client';
import { OtpResponseDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly OTP_LENGTH = 6;

  constructor(private readonly prisma: PrismaService) {}

  async generate(email: string, purpose: OtpPurpose): Promise<OtpResponseDto> {
    await this.invalidate(email, purpose);

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        email: email.toLowerCase(),
        codeHash,
        purpose,
        expiresAt,
      },
    });

    this.logger.log(`OTP generated for ${email} with purpose ${purpose}`);

    return {
      success: true,
      expiresAt,
    };
  }

  async verify(email: string, code: string, purpose: OtpPurpose): Promise<OtpResponseDto> {
    const codeHash = this.hashCode(code);

    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        email: email.toLowerCase(),
        codeHash,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpCode) {
      this.logger.warn(`Invalid OTP verification attempt for ${email}`);
      return { success: false };
    }

    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { usedAt: new Date() },
    });

    this.logger.log(`OTP verified for ${email} with purpose ${purpose}`);
    return { success: true };
  }

  async invalidate(email: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: {
        email: email.toLowerCase(),
        purpose,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    this.logger.debug(`Invalidated existing OTPs for ${email} with purpose ${purpose}`);
  }

  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      code += digits[crypto.randomInt(0, digits.length)];
    }
    return code;
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  getGeneratedCode(): string {
    return this.generateCode();
  }

  hashOtpCode(code: string): string {
    return this.hashCode(code);
  }
}
