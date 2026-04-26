import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Trust proxy for correct IP detection behind Nginx
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new RequestIdInterceptor(), new TransformInterceptor());

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger setup
  const swaggerTitle = configService.get<string>('SWAGGER_TITLE', 'Visa Portal Backend API');
  const swaggerDescription = configService.get<string>(
    'SWAGGER_DESCRIPTION',
    'E-Visa Portal Backend API Documentation',
  );
  const swaggerVersion = configService.get<string>('SWAGGER_VERSION', '1.0.0');

  const swaggerConfig = new DocumentBuilder()
    .setTitle(swaggerTitle)
    .setDescription(swaggerDescription)
    .setVersion(swaggerVersion)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    // System
    .addTag('Health', 'System health check endpoints')
    // Admin Auth & Access Control
    .addTag('Auth', 'Admin authentication endpoints')
    .addTag('Sessions', 'Admin session management')
    .addTag('Users', 'User management endpoints')
    .addTag('Roles', 'Role management endpoints')
    .addTag('Permissions', 'Permission management endpoints')
    // Portal Auth
    .addTag('Portal Auth', 'Customer portal authentication')
    // Configuration
    .addTag('Countries', 'Country management endpoints')
    .addTag('Country Sections', 'Country section management')
    .addTag('Visa Types', 'Visa type management endpoints')
    .addTag('Templates', 'Form template management')
    .addTag('Template Sections', 'Template section management')
    .addTag('Template Fields', 'Template field management')
    .addTag('Template Bindings', 'Template binding management')
    .addTag('Binding Nationality Fees', 'Fee configuration by nationality')
    .addTag('Payment Page Config', 'Payment page configuration')
    .addTag('Email Templates', 'Email template management')
    .addTag('Settings', 'System settings management')
    // Public
    .addTag('Public Countries', 'Public country endpoints')
    .addTag('Public Visa Types', 'Public visa type endpoints')
    .addTag('Public Selection', 'Public selection and preview endpoints')
    .addTag('Tracking', 'Application tracking endpoints')
    // Application Domain
    .addTag('Applications Admin', 'Admin application management')
    .addTag('Applications Portal', 'Portal application management')
    .addTag('Applicants Portal', 'Portal applicant management')
    .addTag('Applicants Admin', 'Admin applicant management')
    .addTag('Form Renderer', 'Form schema endpoints')
    .addTag('Documents Portal', 'Portal document management')
    .addTag('Documents Admin', 'Admin document review')
    .addTag('Customer Portal', 'Customer portal endpoints')
    // Payments
    .addTag('Payments Admin', 'Admin payment management')
    .addTag('Payments Portal', 'Portal payment endpoints')
    .addTag('Payment Callbacks', 'Payment provider callbacks')
    // Admin Support
    .addTag('Dashboard', 'Admin dashboard endpoints')
    .addTag('Audit Logs', 'Audit log endpoints')
    .addTag('Jobs', 'Background job management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger documentation: http://localhost:${port}/docs`);
}

bootstrap();
