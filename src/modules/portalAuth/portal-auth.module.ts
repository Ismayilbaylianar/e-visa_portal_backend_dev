import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthService } from './portal-auth.service';
import { OtpModule } from '../otp/otp.module';
import { PortalSessionsModule } from '../portalSessions/portal-sessions.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [
    OtpModule,
    PortalSessionsModule,
    AuditLogsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_PORTAL_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_PORTAL_ACCESS_EXPIRATION_SECONDS', 3600),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PortalAuthController],
  providers: [PortalAuthService],
  exports: [PortalAuthService],
})
export class PortalAuthModule {}
