import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CountryPagesController } from './country-pages.controller';
import { CountryPagesService } from './country-pages.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
// M11.1 — public detail endpoint resolves image storage keys → URLs.
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    AuditLogsModule,
    StorageModule,
    // Country-page draft preview tokens reuse @nestjs/jwt with the
    // existing access secret. Mints short-lived tokens so an admin
    // can share a preview URL of an unpublished page.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [CountryPagesController],
  providers: [CountryPagesService],
  exports: [CountryPagesService],
})
export class CountryPagesModule {}
