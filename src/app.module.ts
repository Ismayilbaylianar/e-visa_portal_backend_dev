import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { dbConfig } from './config/db.config';
import { swaggerConfig } from './config/swagger.config';

// Core modules
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

// Feature modules (skeletons)
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, swaggerConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // Core modules
    PrismaModule,
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
  ],
})
export class AppModule {}
