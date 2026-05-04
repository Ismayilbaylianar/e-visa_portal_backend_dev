import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { appConfig } from './config/app.config';
import { dbConfig } from './config/db.config';
import { swaggerConfig } from './config/swagger.config';
import { ThrottlerBehindProxyGuard } from './common/guards';

// Core modules
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

// Auth & Access Control modules
import { AuthModule } from './modules/auth/auth.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { AccessControlModule } from './modules/accessControl/access-control.module';

// Portal Auth modules
import { PortalAuthModule } from './modules/portalAuth/portal-auth.module';
import { PortalSessionsModule } from './modules/portalSessions/portal-sessions.module';
import { OtpModule } from './modules/otp/otp.module';

// Configuration modules
import { CountriesModule } from './modules/countries/countries.module';
import { CountryPagesModule } from './modules/countryPages/country-pages.module';
import { CountrySectionsModule } from './modules/countrySections/country-sections.module';
import { VisaTypesModule } from './modules/visaTypes/visa-types.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { TemplateSectionsModule } from './modules/templateSections/template-sections.module';
import { TemplateFieldsModule } from './modules/templateFields/template-fields.module';
import { TemplateBindingsModule } from './modules/templateBindings/template-bindings.module';
import { BindingNationalityFeesModule } from './modules/bindingNationalityFees/binding-nationality-fees.module';
import { PaymentPageConfigsModule } from './modules/paymentPageConfigs/payment-page-configs.module';
import { EmailTemplatesModule } from './modules/emailTemplates/email-templates.module';
import { SettingsModule } from './modules/settings/settings.module';

// Public modules
import { PublicSelectionModule } from './modules/publicSelection/public-selection.module';
import { TrackingModule } from './modules/tracking/tracking.module';

// Application domain modules
import { ApplicationsModule } from './modules/applications/applications.module';
import { ApplicantsModule } from './modules/applicants/applicants.module';
import { FormRendererModule } from './modules/formRenderer/form-renderer.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CustomerPortalModule } from './modules/customerPortal/customer-portal.module';
import { StatusWorkflowModule } from './modules/statusWorkflow/status-workflow.module';

// Payment modules
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentTransactionsModule } from './modules/paymentTransactions/payment-transactions.module';

// Support modules
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AuditLogsModule } from './modules/auditLogs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GeoLookupModule } from './modules/geoLookup/geo-lookup.module';
import { EmailModule } from './modules/email/email.module';
import { StorageModule } from './modules/storage/storage.module';

// M11.B — Content Management
import { ContentPagesModule } from './modules/contentPages/content-pages.module';
import { ContactInfoModule } from './modules/contactInfo/contact-info.module';
import { FaqItemsModule } from './modules/faqItems/faq-items.module';

// M11.1 — Country page hero images + homepage carousel slides
import { CountryPageImagesModule } from './modules/countryPageImages/country-page-images.module';
import { HomepageSlidesModule } from './modules/homepageSlides/homepage-slides.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, swaggerConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
        errorMessage: 'Too many requests. Please try again later.',
      }),
    }),

    // Core modules
    PrismaModule,
    HealthModule,

    // Auth & Access Control
    AuthModule,
    SessionsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AccessControlModule,

    // Portal Auth
    PortalAuthModule,
    PortalSessionsModule,
    OtpModule,

    // Configuration
    CountriesModule,
    CountryPagesModule,
    CountrySectionsModule,
    VisaTypesModule,
    TemplatesModule,
    TemplateSectionsModule,
    TemplateFieldsModule,
    TemplateBindingsModule,
    BindingNationalityFeesModule,
    PaymentPageConfigsModule,
    EmailTemplatesModule,
    SettingsModule,

    // Public
    PublicSelectionModule,
    TrackingModule,

    // Application domain
    ApplicationsModule,
    ApplicantsModule,
    FormRendererModule,
    DocumentsModule,
    CustomerPortalModule,
    StatusWorkflowModule,

    // Payments
    PaymentsModule,
    PaymentTransactionsModule,

    // Support
    NotificationsModule,
    JobsModule,
    AuditLogsModule,
    DashboardModule,
    GeoLookupModule,

    // Email Infrastructure
    EmailModule.forRoot(),

    // Storage Infrastructure
    StorageModule,

    // M11.B — Content Management (CMS)
    ContentPagesModule,
    ContactInfoModule,
    FaqItemsModule,

    // M11.1 — Carousel + country page images
    CountryPageImagesModule,
    HomepageSlidesModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
