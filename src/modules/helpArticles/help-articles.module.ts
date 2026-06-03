import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HelpArticlesAdminController } from './help-articles.controller';
import { HelpArticlesService } from './help-articles.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

/**
 * M11.15 (HELP) — operator help / training module.
 *
 * JwtModule is registered here without a global secret so the help
 * service can sign + verify its own scope-limited tokens via
 * `jwt.sign(payload, { secret: HELP_VIDEO_JWT_SECRET, expiresIn: ... })`
 * — the auth module's main JWT secret stays untouched.
 */
@Module({
  imports: [PrismaModule, StorageModule, AuditLogsModule, JwtModule.register({})],
  controllers: [HelpArticlesAdminController],
  providers: [HelpArticlesService],
})
export class HelpArticlesModule {}
