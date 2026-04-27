import { PrismaClient, PermissionEffect, VisaEntryType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

interface IsoCountry {
  isoCode: string;
  name: string;
  flagEmoji: string;
  continentCode: string;
  region: string;
}

const prisma = new PrismaClient();

// Default permissions to seed
const PERMISSIONS = [
  // Users module
  { moduleKey: 'users', actionKey: 'read', description: 'View users list and details' },
  { moduleKey: 'users', actionKey: 'create', description: 'Create new users' },
  { moduleKey: 'users', actionKey: 'update', description: 'Update user information' },
  { moduleKey: 'users', actionKey: 'delete', description: 'Delete users (soft delete)' },
  
  // Roles module
  { moduleKey: 'roles', actionKey: 'read', description: 'View roles list and details' },
  { moduleKey: 'roles', actionKey: 'create', description: 'Create new roles' },
  { moduleKey: 'roles', actionKey: 'update', description: 'Update role information' },
  { moduleKey: 'roles', actionKey: 'delete', description: 'Delete roles (soft delete)' },
  
  // Permissions module
  { moduleKey: 'permissions', actionKey: 'read', description: 'View permissions and matrix' },
  { moduleKey: 'permissions', actionKey: 'update', description: 'Update role/user permissions' },
  
  // Sessions module
  { moduleKey: 'sessions', actionKey: 'read', description: 'View active sessions' },
  { moduleKey: 'sessions', actionKey: 'delete', description: 'Revoke sessions' },
  
  // Countries module (reference data — read + limited admin override)
  { moduleKey: 'countries', actionKey: 'read', description: 'View countries reference data' },
  { moduleKey: 'countries', actionKey: 'update', description: 'Override flag/region/active flags on a country reference row' },

  // Country Pages module (publishable marketing content per country)
  { moduleKey: 'countryPages', actionKey: 'read', description: 'View country pages' },
  { moduleKey: 'countryPages', actionKey: 'create', description: 'Create country pages' },
  { moduleKey: 'countryPages', actionKey: 'update', description: 'Update country pages and their sections' },
  { moduleKey: 'countryPages', actionKey: 'delete', description: 'Delete country pages and cascade their sections' },
  
  // Visa Types module
  { moduleKey: 'visaTypes', actionKey: 'read', description: 'View visa types' },
  { moduleKey: 'visaTypes', actionKey: 'create', description: 'Create visa types' },
  { moduleKey: 'visaTypes', actionKey: 'update', description: 'Update visa types' },
  { moduleKey: 'visaTypes', actionKey: 'delete', description: 'Delete visa types' },
  
  // Settings module
  { moduleKey: 'settings', actionKey: 'read', description: 'View system settings' },
  { moduleKey: 'settings', actionKey: 'update', description: 'Update system settings' },
  
  // Email Templates module
  { moduleKey: 'emailTemplates', actionKey: 'read', description: 'View email templates' },
  { moduleKey: 'emailTemplates', actionKey: 'create', description: 'Create email templates' },
  { moduleKey: 'emailTemplates', actionKey: 'update', description: 'Update email templates' },
  { moduleKey: 'emailTemplates', actionKey: 'delete', description: 'Delete email templates' },
  
  // Payment Page Configs module
  { moduleKey: 'paymentPageConfigs', actionKey: 'read', description: 'View payment page config' },
  { moduleKey: 'paymentPageConfigs', actionKey: 'update', description: 'Update payment page config' },
  
  // Templates module
  { moduleKey: 'templates', actionKey: 'read', description: 'View templates' },
  { moduleKey: 'templates', actionKey: 'create', description: 'Create templates' },
  { moduleKey: 'templates', actionKey: 'update', description: 'Update templates' },
  { moduleKey: 'templates', actionKey: 'delete', description: 'Delete templates' },
  
  // Template Bindings module
  { moduleKey: 'templateBindings', actionKey: 'read', description: 'View template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'create', description: 'Create template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'update', description: 'Update template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'delete', description: 'Delete template bindings and nationality fees' },
  
  // Applications module (for future use)
  { moduleKey: 'applications', actionKey: 'read', description: 'View applications' },
  { moduleKey: 'applications', actionKey: 'update', description: 'Update application status' },
  { moduleKey: 'applications', actionKey: 'review', description: 'Review and process applications' },
  
  // Payments module
  { moduleKey: 'payments', actionKey: 'read', description: 'View payments and transactions' },
  { moduleKey: 'payments', actionKey: 'update', description: 'Update payment status manually' },
  { moduleKey: 'payments', actionKey: 'refund', description: 'Process refunds' },
  { moduleKey: 'payments', actionKey: 'manage', description: 'Full payment management access' },
  
  // Notifications module
  { moduleKey: 'notifications', actionKey: 'read', description: 'View notifications' },
  { moduleKey: 'notifications', actionKey: 'update', description: 'Retry notifications' },
  
  // Jobs module
  { moduleKey: 'jobs', actionKey: 'read', description: 'View background jobs' },
  { moduleKey: 'jobs', actionKey: 'update', description: 'Retry or cancel jobs' },
  
  // Audit Logs module
  { moduleKey: 'auditLogs', actionKey: 'read', description: 'View audit logs' },
  
  // Dashboard module
  { moduleKey: 'dashboard', actionKey: 'read', description: 'View dashboard statistics' },
];

// Role definitions with their permissions
const ROLES = [
  {
    name: 'Super Admin',
    key: 'superAdmin',
    description: 'Full system access with all permissions',
    isSystem: true,
    permissions: 'all', // Special marker for all permissions
  },
  {
    name: 'Admin',
    key: 'admin',
    description: 'Administrative access with most permissions',
    isSystem: true,
    permissions: [
      'users.read', 'users.create', 'users.update',
      'roles.read',
      'permissions.read',
      'sessions.read', 'sessions.delete',
      'countries.read', 'countries.update',
      'countryPages.read', 'countryPages.create', 'countryPages.update', 'countryPages.delete',
      'visaTypes.read', 'visaTypes.create', 'visaTypes.update',
      'settings.read', 'settings.update',
      'emailTemplates.read', 'emailTemplates.create', 'emailTemplates.update',
      'paymentPageConfigs.read', 'paymentPageConfigs.update',
      'templates.read', 'templates.create', 'templates.update',
      'templateBindings.read', 'templateBindings.create', 'templateBindings.update',
      'applications.read', 'applications.update', 'applications.review',
      'payments.read', 'payments.update', 'payments.manage',
      'notifications.read', 'notifications.update',
      'jobs.read', 'jobs.update',
      'auditLogs.read',
      'dashboard.read',
    ],
  },
  {
    name: 'Operator',
    key: 'operator',
    description: 'Limited access for daily operations',
    isSystem: true,
    permissions: [
      'users.read',
      'roles.read',
      'sessions.read', 'sessions.delete',
      'countries.read',
      'countryPages.read',
      'visaTypes.read',
      'settings.read',
      'emailTemplates.read',
      'paymentPageConfigs.read',
      'templates.read',
      'templateBindings.read',
      'applications.read', 'applications.update', 'applications.review',
      'payments.read', 'payments.update',
      'notifications.read',
      'jobs.read',
      'dashboard.read',
    ],
  },
];

// Default admin users
const USERS = [
  {
    fullName: 'Super Admin',
    email: 'super@visa.com',
    password: 'super123',
    roleKey: 'superAdmin',
  },
  {
    fullName: 'Admin User',
    email: 'admin@visa.com',
    password: 'admin123',
    roleKey: 'admin',
  },
  {
    fullName: 'Operator User',
    email: 'operator@visa.com',
    password: 'operator123',
    roleKey: 'operator',
  },
];

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Seed permissions
  console.log('📋 Seeding permissions...');
  const permissionMap = new Map<string, string>();
  
  for (const perm of PERMISSIONS) {
    const permissionKey = `${perm.moduleKey}.${perm.actionKey}`;
    const existing = await prisma.permission.findUnique({
      where: { permissionKey },
    });

    if (existing) {
      permissionMap.set(permissionKey, existing.id);
      console.log(`  ⏭️  Permission exists: ${permissionKey}`);
    } else {
      const created = await prisma.permission.create({
        data: {
          moduleKey: perm.moduleKey,
          actionKey: perm.actionKey,
          permissionKey,
          description: perm.description,
        },
      });
      permissionMap.set(permissionKey, created.id);
      console.log(`  ✅ Created permission: ${permissionKey}`);
    }
  }
  console.log(`  Total: ${PERMISSIONS.length} permissions\n`);

  // Seed roles
  console.log('👥 Seeding roles...');
  const roleMap = new Map<string, string>();

  for (const roleData of ROLES) {
    let role = await prisma.role.findUnique({
      where: { key: roleData.key },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleData.name,
          key: roleData.key,
          description: roleData.description,
          isSystem: roleData.isSystem,
        },
      });
      console.log(`  ✅ Created role: ${roleData.name} (${roleData.key})`);
    } else {
      console.log(`  ⏭️  Role exists: ${roleData.name} (${roleData.key})`);
    }

    roleMap.set(roleData.key, role.id);

    // Assign permissions to role
    const permissionIds: string[] = [];
    
    if (roleData.permissions === 'all') {
      // Super admin gets all permissions
      permissionIds.push(...Array.from(permissionMap.values()));
    } else {
      // Map permission keys to IDs
      for (const permKey of roleData.permissions) {
        const permId = permissionMap.get(permKey);
        if (permId) {
          permissionIds.push(permId);
        }
      }
    }

    // Clear existing role permissions and add new ones
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    console.log(`     Assigned ${permissionIds.length} permissions to ${roleData.key}`);
  }
  console.log();

  // Seed users
  console.log('👤 Seeding users...');
  const saltRounds = 12;

  for (const userData of USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`  ⏭️  User exists: ${userData.email}`);
      continue;
    }

    const roleId = roleMap.get(userData.roleKey);
    if (!roleId) {
      console.log(`  ❌ Role not found for user: ${userData.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    await prisma.user.create({
      data: {
        fullName: userData.fullName,
        email: userData.email,
        passwordHash,
        roleId,
        isActive: true,
      },
    });

    console.log(`  ✅ Created user: ${userData.email} (${userData.roleKey})`);
  }

  console.log('\n✨ Seed completed successfully!\n');

  // Print summary
  console.log('📊 Summary:');
  console.log('─'.repeat(50));
  console.log(`  Permissions: ${PERMISSIONS.length}`);
  console.log(`  Roles: ${ROLES.length}`);
  console.log(`  Users: ${USERS.length}`);
  console.log('─'.repeat(50));
  
  console.log('\n📋 Permission modules:');
  console.log('─'.repeat(50));
  const modules = [...new Set(PERMISSIONS.map(p => p.moduleKey))];
  for (const mod of modules) {
    const actions = PERMISSIONS.filter(p => p.moduleKey === mod).map(p => p.actionKey);
    console.log(`  ${mod}: ${actions.join(', ')}`);
  }
  console.log('─'.repeat(50));
  
  console.log('\n🔐 Default credentials for development:');
  console.log('─'.repeat(50));
  for (const user of USERS) {
    console.log(`  ${user.email} / ${user.password} (${user.roleKey})`);
  }
  console.log('─'.repeat(50));
  console.log('\n⚠️  Remember to change these passwords in production!\n');

  // ===========================================
  // Pre-Sprint 3 minimal config seed
  // ===========================================
  // Adds the bare-minimum config records needed to test Sprint 3 admin
  // CRUD wiring. Idempotent (re-runs are no-ops). Full demo seed lives
  // in a separate Sprint 1 / Task A.
  console.log('🌍 Seeding minimal config data (pre-Sprint 3)...\n');

  // A. Countries — UN ISO 3166-1 alpha-2 reference data (250 rows).
  // Upsert by isoCode. Re-runs are no-ops for unchanged rows.
  console.log('🏳️  Countries (UN ISO 3166-1 reference, 250 rows):');
  const isoDataPath = path.resolve(__dirname, 'data', 'countries-iso3166.json');
  const isoCountries: IsoCountry[] = JSON.parse(
    fs.readFileSync(isoDataPath, 'utf8'),
  );
  const countryIds: Record<string, string> = {};
  let createdCountries = 0;
  let updatedCountries = 0;
  for (const c of isoCountries) {
    const existing = await prisma.country.findUnique({
      where: { isoCode: c.isoCode },
    });
    const country = await prisma.country.upsert({
      where: { isoCode: c.isoCode },
      update: {
        name: c.name,
        flagEmoji: c.flagEmoji,
        continentCode: c.continentCode,
        region: c.region,
      },
      create: {
        isoCode: c.isoCode,
        name: c.name,
        flagEmoji: c.flagEmoji,
        continentCode: c.continentCode,
        region: c.region,
      },
    });
    countryIds[c.isoCode] = country.id;
    if (existing) updatedCountries++;
    else createdCountries++;
  }
  console.log(`  ✅ ${createdCountries} new, ${updatedCountries} updated`);

  // B. Country Pages — publishable marketing pages for the 3 demo countries.
  // Optional per country; only the destinations we actively offer get a page.
  // Idempotent: upsert by countryId (unique).
  console.log('\n📄 Country pages (publishable marketing content):');
  const COUNTRY_PAGE_DATA = [
    {
      isoCode: 'TR',
      slug: 'turkey',
      isPublished: true,
      seoTitle: 'Türkiye Visa',
      seoDescription: 'Visa to Türkiye',
    },
    {
      isoCode: 'AZ',
      slug: 'azerbaijan',
      isPublished: true,
      seoTitle: 'Azerbaijan Visa',
      seoDescription: 'Visa to Azerbaijan',
    },
    {
      isoCode: 'AE',
      slug: 'uae',
      isPublished: true,
      seoTitle: 'UAE Visa',
      seoDescription: 'Visa to UAE',
    },
  ];
  const countryPageIds: Record<string, string> = {};
  for (const p of COUNTRY_PAGE_DATA) {
    const countryId = countryIds[p.isoCode];
    if (!countryId) {
      console.log(`  ❌ Country ${p.isoCode} not found, skipping page`);
      continue;
    }
    const page = await prisma.countryPage.upsert({
      where: { countryId },
      update: {
        slug: p.slug,
        isPublished: p.isPublished,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
      },
      create: {
        countryId,
        slug: p.slug,
        isPublished: p.isPublished,
        isActive: true,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
      },
    });
    countryPageIds[p.isoCode] = page.id;
    console.log(`  ✅ ${p.slug} (${p.isoCode})`);
  }

  // C. CountrySections for the Türkiye page — findFirst by (countryPageId, title).
  console.log('\n📑 Country sections (Türkiye page):');
  const SECTION_DATA = [
    {
      title: 'Overview',
      content:
        'Türkiye is a transcontinental country bridging Europe and Asia, offering rich history, diverse landscapes, and vibrant culture.',
      sortOrder: 0,
    },
    {
      title: 'Requirements',
      content:
        'Valid passport with 6+ months validity, 2 recent passport photos, completed application form, proof of accommodation, and return ticket.',
      sortOrder: 1,
    },
    {
      title: 'FAQ',
      content:
        'Q: How long does processing take?\nA: Typically 3-5 business days.\n\nQ: Can I extend my visa?\nA: Extensions are possible at local immigration offices.',
      sortOrder: 2,
    },
  ];
  const trPageId = countryPageIds['TR'];
  if (!trPageId) {
    console.log('  ❌ TR country page not found, skipping sections');
  } else {
    for (const s of SECTION_DATA) {
      const existing = await prisma.countrySection.findFirst({
        where: { countryPageId: trPageId, title: s.title, deletedAt: null },
      });
      if (existing) {
        console.log(`  ⏭️  ${s.title} (exists)`);
      } else {
        await prisma.countrySection.create({
          data: { ...s, countryPageId: trPageId, isActive: true },
        });
        console.log(`  ✅ ${s.title}`);
      }
    }
  }

  // C. Visa Types — findFirst by purpose (no unique constraint).
  console.log('\n🛂 Visa types:');
  const VISA_TYPE_DATA: Array<{
    purpose: string;
    label: string;
    entries: VisaEntryType;
    validityDays: number;
    maxStay: number;
    description?: string;
  }> = [
    {
      purpose: 'tourism',
      label: 'Tourism Visa',
      entries: VisaEntryType.SINGLE,
      validityDays: 90,
      maxStay: 30,
      description: 'Single-entry tourism visa for short stays.',
    },
    {
      purpose: 'business',
      label: 'Business Visa',
      entries: VisaEntryType.MULTIPLE,
      validityDays: 180,
      maxStay: 30,
      description: 'Multiple-entry business visa for meetings and trade.',
    },
  ];
  const visaTypeIds: Record<string, string> = {};
  for (const v of VISA_TYPE_DATA) {
    let visaType = await prisma.visaType.findFirst({
      where: { purpose: v.purpose, deletedAt: null },
    });
    if (visaType) {
      console.log(`  ⏭️  ${v.label} (${v.purpose}) (exists)`);
    } else {
      visaType = await prisma.visaType.create({
        data: { ...v, isActive: true },
      });
      console.log(`  ✅ ${v.label} (${v.purpose})`);
    }
    visaTypeIds[v.purpose] = visaType.id;
  }

  // D. Email Templates — upsert by templateKey (unique). Use the keys the
  // codebase actually consumes (see EmailTemplateService TEMPLATE_REQUIRED_VARIABLES).
  console.log('\n📧 Email templates:');
  const EMAIL_TEMPLATE_DATA = [
    {
      templateKey: 'otp_verification',
      subject: 'Your E-Visa OTP Code',
      bodyHtml:
        '<p>Your verification code is: <strong>{{otpCode}}</strong></p><p>This code expires in {{expiryMinutes}} minutes.</p>',
      bodyText:
        'Your verification code is: {{otpCode}}\n\nThis code expires in {{expiryMinutes}} minutes.',
    },
    {
      templateKey: 'application_status_update',
      subject: 'Your application is now {{status}}',
      bodyHtml:
        '<p>Your application <strong>{{applicationRef}}</strong> is now <strong>{{status}}</strong>.</p>',
      bodyText:
        'Your application {{applicationRef}} is now {{status}}.',
    },
  ];
  for (const t of EMAIL_TEMPLATE_DATA) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: t.templateKey },
      update: {},
      create: { ...t, isActive: true },
    });
    console.log(`  ✅ ${t.templateKey}`);
  }

  // E. Form Template — upsert by key (unique).
  console.log('\n📋 Form template:');
  const formTemplate = await prisma.template.upsert({
    where: { key: 'test-tourism' },
    update: {},
    create: {
      key: 'test-tourism',
      name: 'Test Tourism Form',
      version: 1,
      isActive: true,
      description: 'Minimal tourism application form for Sprint 3 testing.',
    },
  });
  console.log(`  ✅ test-tourism`);

  // F. Template section — composite unique (templateId, key).
  console.log('\n📂 Template section:');
  const templateSection = await prisma.templateSection.upsert({
    where: {
      templateId_key: { templateId: formTemplate.id, key: 'personal' },
    },
    update: {},
    create: {
      templateId: formTemplate.id,
      key: 'personal',
      title: 'Personal Info',
      sortOrder: 0,
      isActive: true,
    },
  });
  console.log(`  ✅ personal`);

  // G. Template fields — composite unique (templateSectionId, fieldKey).
  console.log('\n📝 Template fields:');
  const FIELD_DATA = [
    {
      fieldKey: 'fullName',
      fieldType: 'text',
      label: 'Full Name',
      isRequired: true,
      sortOrder: 0,
      validationRulesJson: { minLength: 2, maxLength: 200 },
    },
    {
      fieldKey: 'email',
      fieldType: 'email',
      label: 'Email',
      isRequired: true,
      sortOrder: 1,
      validationRulesJson: undefined,
    },
  ];
  for (const f of FIELD_DATA) {
    await prisma.templateField.upsert({
      where: {
        templateSectionId_fieldKey: {
          templateSectionId: templateSection.id,
          fieldKey: f.fieldKey,
        },
      },
      update: {},
      create: {
        templateSectionId: templateSection.id,
        fieldKey: f.fieldKey,
        fieldType: f.fieldType,
        label: f.label,
        isRequired: f.isRequired,
        sortOrder: f.sortOrder,
        isActive: true,
        ...(f.validationRulesJson
          ? { validationRulesJson: f.validationRulesJson }
          : {}),
      },
    });
    console.log(`  ✅ ${f.fieldKey} (${f.fieldType})`);
  }

  // H. Template binding — composite unique (destinationCountryId, visaTypeId).
  console.log('\n🔗 Template binding:');
  const binding = await prisma.templateBinding.upsert({
    where: {
      destinationCountryId_visaTypeId: {
        destinationCountryId: countryIds['TR'],
        visaTypeId: visaTypeIds['tourism'],
      },
    },
    update: {},
    create: {
      destinationCountryId: countryIds['TR'],
      visaTypeId: visaTypeIds['tourism'],
      templateId: formTemplate.id,
      isActive: true,
    },
  });
  console.log(`  ✅ TR + tourism + test-tourism`);

  // I. Binding nationality fees — composite unique
  // (templateBindingId, nationalityCountryId).
  console.log('\n💰 Binding nationality fees:');
  const FEE_DATA = [
    {
      nationalityIso: 'AZ',
      governmentFeeAmount: 50,
      serviceFeeAmount: 20,
      expeditedFeeAmount: 50,
    },
    {
      nationalityIso: 'AE',
      governmentFeeAmount: 80,
      serviceFeeAmount: 25,
      expeditedFeeAmount: 50,
    },
  ];
  for (const fee of FEE_DATA) {
    await prisma.bindingNationalityFee.upsert({
      where: {
        templateBindingId_nationalityCountryId: {
          templateBindingId: binding.id,
          nationalityCountryId: countryIds[fee.nationalityIso],
        },
      },
      update: {},
      create: {
        templateBindingId: binding.id,
        nationalityCountryId: countryIds[fee.nationalityIso],
        governmentFeeAmount: fee.governmentFeeAmount,
        serviceFeeAmount: fee.serviceFeeAmount,
        expeditedFeeAmount: fee.expeditedFeeAmount,
        currencyCode: 'USD',
        expeditedEnabled: true,
        isActive: true,
      },
    });
    console.log(
      `  ✅ TR/${fee.nationalityIso} — gov ${fee.governmentFeeAmount}, svc ${fee.serviceFeeAmount}, exp ${fee.expeditedFeeAmount} USD`,
    );
  }

  // J. Settings (singleton) — findFirst + create.
  console.log('\n⚙️  Settings (singleton):');
  const existingSetting = await prisma.setting.findFirst();
  if (existingSetting) {
    console.log(`  ⏭️  Settings exist`);
  } else {
    await prisma.setting.create({
      data: {
        siteName: 'E-Visa Portal',
        supportEmail: 'support@evisaglobal.com',
        defaultCurrency: 'USD',
        paymentTimeoutHours: 3,
        maintenanceMode: false,
      },
    });
    console.log(`  ✅ Settings created`);
  }

  // K. PaymentPageConfig (singleton) — findFirst + create.
  console.log('\n💳 Payment page config (singleton):');
  const existingPaymentConfig = await prisma.paymentPageConfig.findFirst();
  if (existingPaymentConfig) {
    console.log(`  ⏭️  Payment page config exists`);
  } else {
    await prisma.paymentPageConfig.create({
      data: {
        title: 'Complete Your Payment',
        description: 'Secure payment for your visa application.',
        sectionsJson: { header: 'Complete Your Payment' },
        isActive: true,
      },
    });
    console.log(`  ✅ Payment page config created`);
  }

  console.log('\n📊 Pre-Sprint 3 config tally:');
  console.log('─'.repeat(50));
  console.log(`  Countries (UN reference): 250 (ISO 3166-1 alpha-2)`);
  console.log(`  Country pages:            3 (TR, AZ, AE — publishable)`);
  console.log(`  Country sections:         3 (TR page)`);
  console.log(`  Visa types:               2 (tourism, business)`);
  console.log(
    `  Email templates:          2 (otp_verification, application_status_update)`,
  );
  console.log(`  Form template:            1 (test-tourism)`);
  console.log(`  Template section:         1 (personal)`);
  console.log(`  Template fields:          2 (fullName, email)`);
  console.log(`  Template binding:         1 (TR + tourism)`);
  console.log(`  Binding nationality fees: 2 (AZ, AE)`);
  console.log(`  Settings:                 1 (singleton)`);
  console.log(`  Payment page config:      1 (singleton)`);
  console.log('─'.repeat(50));
  console.log(`  Total config records:     19`);
  console.log('─'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
