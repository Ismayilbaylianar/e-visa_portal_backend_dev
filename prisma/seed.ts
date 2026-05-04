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
  { moduleKey: 'templates', actionKey: 'duplicate', description: 'Clone an existing template — for future endpoint' },
  
  // Template Bindings module
  { moduleKey: 'templateBindings', actionKey: 'read', description: 'View template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'create', description: 'Create template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'update', description: 'Update template bindings and nationality fees' },
  { moduleKey: 'templateBindings', actionKey: 'delete', description: 'Delete template bindings and nationality fees' },
  
  // Applications module
  { moduleKey: 'applications', actionKey: 'read', description: 'View applications' },
  { moduleKey: 'applications', actionKey: 'update', description: 'Update application status' },
  { moduleKey: 'applications', actionKey: 'review', description: 'Review and process applications' },
  { moduleKey: 'applications', actionKey: 'approve', description: 'Approve a submitted application' },
  { moduleKey: 'applications', actionKey: 'reject', description: 'Reject a submitted application with a reason' },
  { moduleKey: 'applications', actionKey: 'request_documents', description: 'Request additional or corrected documents from applicant' },
  { moduleKey: 'applications', actionKey: 'start_review', description: 'Move application from SUBMITTED to IN_REVIEW (claim ownership)' },

  // Documents module (Modul 6b prep — admin endpoints exist but were unguarded
  // before the Permission Hardening Pack. PII-sensitive surface.)
  { moduleKey: 'documents', actionKey: 'read', description: 'View document metadata in admin' },
  { moduleKey: 'documents', actionKey: 'download', description: 'Download original document file (PII-sensitive)' },
  { moduleKey: 'documents', actionKey: 'review', description: 'Set document review status (approved/rejected/needs_reupload)' },
  { moduleKey: 'documents', actionKey: 'verify', description: 'Run integrity check on stored file' },
  { moduleKey: 'documents', actionKey: 'hard_delete', description: 'Permanently remove document + file from storage (irreversible)' },

  // Payments module
  { moduleKey: 'payments', actionKey: 'read', description: 'View payments and transactions' },
  { moduleKey: 'payments', actionKey: 'update', description: 'Update payment status manually' },
  { moduleKey: 'payments', actionKey: 'refund', description: 'Process refunds' },
  { moduleKey: 'payments', actionKey: 'manage', description: 'Full payment management access' },
  { moduleKey: 'payments', actionKey: 'transactions.read', description: 'View provider transaction + callback history' },
  { moduleKey: 'payments', actionKey: 'export', description: 'Export payments/transactions (CSV) — for future endpoint' },
  
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

  // M11.B — Content Management (CMS)
  { moduleKey: 'content', actionKey: 'read', description: 'View content pages, contact info, and FAQ items' },
  { moduleKey: 'content', actionKey: 'update', description: 'Create, edit, reorder, or delete content (pages, contact info, FAQ)' },

  // M11.1 — Homepage slides (countryPages.update is reused for hero images)
  { moduleKey: 'homepageSlides', actionKey: 'read', description: 'View homepage carousel slides' },
  { moduleKey: 'homepageSlides', actionKey: 'update', description: 'Create, edit, reorder, publish, or delete homepage slides' },
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
      'templates.read', 'templates.create', 'templates.update', 'templates.duplicate',
      'templateBindings.read', 'templateBindings.create', 'templateBindings.update',
      'applications.read', 'applications.update', 'applications.review',
      // Modul 6b prep — review-action permissions (admin can approve/reject/request docs/start review)
      'applications.approve', 'applications.reject',
      'applications.request_documents', 'applications.start_review',
      // Modul 6b prep — documents (admin can read/download/review/verify; hard_delete is super-only)
      'documents.read', 'documents.download', 'documents.review', 'documents.verify',
      'payments.read', 'payments.update', 'payments.manage',
      'payments.transactions.read', 'payments.export',
      'notifications.read', 'notifications.update',
      'jobs.read', 'jobs.update',
      'auditLogs.read',
      'dashboard.read',
      // M11.B — admin can edit content
      'content.read', 'content.update',
      // M11.1 — admin can manage homepage slides
      'homepageSlides.read', 'homepageSlides.update',
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
      // Modul 6b prep — operator can run day-to-day review actions
      // (request docs, claim a queue item) but NOT approve / reject final.
      'applications.request_documents', 'applications.start_review',
      // Modul 6b prep — operator works documents during review
      // (read/download/review). hard_delete + verify stay above operator.
      'documents.read', 'documents.download', 'documents.review',
      'payments.read', 'payments.update',
      'payments.transactions.read',
      'notifications.read',
      'jobs.read',
      'dashboard.read',
      // M11.B — operator can VIEW but not edit content
      'content.read',
      // M11.1 — operator can VIEW homepage slides but not edit
      'homepageSlides.read',
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

  // B. Country Pages — publishable marketing pages.
  //
  // Sprint 1 / Task A demo set: 12 destinations actively offered through
  // the public flow (TR / AE / EG / TH / GE / VN / LK / ID / IN / KH /
  // MY / SG) + the legacy AZ page kept from the pre-Sprint 3 minimal
  // seed (admin can unpublish if needed via the Module 1.5 admin UI;
  // seed leaves admin-edited rows alone).
  //
  // `isDestination` / `isNationality` flags do NOT exist on the Country
  // schema — destinations are derived at runtime from `country.page`
  // existence (publishable + active), nationalities from the countries
  // table directly. The 8 nationality-only countries listed in the
  // Sprint 1 brief (RU / UA / KZ / UZ / IR / BY / TJ + AZ) get no page;
  // they're already in the 250-row UN ISO reference seed and will show
  // up automatically in the public nationality dropdown via
  // /public/selection/options.
  //
  // Idempotent: upsert by countryId (unique). Re-runs are no-ops for
  // unchanged rows; admin slug / SEO edits made via the admin UI WILL
  // be overwritten on re-run because update payload is non-empty —
  // acceptable for now since slug is derived from isoCode and SEO is
  // boilerplate. If admin customization becomes important later, switch
  // to `update: {}` like the email templates use.
  console.log('\n📄 Country pages (publishable marketing content):');
  const COUNTRY_PAGE_DATA = [
    // Existing pre-Sprint 3 minimal trio (kept for back-compat)
    { isoCode: 'TR', slug: 'turkey',     isPublished: true, seoTitle: 'Türkiye Visa',     seoDescription: 'Apply for a Türkiye e-Visa online — fast processing, secure payment.' },
    { isoCode: 'AZ', slug: 'azerbaijan', isPublished: true, seoTitle: 'Azerbaijan Visa',  seoDescription: 'Apply for an Azerbaijan e-Visa online.' },
    { isoCode: 'AE', slug: 'uae',        isPublished: true, seoTitle: 'UAE Visa',         seoDescription: 'Apply for a United Arab Emirates e-Visa online.' },
    // Sprint 1 / Task A — 9 new destination pages
    { isoCode: 'EG', slug: 'egypt',      isPublished: true, seoTitle: 'Egypt e-Visa',     seoDescription: 'Apply for an Egypt e-Visa online — visit the pyramids, Nile, and Red Sea.' },
    { isoCode: 'TH', slug: 'thailand',   isPublished: true, seoTitle: 'Thailand e-Visa',  seoDescription: 'Apply for a Thailand e-Visa online — beaches, temples, and Bangkok await.' },
    { isoCode: 'GE', slug: 'georgia',    isPublished: true, seoTitle: 'Georgia e-Visa',   seoDescription: 'Apply for a Georgia e-Visa online — Caucasus mountains and ancient culture.' },
    { isoCode: 'VN', slug: 'vietnam',    isPublished: true, seoTitle: 'Vietnam e-Visa',   seoDescription: 'Apply for a Vietnam e-Visa online — discover Halong Bay, Hanoi, and Ho Chi Minh City.' },
    { isoCode: 'LK', slug: 'sri-lanka',  isPublished: true, seoTitle: 'Sri Lanka e-Visa', seoDescription: 'Apply for a Sri Lanka ETA online — beaches, tea country, and ancient temples.' },
    { isoCode: 'ID', slug: 'indonesia',  isPublished: true, seoTitle: 'Indonesia e-Visa', seoDescription: 'Apply for an Indonesia e-Visa online — Bali, Java, and the archipelago.' },
    { isoCode: 'IN', slug: 'india',      isPublished: true, seoTitle: 'India e-Visa',     seoDescription: 'Apply for an India e-Visa online — Taj Mahal, Goa beaches, and bustling cities.' },
    { isoCode: 'KH', slug: 'cambodia',   isPublished: true, seoTitle: 'Cambodia e-Visa',  seoDescription: 'Apply for a Cambodia e-Visa online — Angkor Wat and the Khmer heritage.' },
    { isoCode: 'MY', slug: 'malaysia',   isPublished: true, seoTitle: 'Malaysia e-Visa',  seoDescription: 'Apply for a Malaysia e-Visa online — Kuala Lumpur, Penang, and rainforests.' },
    { isoCode: 'SG', slug: 'singapore',  isPublished: true, seoTitle: 'Singapore e-Visa', seoDescription: 'Apply for a Singapore e-Visa online — modern city-state with rich heritage.' },
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

  // C. Country sections — 4 sections × 5 destinations (TR / AE / EG / TH / GE).
  //
  // Real bilingual (Az + En) content. Insert-if-missing only — admins
  // typically tweak section copy after launch (typos, regulatory
  // updates, FAQ additions) and we must not blow that work away on
  // re-seed. Lookup key is (countryPageId, title) since the schema
  // doesn't carry a slug/key on sections.
  console.log('\n📑 Country sections (4 per destination × 5 destinations):');

  // Section content per destination. Each entry yields 4 sections in
  // sortOrder 0..3: Overview, Requirements, Processing Time, FAQ.
  // Content is pre-written production copy (not Lorem) — Az headline +
  // English body. Real-world facts: passport validity rules, processing
  // SLAs, fees-not-refundable disclosures, common FAQ.
  const COUNTRY_SECTIONS_BY_ISO: Record<string, Array<{ title: string; content: string; sortOrder: number }>> = {
    TR: [
      {
        sortOrder: 0,
        title: 'Türkiye e-Visa — Overview',
        content:
          'Türkiyə Respublikasına səfər üçün rəsmi e-Visa proqramı 100+ ölkənin vətəndaşları üçün açıqdır. Müraciət tamamilə onlayndır, embassy ziyarəti tələb olunmur.\n\n' +
          'Türkiye operates one of the most accessible e-Visa programs in the world. Eligible nationals can apply 100% online, with no embassy visit required. The visa is electronically linked to the passport — print the confirmation and present it with your passport at the port of entry.\n\n' +
          'Validity: typically 180 days from the issue date with stays up to 30 or 90 days depending on nationality. Single-entry tourism visas are most common; business and multi-entry options also available.',
      },
      {
        sortOrder: 1,
        title: 'Requirements / Tələblər',
        content:
          'Tələb olunan sənədlər:\n• Pasport: müraciət tarixindən ən az 6 ay etibarlı olmalıdır\n• Rəqəmsal pasport şəkli (JPG/PNG, açıq fonda)\n• E-mail ünvanı (təsdiq və e-Visa qəbz üçün)\n• Ödəniş kartı (Visa / Mastercard)\n\n' +
          'Required documents:\n• Passport valid for at least 6 months from the date of application\n• Digital passport-style photo (JPG/PNG, light background)\n• Active email address (for confirmation + e-Visa receipt)\n• Payment card (Visa / Mastercard)\n\n' +
          'Optional but recommended: hotel reservation, return ticket, proof of sufficient funds.',
      },
      {
        sortOrder: 2,
        title: 'Processing Time / Emal müddəti',
        content:
          'Standart emal müddəti 1-3 iş günüdür. Əksər müraciətlər 24 saat ərzində təsdiqlənir. Səfər tarixindən ən az 5 iş günü əvvəl müraciət etməyiniz tövsiyə olunur.\n\n' +
          'Standard processing: 1–3 business days. Most applications are approved within 24 hours. We recommend applying at least 5 business days before your travel date to allow for unexpected document verification.\n\n' +
          'Expedited processing (where supported by the destination) accelerates review to within 4 hours during business hours, with an additional fee.',
      },
      {
        sortOrder: 3,
        title: 'FAQ / Tez-tez verilən suallar',
        content:
          'S: e-Visa neçə dəfə daxil olmaq icazəsi verir?\nC: Tək giriş (single-entry) və çoxsaylı giriş (multiple-entry) variantları vardır. Standard tourism visa adətən tək girişdir.\n\n' +
          'S: Pasport müddəti yenilənibsə nə etməliyəm?\nC: e-Visa müraciət zamanı qeydiyyatdan keçirilmiş pasporta bağlanır. Yeni pasport çıxarılarsa, yenidən müraciət lazımdır.\n\n' +
          'Q: Can I extend my e-Visa once in the country?\nA: Extensions are possible through the local immigration office before the validity expires. The e-Visa itself cannot be re-issued online.\n\n' +
          'Q: What if my application is rejected?\nA: Application fees are non-refundable, but you may re-apply with corrected documentation. Common rejection reasons: insufficient passport validity, mismatched photo, incomplete travel details.',
      },
    ],
    AE: [
      {
        sortOrder: 0,
        title: 'United Arab Emirates e-Visa — Overview',
        content:
          'Birləşmiş Ərəb Əmirliklərinə səfər üçün e-Visa Dubay, Abu Dabi və digər emiratlara giriş icazəsi verir. Müraciət onlayn aparılır.\n\n' +
          'The UAE e-Visa grants entry to all seven emirates including Dubai, Abu Dhabi, and Sharjah. The application is fully online and the visa is electronically linked to your passport.\n\n' +
          'Most tourist visas are valid for 60 days from issue and allow stays of 30 days. Multi-entry options exist for business travelers and frequent visitors.',
      },
      {
        sortOrder: 1,
        title: 'Requirements / Tələblər',
        content:
          'Tələb olunan sənədlər:\n• Pasport: ən az 6 ay etibarlı\n• Rəqəmsal pasport şəkli (45×35 mm, ağ fonda)\n• Konfirmasiya edilmiş otel rezervi və ya dəvətnamə\n• Geri qayıdış bileti\n\n' +
          'Required documents:\n• Passport valid for at least 6 months\n• Recent passport photo (45×35 mm, white background)\n• Confirmed hotel reservation or invitation letter\n• Return flight ticket\n\n' +
          'Note: certain nationalities require additional financial proof (3 months bank statement, employment letter).',
      },
      {
        sortOrder: 2,
        title: 'Processing Time / Emal müddəti',
        content:
          'Standart emal: 3-5 iş günü. Səfər tarixindən ən az 7 iş günü əvvəl müraciət edin.\n\n' +
          'Standard processing: 3–5 business days. Apply at least 7 business days before travel. The UAE Federal Authority for Identity and Citizenship (ICA) handles approvals; service hours are Sunday–Thursday, 8:00–17:00 GST.\n\n' +
          'Expedited 24-hour processing is available for an additional fee.',
      },
      {
        sortOrder: 3,
        title: 'FAQ / Tez-tez verilən suallar',
        content:
          'S: e-Visa BƏƏ-də nə qədər qala bilərəm?\nC: Standart turist vizası 30 günlük qalmağa icazə verir; uzatma yerli immigration ofisi vasitəsilə mümkündür.\n\n' +
          'Q: Do I need a visa to transit through Dubai or Abu Dhabi airport?\nA: Most nationalities can transit for up to 8 hours without a visa. Stays beyond 8 hours typically require a transit visa or full e-Visa.\n\n' +
          'Q: Is alcohol allowed?\nA: Yes, in licensed venues (hotels, designated restaurants). Public consumption is prohibited and can result in fines.\n\n' +
          'Q: What if my e-Visa expires before I travel?\nA: You must re-apply. Fees are non-refundable.',
      },
    ],
    EG: [
      {
        sortOrder: 0,
        title: 'Egypt e-Visa — Overview',
        content:
          'Misir e-Visa proqramı turistlərə Qahirə, İskəndəriyyə, Luksor və Qırmızı dəniz kurortlarına giriş üçün asan onlayn müraciət imkanı verir.\n\n' +
          'Egypt offers a 30-day single-entry tourist e-Visa for over 70 nationalities. The application is processed entirely online and the e-Visa is delivered by email — print and present at any Egyptian port of entry.',
      },
      {
        sortOrder: 1,
        title: 'Requirements / Tələblər',
        content:
          'Tələb olunan sənədlər:\n• Pasport: ən az 6 ay etibarlı\n• Pasportun məlumat səhifəsinin skani\n• E-mail ünvanı və ödəniş kartı\n• Otel rezervi və ya səfər planı\n\n' +
          'Required documents:\n• Passport valid for at least 6 months from the date of arrival\n• Scanned copy of passport bio page\n• Email address and payment card\n• Hotel reservation or detailed travel itinerary',
      },
      {
        sortOrder: 2,
        title: 'Processing Time / Emal müddəti',
        content:
          'Standart emal müddəti: 7 iş günü. Az hallarda 24 saat ərzində təsdiqlənir.\n\n' +
          'Standard processing: up to 7 business days, though most applications complete within 48–72 hours. Apply at least 10 days before your planned arrival to allow for verification.\n\n' +
          'There is no expedited option — Egyptian authorities process all e-Visas in submission order.',
      },
      {
        sortOrder: 3,
        title: 'FAQ / Tez-tez verilən suallar',
        content:
          'S: e-Visa Sina yarımadasına səyahət üçün etibarlıdırmı?\nC: Sharm El Sheikh və Sina sahili üçün ayrıca pulsuz "Sinai-only" stamp visa verilir, lakin Misir daxilinə giriş üçün tam e-Visa lazımdır.\n\n' +
          'Q: Can I get a visa on arrival instead?\nA: Yes, visa-on-arrival is available at major airports for many nationalities, but the e-Visa avoids long airport queues and locks in your application before you fly.\n\n' +
          'Q: Is the e-Visa multi-entry?\nA: Standard tourist e-Visa is single-entry, valid for 30 days. A multi-entry version is available for an additional fee.\n\n' +
          'Q: Are there restricted areas?\nA: Travel to certain border regions (Sinai interior, Western Desert) requires permits not covered by the tourist e-Visa.',
      },
    ],
    TH: [
      {
        sortOrder: 0,
        title: 'Thailand e-Visa — Overview',
        content:
          'Tayland e-Visa proqramı 60 günə qədər qalış üçün rahat onlayn müraciət sistemi təqdim edir. Bangkok, Phuket, Chiang Mai və Pattaya kurortları üçün etibarlıdır.\n\n' +
          'Thailand offers e-Visa on Arrival (eVOA) for 60 nationalities and a full e-Visa for the rest. Both are processed entirely online — no embassy visit. The standard tourist e-Visa allows a 60-day stay, extendable by 30 days at a Thai immigration office.',
      },
      {
        sortOrder: 1,
        title: 'Requirements / Tələblər',
        content:
          'Tələb olunan sənədlər:\n• Pasport: ən az 6 ay etibarlı, 2 boş səhifə\n• Pasport şəkli (35×45 mm)\n• Geri qayıdış bileti\n• Maliyyə isbatı (10,000 THB / şəxs və ya 20,000 THB / ailə)\n\n' +
          'Required documents:\n• Passport valid for at least 6 months with 2 blank pages\n• Recent passport photo (35×45 mm)\n• Confirmed return ticket\n• Proof of funds (THB 10,000 per person or THB 20,000 per family)\n• Confirmed accommodation for the first night',
      },
      {
        sortOrder: 2,
        title: 'Processing Time / Emal müddəti',
        content:
          'Standart emal: 3-5 iş günü. Mütəmadi olaraq 24-48 saat ərzində təsdiqlənir.\n\n' +
          'Standard processing: 3–5 business days, often completed within 24–48 hours. Apply at least 7 days before travel. Thai consular service operates Monday–Friday only.',
      },
      {
        sortOrder: 3,
        title: 'FAQ / Tez-tez verilən suallar',
        content:
          'S: 60 gündən artıq qalmaq olarmı?\nC: Bəli — yerli Tayland Immigration Bureau-da 30 günlük uzatma mümkündür (1,900 THB ödənişlə).\n\n' +
          'Q: Can I work on a tourist e-Visa?\nA: No. Working without a non-immigrant visa is illegal and carries fines or deportation. Apply for a Non-Immigrant B visa for any paid activity.\n\n' +
          'Q: Do I need to declare cash on arrival?\nA: Amounts over USD 20,000 (or equivalent) must be declared at customs.\n\n' +
          'Q: Can the visa be used for entry by land?\nA: Yes, the e-Visa is valid at land borders, airports, and seaports.',
      },
    ],
    GE: [
      {
        sortOrder: 0,
        title: 'Georgia e-Visa — Overview',
        content:
          'Gürcüstan e-Visa proqramı 90 günə qədər qalış üçün uyğundur — Tbilisi, Batumi, Kazbegi və Qax dağ kurortlarına giriş üçün.\n\n' +
          'Georgia offers a generous 90-day stay on a single tourist e-Visa for 95 nationalities. The application is fully online and the e-Visa is delivered electronically. Many nationalities also enjoy visa-free entry — check eligibility before applying.',
      },
      {
        sortOrder: 1,
        title: 'Requirements / Tələblər',
        content:
          'Tələb olunan sənədlər:\n• Pasport: ən az 3 ay etibarlı (səfər tarixindən etibarən)\n• Pasportun məlumat səhifəsinin rəqəmsal kopyası\n• E-mail ünvanı\n• Maliyyə isbatı və ya səfər planı (sorğu üzrə)\n\n' +
          'Required documents:\n• Passport valid for at least 3 months from the date of intended departure (more lenient than most countries)\n• Digital scan of passport bio page\n• Active email address\n• Proof of funds or itinerary (may be requested)',
      },
      {
        sortOrder: 2,
        title: 'Processing Time / Emal müddəti',
        content:
          'Standart emal: 5 iş günü. Müraciətlər çox vaxt 24-72 saat ərzində nəticələnir.\n\n' +
          'Standard processing: up to 5 business days, with most approvals issued within 24–72 hours. Georgian consular services run Monday–Friday. We recommend applying at least 7 days before travel.',
      },
      {
        sortOrder: 3,
        title: 'FAQ / Tez-tez verilən suallar',
        content:
          'S: Vizasız 1 ildən çox qala bilərəmmi?\nC: Bir çox ölkə vətəndaşlarına Gürcüstan vizasız 1 ilə qədər qalmağa icazə verir — eVisa lazım deyil. Vətəndaşlığınızı təsdiq edin.\n\n' +
          'Q: Is the e-Visa valid at all border crossings?\nA: Yes — Tbilisi airport, Batumi airport, Kutaisi airport, plus all land borders (Sarpi from Türkiye, Lars from Russia, Vahir from Armenia, Sadakhlo from Armenia).\n\n' +
          'Q: Can I extend my stay?\nA: 90-day extensions are possible through Georgian Public Service Halls before the original 90 days expire.\n\n' +
          'Q: Are there areas I cannot visit?\nA: Travel to Abkhazia and South Ossetia is restricted and not covered by the standard e-Visa.',
      },
    ],
  };

  // Iterate destinations + sections — insert-if-missing per (page, title).
  let createdSections = 0;
  let skippedSections = 0;
  for (const isoCode of Object.keys(COUNTRY_SECTIONS_BY_ISO)) {
    const pageId = countryPageIds[isoCode];
    if (!pageId) {
      console.log(`  ⚠️  ${isoCode} country page not found, skipping its sections`);
      continue;
    }
    for (const s of COUNTRY_SECTIONS_BY_ISO[isoCode]) {
      const existing = await prisma.countrySection.findFirst({
        where: { countryPageId: pageId, title: s.title, deletedAt: null },
      });
      if (existing) {
        skippedSections++;
      } else {
        await prisma.countrySection.create({
          data: {
            countryPageId: pageId,
            title: s.title,
            content: s.content,
            sortOrder: s.sortOrder,
            isActive: true,
          },
        });
        createdSections++;
      }
    }
  }
  console.log(`  ✅ ${createdSections} new, ${skippedSections} preserved`);

  // C. Visa Types — findFirst by (purpose, entries) compound natural key.
  //
  // Schema has no unique constraint on `purpose` alone — the natural key
  // is (purpose, entries) since the same purpose can ship as both single
  // and multi-entry (Module 2 design). Sprint 1 / Task A demo set covers
  // the 5 most-requested visa categories.
  //
  // Important: the prompt asked for `key` upsert, but the schema doesn't
  // have a `key` field on VisaType. Using compound natural key for
  // idempotency. Re-runs match the existing row by purpose + entries
  // and update label/validityDays/maxStay/description; sortOrder stays.
  console.log('\n🛂 Visa types:');
  const VISA_TYPE_DATA: Array<{
    purpose: string;
    label: string;
    entries: VisaEntryType;
    validityDays: number;
    maxStay: number;
    description: string;
    sortOrder: number;
  }> = [
    {
      purpose: 'tourism',
      label: 'Tourism Visa',
      entries: VisaEntryType.SINGLE,
      validityDays: 90,
      maxStay: 30,
      description: 'Single-entry tourism visa for short leisure stays. Most common visa type.',
      sortOrder: 10,
    },
    {
      purpose: 'business',
      label: 'Business Visa',
      entries: VisaEntryType.MULTIPLE,
      validityDays: 180,
      maxStay: 60,
      description: 'Multiple-entry business visa for meetings, conferences, trade, and short consultancy work.',
      sortOrder: 20,
    },
    {
      purpose: 'transit',
      label: 'Transit Visa',
      entries: VisaEntryType.SINGLE,
      validityDays: 30,
      maxStay: 5,
      description: 'Single-entry short-stay visa for travelers transiting through to a third country.',
      sortOrder: 30,
    },
    {
      purpose: 'student',
      label: 'Student Visa',
      entries: VisaEntryType.MULTIPLE,
      validityDays: 365,
      maxStay: 365,
      description: 'Year-long multi-entry visa for accepted students at recognized institutions.',
      sortOrder: 40,
    },
    {
      purpose: 'medical',
      label: 'Medical Visa',
      entries: VisaEntryType.SINGLE,
      validityDays: 90,
      maxStay: 60,
      description: 'Short-term medical-treatment visa. Requires hospital admission letter.',
      sortOrder: 50,
    },
  ];
  const visaTypeIds: Record<string, string> = {};
  for (const v of VISA_TYPE_DATA) {
    let visaType = await prisma.visaType.findFirst({
      where: { purpose: v.purpose, entries: v.entries, deletedAt: null },
    });
    if (visaType) {
      // Idempotent update — keep the row's id and sortOrder stable but
      // refresh label / description / validity / maxStay from canonical
      // seed values so seed re-runs heal accidental admin typos.
      visaType = await prisma.visaType.update({
        where: { id: visaType.id },
        data: {
          label: v.label,
          description: v.description,
          validityDays: v.validityDays,
          maxStay: v.maxStay,
        },
      });
    } else {
      visaType = await prisma.visaType.create({
        data: { ...v, isActive: true },
      });
    }
    visaTypeIds[v.purpose] = visaType.id;
    console.log(`  ✅ ${v.label} (${v.purpose} / ${v.entries})`);
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

  // ===========================================
  // Sprint 1 / Task A — production email templates (8 dot-case keys)
  // ===========================================
  // Bilingual (Az + En) production-ready HTML using Handlebars
  // {{var}} interpolation. Insert-if-missing only — once an admin
  // tweaks copy via the Module 3 admin UI we never overwrite.
  //
  // Important: these 8 dot-case keys are NOT yet wired into runtime
  // code (email.service.ts still references the existing snake_case
  // templates: otp_verification, application_status_update,
  // generic_notification, payment_confirmation, raw_email). The Sprint
  // 5 cutover ticket migrates the runtime to this new set; until then
  // these rows are dormant. Schema gap noted in the seed-pack report.
  //
  // The HTML uses table-based layout with inline styles for max client
  // compatibility (Outlook, Gmail, Apple Mail), neutral fallback
  // colors, and includes a header (logo placeholder) + footer (support
  // email + unsubscribe placeholder).
  console.log('\n📧 Production email templates (dot-case keys, dormant until Sprint 5 cutover):');

  // Shared HTML scaffold — header + content slot + footer. Pre-rendered
  // here (rather than as an interpolation step) so the seed file stays
  // greppable and admin edits via the admin UI start from the rendered
  // baseline.
  const wrap = (title: string, contentHtml: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">{{logoPlaceholder|E-VISA GLOBAL}}</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          ${contentHtml}
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a><br/>
          You are receiving this because you applied via the E-Visa Global portal. <a href="{{unsubscribeUrl|#}}" style="color:#6b7280;text-decoration:underline;">Manage preferences</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const PROD_EMAIL_TEMPLATES: Array<{
    templateKey: string;
    subject: string;
    description: string;
    /** Variables list documented in description for admin reference; the runtime renderer enforces required vars elsewhere. */
    variables: string[];
    bodyHtml: string;
    bodyText: string;
  }> = [
    {
      templateKey: 'otp.send',
      subject: 'Your E-Visa Global verification code',
      description: 'OTP code emailed to portal users during login + email verification flows. Variables: otpCode, expiresInMinutes',
      variables: ['otpCode', 'expiresInMinutes'],
      bodyHtml: wrap(
        'Your verification code',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Verification code / Təsdiq kodu</h1>
        <p>Your one-time code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;background-color:#f3f4f6;padding:16px 24px;border-radius:6px;text-align:center;margin:16px 0;">{{otpCode}}</p>
        <p>This code expires in <strong>{{expiresInMinutes}} minutes</strong>. If you did not request it, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">Birdəfəlik kodunuz: <strong>{{otpCode}}</strong>. Bu kod <strong>{{expiresInMinutes}} dəqiqə</strong> ərzində etibarlıdır.</p>`,
      ),
      bodyText: `Your E-Visa Global verification code\n\nYour one-time code: {{otpCode}}\nThis code expires in {{expiresInMinutes}} minutes.\n\nIf you did not request it, you can safely ignore this email.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.created',
      subject: 'Application started — {{applicationCode}}',
      description: 'Sent immediately after an applicant creates a draft application. Variables: userName, applicationCode, destinationCountry',
      variables: ['userName', 'applicationCode', 'destinationCountry'],
      bodyHtml: wrap(
        'Application started',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Hello {{userName}},</h1>
        <p>You've started an application for a visa to <strong>{{destinationCountry}}</strong>.</p>
        <p>Your application reference is:</p>
        <p style="font-size:18px;font-weight:600;color:#0f172a;background-color:#f3f4f6;padding:12px 16px;border-radius:6px;text-align:center;margin:16px 0;">{{applicationCode}}</p>
        <p>You can complete your application at any time using this reference. The application stays in <strong>Draft</strong> status until you submit it for review and pay the visa fee.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">Salam {{userName}}, <strong>{{destinationCountry}}</strong> üçün viza müraciətinizi başlatdınız. Müraciət nömrəniz: <strong>{{applicationCode}}</strong>.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nYou've started an application for a visa to {{destinationCountry}}.\n\nApplication reference: {{applicationCode}}\n\nYou can return to complete it any time. Your application stays in Draft until you submit and pay the fee.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.submitted',
      subject: 'Application submitted for review — {{applicationCode}}',
      description: 'Sent when applicant pays + submits. Variables: userName, applicationCode',
      variables: ['userName', 'applicationCode'],
      bodyHtml: wrap(
        'Submitted for review',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Submitted for review</h1>
        <p>Hello {{userName}},</p>
        <p>Your application <strong>{{applicationCode}}</strong> has been received and is now under review by our team.</p>
        <p>You will receive an update by email once a decision is made — typically within 1–5 business days depending on the destination.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">Müraciətiniz <strong>{{applicationCode}}</strong> qəbul olundu və komandamız tərəfindən nəzərdən keçirilir.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nYour application {{applicationCode}} has been submitted and is now under review.\n\nYou'll receive an email once a decision is made — typically within 1-5 business days.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.approved',
      subject: '✓ Visa approved — {{applicationCode}}',
      description: 'Sent on approve action. Variables: userName, applicationCode, destinationCountry',
      variables: ['userName', 'applicationCode', 'destinationCountry'],
      bodyHtml: wrap(
        'Visa approved',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#059669;">Your visa has been approved 🎉</h1>
        <p>Hello {{userName}},</p>
        <p>Your application <strong>{{applicationCode}}</strong> for entry to <strong>{{destinationCountry}}</strong> has been <strong style="color:#059669;">APPROVED</strong>.</p>
        <p>Your e-Visa is now ready to download from your portal account. Please print a copy and present it with your passport at the port of entry.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="{{downloadUrl|https://evisaglobal.com/me}}" style="display:inline-block;background-color:#059669;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Open my account</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;"><strong>{{destinationCountry}}</strong> vizasınız təsdiq edildi. e-Vizanı portal hesabınızdan yükləyə bilərsiniz.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nGreat news — your application {{applicationCode}} for {{destinationCountry}} has been APPROVED.\n\nYour e-Visa is ready to download from your portal account. Please print and present it with your passport at the port of entry.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.rejected',
      subject: 'Application decision — {{applicationCode}}',
      description: 'Sent on reject action. Variables: userName, applicationCode, rejectionReason',
      variables: ['userName', 'applicationCode', 'rejectionReason'],
      bodyHtml: wrap(
        'Application decision',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Application decision</h1>
        <p>Hello {{userName}},</p>
        <p>We regret to inform you that your application <strong>{{applicationCode}}</strong> has not been approved.</p>
        <p style="background-color:#fef2f2;border:1px solid #fecaca;padding:16px;border-radius:6px;color:#991b1b;"><strong>Reason:</strong> {{rejectionReason}}</p>
        <p>You may submit a new application addressing the issue above. Application fees are non-refundable per our terms of service.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">Müraciətiniz təsdiq edilmədi. Səbəb: {{rejectionReason}}.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nWe regret to inform you that your application {{applicationCode}} has not been approved.\n\nReason: {{rejectionReason}}\n\nYou may submit a new application addressing the issue. Fees are non-refundable per our terms of service.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.need_docs',
      subject: 'Additional documents requested — {{applicationCode}}',
      description: 'Sent on request-documents action. Variables: userName, applicationCode, requestedDocuments, adminNote',
      variables: ['userName', 'applicationCode', 'requestedDocuments', 'adminNote'],
      bodyHtml: wrap(
        'Additional documents needed',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Additional documents needed</h1>
        <p>Hello {{userName}},</p>
        <p>Our reviewer needs additional documentation to continue processing application <strong>{{applicationCode}}</strong>.</p>
        <p style="background-color:#fffbeb;border:1px solid #fde68a;padding:16px;border-radius:6px;color:#92400e;"><strong>Requested:</strong> {{requestedDocuments}}<br/><br/><strong>Reviewer note:</strong> {{adminNote}}</p>
        <p>Please return to your application and upload the requested documents. Once received, your application returns to the review queue.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="https://evisaglobal.com/me" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Upload documents</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">Müraciət üçün əlavə sənədlər tələb olunur: {{requestedDocuments}}.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nOur reviewer needs additional documentation for application {{applicationCode}}.\n\nRequested: {{requestedDocuments}}\nReviewer note: {{adminNote}}\n\nPlease return to your portal account and upload the requested documents.\n\n— E-Visa Global team`,
    },
    {
      templateKey: 'application.ready_to_download',
      subject: 'Your e-Visa is ready — {{applicationCode}}',
      description: 'Sent when approved e-Visa PDF is ready. Variables: userName, applicationCode, downloadUrl',
      variables: ['userName', 'applicationCode', 'downloadUrl'],
      bodyHtml: wrap(
        'Your e-Visa is ready',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Your e-Visa is ready</h1>
        <p>Hello {{userName}},</p>
        <p>Your e-Visa for application <strong>{{applicationCode}}</strong> is ready to download.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="{{downloadUrl}}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-weight:600;padding:14px 28px;border-radius:6px;text-decoration:none;">Download e-Visa PDF</a>
        </p>
        <p>Please print a copy and carry it with your passport at all times during your trip.</p>
        <p style="font-size:13px;color:#6b7280;background-color:#f9fafb;padding:12px;border-radius:6px;">⚠️ <strong>Tip:</strong> save the PDF to your phone as a backup, but immigration authorities at the port of entry may require a printed copy.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">e-Vizanız hazırdır. Səfər zamanı çap edilmiş nüsxəni pasportla birlikdə daşımağınız tövsiyə olunur.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nYour e-Visa for application {{applicationCode}} is ready.\n\nDownload: {{downloadUrl}}\n\nPlease print a copy and carry it with your passport at all times during your trip.\n\n— E-Visa Global team`,
    },
    {
      // M9b — fires when a customer resubmits documents the admin
      // requested. Goes to the admin team mailbox (resolved at send
      // time from Setting.supportEmail), NOT the customer.
      templateKey: 'application.documents.resubmitted',
      subject: 'Customer resubmitted documents — {{applicationCode}}',
      description:
        'Sent to the admin team when a customer uploads the requested documents and the application returns to SUBMITTED. Variables: adminName, applicationCode, applicantNames, documentsList, appLink',
      variables: ['adminName', 'applicationCode', 'applicantNames', 'documentsList', 'appLink'],
      bodyHtml: wrap(
        'Documents resubmitted',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Customer resubmitted documents</h1>
        <p>Hi {{adminName}},</p>
        <p>The customer has resubmitted the documents you requested for application <strong>{{applicationCode}}</strong>. The application is now back in the review queue.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:16px 0;">
          <tr><td style="padding:12px 16px;color:#6b7280;width:140px;">Applicant(s)</td><td style="padding:12px 16px;font-weight:600;color:#0f172a;">{{applicantNames}}</td></tr>
          <tr><td style="padding:12px 16px;color:#6b7280;border-top:1px solid #e5e7eb;">Resubmitted</td><td style="padding:12px 16px;font-weight:600;color:#0f172a;border-top:1px solid #e5e7eb;">{{documentsList}}</td></tr>
        </table>
        <p style="text-align:center;margin:24px 0;">
          <a href="{{appLink}}" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Open application in admin</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">{{applicationCode}} — müştəri tələb olunan sənədləri yenidən təqdim etdi: {{documentsList}}.</p>`,
      ),
      bodyText: `Hi {{adminName}},\n\nThe customer has resubmitted the documents you requested for application {{applicationCode}}. The application is now back in the review queue.\n\nApplicant(s): {{applicantNames}}\nResubmitted: {{documentsList}}\n\nOpen in admin: {{appLink}}\n\n— E-Visa Global system`,
    },
    {
      templateKey: 'payment.success',
      subject: 'Payment confirmed — {{applicationCode}}',
      description: 'Sent when payment provider confirms a successful transaction. Variables: userName, applicationCode, amount, currency',
      variables: ['userName', 'applicationCode', 'amount', 'currency'],
      bodyHtml: wrap(
        'Payment confirmed',
        `<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Payment received</h1>
        <p>Hello {{userName}},</p>
        <p>We've received your payment for application <strong>{{applicationCode}}</strong>:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:16px 0;">
          <tr><td style="padding:12px 16px;color:#6b7280;">Amount</td><td style="padding:12px 16px;font-weight:600;text-align:right;color:#0f172a;">{{amount}} {{currency}}</td></tr>
          <tr><td style="padding:12px 16px;color:#6b7280;border-top:1px solid #e5e7eb;">Application</td><td style="padding:12px 16px;font-weight:600;text-align:right;color:#0f172a;border-top:1px solid #e5e7eb;">{{applicationCode}}</td></tr>
        </table>
        <p>Your application has now been submitted for review.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;">{{amount}} {{currency}} ödənişiniz qəbul olundu. Müraciətiniz indi nəzərdən keçirilir.</p>`,
      ),
      bodyText: `Hello {{userName}},\n\nWe've received your payment of {{amount}} {{currency}} for application {{applicationCode}}.\n\nYour application is now submitted for review.\n\n— E-Visa Global team`,
    },
  ];

  let createdEmailTemplates = 0,
    skippedEmailTemplates = 0;
  for (const t of PROD_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { templateKey: t.templateKey },
    });
    if (existing) {
      skippedEmailTemplates++;
      continue;
    }
    await prisma.emailTemplate.create({
      data: {
        templateKey: t.templateKey,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        description: `${t.description} | Variables: ${t.variables.join(', ')}`,
        isActive: true,
      },
    });
    createdEmailTemplates++;
    console.log(`  ✅ ${t.templateKey} (vars: ${t.variables.join(', ')})`);
  }
  console.log(
    `     prod email templates: ${createdEmailTemplates} new + ${skippedEmailTemplates} preserved`,
  );

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

  // ===========================================
  // Sprint 1 / Task A — production form templates
  // ===========================================
  // 3 real-shape templates with full section + field hierarchy:
  //   • tourismStandardV1   — 5 sections, 19 fields, 1 conditional
  //   • businessStandardV1  — 7 sections, 27 fields, 1 conditional
  //   • transitSimpleV1     — 4 sections, 10 fields
  //
  // Each template / section / field is upserted by its compound natural
  // key (unique constraints in schema), so re-runs heal drift without
  // duplicating rows. Conditional visibility uses `visibilityRulesJson`
  // — the public form renderer will hide a field unless its source
  // field matches the declared `equals` value.
  console.log('\n📝 Form templates (production v1 — 3 templates):');

  type TemplateFieldSpec = {
    fieldKey: string;
    fieldType: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    isRequired: boolean;
    sortOrder: number;
    optionsJson?: unknown;
    validationRulesJson?: unknown;
    visibilityRulesJson?: unknown;
  };
  type TemplateSectionSpec = {
    key: string;
    title: string;
    description?: string;
    sortOrder: number;
    fields: TemplateFieldSpec[];
  };
  type TemplateSpec = {
    key: string;
    name: string;
    description: string;
    version: number;
    sections: TemplateSectionSpec[];
  };

  // Common reusable field building blocks (kept inline for readability).
  // The conditional visibility rule shape consumed by the renderer is:
  //   { mode: 'show', when: { field: '<otherFieldKey>', equals: <value> } }
  // (mode 'hide' also supported; absence of rule = always visible.)
  const yesNoOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];
  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other / Prefer not to say' },
  ];
  const accommodationOptions = [
    { value: 'hotel', label: 'Hotel' },
    { value: 'airbnb', label: 'Airbnb / short-term rental' },
    { value: 'family', label: 'Staying with family / friends' },
    { value: 'other', label: 'Other' },
  ];

  const TEMPLATES: TemplateSpec[] = [
    // ──────────────────────────────────────────────────────────
    // Template 1: tourismStandardV1 — Standard Tourism Form
    // ──────────────────────────────────────────────────────────
    {
      key: 'tourismStandardV1',
      name: 'Standard Tourism Form',
      description: 'Production form for tourist e-Visa applications. 5 sections, 19 fields, 1 conditional (otherPassportNumber).',
      version: 1,
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          description: 'Applicant identity details — must match the passport bio page exactly.',
          sortOrder: 0,
          fields: [
            { fieldKey: 'firstName',     fieldType: 'text',   label: 'First Name (Given)',  placeholder: 'As shown on passport', isRequired: true, sortOrder: 0, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'lastName',      fieldType: 'text',   label: 'Last Name (Family)',  placeholder: 'As shown on passport', isRequired: true, sortOrder: 1, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'dateOfBirth',   fieldType: 'date',   label: 'Date of Birth',       isRequired: true, sortOrder: 2, validationRulesJson: { min: '1900-01-01', max: '2026-01-01' } },
            { fieldKey: 'gender',        fieldType: 'select', label: 'Gender',              isRequired: true, sortOrder: 3, optionsJson: genderOptions },
            { fieldKey: 'nationality',   fieldType: 'country',label: 'Nationality',         helpText: 'Passport-issuing country', isRequired: true, sortOrder: 4 },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          description: 'Travel document data — verify expiry date carefully (most countries require 6 months validity).',
          sortOrder: 1,
          fields: [
            { fieldKey: 'passportNumber',     fieldType: 'text',   label: 'Passport Number', placeholder: 'e.g. AZ12345678', isRequired: true, sortOrder: 0, validationRulesJson: { pattern: '^[A-Z0-9]{6,12}$', message: 'Use 6–12 uppercase letters or digits' } },
            { fieldKey: 'passportIssueDate',  fieldType: 'date',   label: 'Passport Issue Date',                            isRequired: true, sortOrder: 1 },
            { fieldKey: 'passportExpiryDate', fieldType: 'date',   label: 'Passport Expiry Date', helpText: 'Must be valid for at least 6 months after planned arrival', isRequired: true, sortOrder: 2 },
            { fieldKey: 'issuingCountry',     fieldType: 'country',label: 'Issuing Country',                                  isRequired: true, sortOrder: 3 },
            { fieldKey: 'hasOtherPassport',   fieldType: 'radio',  label: 'Do you hold another nationality / passport?',     isRequired: true, sortOrder: 4, optionsJson: yesNoOptions },
            // Conditional field — shown only when the radio above is "yes".
            // Renderer reads `visibilityRulesJson` and hides the field
            // server-rendered + client-rendered until the predicate matches.
            { fieldKey: 'otherPassportNumber', fieldType: 'text',  label: 'Other Passport Number', placeholder: 'Enter the second passport number', isRequired: false, sortOrder: 5,
              validationRulesJson: { pattern: '^[A-Z0-9]{6,12}$', message: 'Use 6–12 uppercase letters or digits' },
              visibilityRulesJson: { mode: 'show', when: { field: 'hasOtherPassport', equals: 'yes' } },
            },
          ],
        },
        {
          key: 'travel',
          title: 'Travel Information',
          sortOrder: 2,
          fields: [
            { fieldKey: 'arrivalDate',          fieldType: 'date',     label: 'Planned Arrival Date',  isRequired: true, sortOrder: 0 },
            { fieldKey: 'departureDate',        fieldType: 'date',     label: 'Planned Departure Date',isRequired: true, sortOrder: 1 },
            { fieldKey: 'accommodationType',    fieldType: 'select',   label: 'Accommodation Type',    isRequired: true, sortOrder: 2, optionsJson: accommodationOptions },
            { fieldKey: 'accommodationAddress', fieldType: 'textarea', label: 'Accommodation Address', placeholder: 'Hotel name + full address, or host address', isRequired: true, sortOrder: 3, validationRulesJson: { minLength: 10, maxLength: 500 } },
            { fieldKey: 'purposeOfVisit',       fieldType: 'textarea', label: 'Purpose of Visit',      placeholder: 'Describe your trip in 2-3 sentences', isRequired: true, sortOrder: 4, validationRulesJson: { minLength: 20, maxLength: 1000 } },
          ],
        },
        {
          key: 'contact',
          title: 'Contact Information',
          sortOrder: 3,
          fields: [
            { fieldKey: 'email',                fieldType: 'email', label: 'Email',                  isRequired: true, sortOrder: 0 },
            { fieldKey: 'phone',                fieldType: 'phone', label: 'Phone',                  helpText: 'Include country code, e.g. +994501234567', isRequired: true, sortOrder: 1 },
            { fieldKey: 'emergencyContactName', fieldType: 'text',  label: 'Emergency Contact Name', isRequired: true, sortOrder: 2, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'emergencyContactPhone',fieldType: 'phone', label: 'Emergency Contact Phone',isRequired: true, sortOrder: 3 },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          description: 'Upload required attachments. Photo must be passport-style (light background, neutral expression, no headwear unless religious).',
          sortOrder: 4,
          fields: [
            { fieldKey: 'passportScan',  fieldType: 'file', label: 'Passport Bio Page Scan', isRequired: true, sortOrder: 0, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
            { fieldKey: 'passportPhoto', fieldType: 'file', label: 'Passport Photo',        isRequired: true, sortOrder: 1, validationRulesJson: { accept: ['image/jpeg', 'image/png'], maxSizeMb: 5 } },
            { fieldKey: 'hotelBooking',  fieldType: 'file', label: 'Hotel Booking (optional)', isRequired: false, sortOrder: 2, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
            { fieldKey: 'returnTicket',  fieldType: 'file', label: 'Return Ticket (optional)', isRequired: false, sortOrder: 3, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────────────────
    // Template 2: businessStandardV1 — Business Visa Form
    // ──────────────────────────────────────────────────────────
    {
      key: 'businessStandardV1',
      name: 'Business Visa Form',
      description: 'Production form for business e-Visa applications. Tourism base + Business Details + Additional Documents (invitation letter required).',
      version: 1,
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          sortOrder: 0,
          fields: [
            { fieldKey: 'firstName',   fieldType: 'text',   label: 'First Name (Given)',  isRequired: true, sortOrder: 0, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'lastName',    fieldType: 'text',   label: 'Last Name (Family)',  isRequired: true, sortOrder: 1, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'dateOfBirth', fieldType: 'date',   label: 'Date of Birth',       isRequired: true, sortOrder: 2 },
            { fieldKey: 'gender',      fieldType: 'select', label: 'Gender',              isRequired: true, sortOrder: 3, optionsJson: genderOptions },
            { fieldKey: 'nationality', fieldType: 'country',label: 'Nationality',         isRequired: true, sortOrder: 4 },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          sortOrder: 1,
          fields: [
            { fieldKey: 'passportNumber',      fieldType: 'text',   label: 'Passport Number',      isRequired: true, sortOrder: 0, validationRulesJson: { pattern: '^[A-Z0-9]{6,12}$' } },
            { fieldKey: 'passportIssueDate',   fieldType: 'date',   label: 'Passport Issue Date',  isRequired: true, sortOrder: 1 },
            { fieldKey: 'passportExpiryDate',  fieldType: 'date',   label: 'Passport Expiry Date', isRequired: true, sortOrder: 2 },
            { fieldKey: 'issuingCountry',      fieldType: 'country',label: 'Issuing Country',      isRequired: true, sortOrder: 3 },
            { fieldKey: 'hasOtherPassport',    fieldType: 'radio',  label: 'Do you hold another nationality / passport?', isRequired: true, sortOrder: 4, optionsJson: yesNoOptions },
            { fieldKey: 'otherPassportNumber', fieldType: 'text',   label: 'Other Passport Number', isRequired: false, sortOrder: 5,
              validationRulesJson: { pattern: '^[A-Z0-9]{6,12}$' },
              visibilityRulesJson: { mode: 'show', when: { field: 'hasOtherPassport', equals: 'yes' } },
            },
          ],
        },
        {
          key: 'business',
          title: 'Business Details',
          description: 'Information about your employer and the inviting organisation.',
          sortOrder: 2,
          fields: [
            { fieldKey: 'companyName',           fieldType: 'text',     label: 'Your Company Name',         isRequired: true, sortOrder: 0, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'position',              fieldType: 'text',     label: 'Your Position / Title',     isRequired: true, sortOrder: 1, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'invitingCompany',       fieldType: 'text',     label: 'Inviting Company',          helpText: 'Full legal name of the host organisation', isRequired: true, sortOrder: 2, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'invitingCompanyAddress',fieldType: 'textarea', label: 'Inviting Company Address',  isRequired: true, sortOrder: 3, validationRulesJson: { minLength: 10, maxLength: 500 } },
            { fieldKey: 'invitationLetterDate',  fieldType: 'date',     label: 'Invitation Letter Date',    isRequired: true, sortOrder: 4 },
            { fieldKey: 'businessPurpose',       fieldType: 'textarea', label: 'Business Purpose',          placeholder: 'Meetings, conferences, contract negotiation, etc.', isRequired: true, sortOrder: 5, validationRulesJson: { minLength: 20, maxLength: 1000 } },
          ],
        },
        {
          key: 'travel',
          title: 'Travel Information',
          sortOrder: 3,
          fields: [
            { fieldKey: 'arrivalDate',          fieldType: 'date',     label: 'Planned Arrival Date',   isRequired: true, sortOrder: 0 },
            { fieldKey: 'departureDate',        fieldType: 'date',     label: 'Planned Departure Date', isRequired: true, sortOrder: 1 },
            { fieldKey: 'accommodationType',    fieldType: 'select',   label: 'Accommodation Type',     isRequired: true, sortOrder: 2, optionsJson: accommodationOptions },
            { fieldKey: 'accommodationAddress', fieldType: 'textarea', label: 'Accommodation Address',  isRequired: true, sortOrder: 3, validationRulesJson: { minLength: 10, maxLength: 500 } },
          ],
        },
        {
          key: 'contact',
          title: 'Contact Information',
          sortOrder: 4,
          fields: [
            { fieldKey: 'email',                 fieldType: 'email', label: 'Email',                   isRequired: true, sortOrder: 0 },
            { fieldKey: 'phone',                 fieldType: 'phone', label: 'Phone',                   isRequired: true, sortOrder: 1 },
            { fieldKey: 'emergencyContactName',  fieldType: 'text',  label: 'Emergency Contact Name',  isRequired: true, sortOrder: 2 },
            { fieldKey: 'emergencyContactPhone', fieldType: 'phone', label: 'Emergency Contact Phone', isRequired: true, sortOrder: 3 },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          sortOrder: 5,
          fields: [
            { fieldKey: 'passportScan',  fieldType: 'file', label: 'Passport Bio Page Scan', isRequired: true, sortOrder: 0, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
            { fieldKey: 'passportPhoto', fieldType: 'file', label: 'Passport Photo',         isRequired: true, sortOrder: 1, validationRulesJson: { accept: ['image/jpeg', 'image/png'], maxSizeMb: 5 } },
          ],
        },
        {
          key: 'additionalDocuments',
          title: 'Additional Documents',
          description: 'Mandatory supporting documents specific to business travel.',
          sortOrder: 6,
          fields: [
            { fieldKey: 'invitationLetter', fieldType: 'file', label: 'Invitation Letter',  helpText: 'Signed letter on company letterhead from inviting organisation', isRequired: true, sortOrder: 0, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 10 } },
            { fieldKey: 'businessLicense',  fieldType: 'file', label: 'Business License',   helpText: 'Either your employer’s or the inviting company’s registration certificate', isRequired: true, sortOrder: 1, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 10 } },
            { fieldKey: 'returnTicket',     fieldType: 'file', label: 'Return Ticket',      isRequired: false, sortOrder: 2, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────────────────
    // Template 3: transitSimpleV1 — Transit Visa Form (slim)
    // ──────────────────────────────────────────────────────────
    {
      key: 'transitSimpleV1',
      name: 'Transit Visa Form',
      description: 'Slim form for short-stay transit visas (typically 5-day max). Skips accommodation + emergency contact (not relevant for transit).',
      version: 1,
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          sortOrder: 0,
          fields: [
            { fieldKey: 'firstName',   fieldType: 'text',   label: 'First Name', isRequired: true, sortOrder: 0, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'lastName',    fieldType: 'text',   label: 'Last Name',  isRequired: true, sortOrder: 1, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'dateOfBirth', fieldType: 'date',   label: 'Date of Birth', isRequired: true, sortOrder: 2 },
            { fieldKey: 'nationality', fieldType: 'country',label: 'Nationality', isRequired: true, sortOrder: 3 },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          sortOrder: 1,
          fields: [
            { fieldKey: 'passportNumber',     fieldType: 'text', label: 'Passport Number', isRequired: true, sortOrder: 0, validationRulesJson: { pattern: '^[A-Z0-9]{6,12}$' } },
            { fieldKey: 'passportExpiryDate', fieldType: 'date', label: 'Passport Expiry Date', helpText: 'Must be valid for at least 6 months after transit', isRequired: true, sortOrder: 1 },
          ],
        },
        {
          key: 'transit',
          title: 'Transit Details',
          sortOrder: 2,
          fields: [
            { fieldKey: 'originCountry',      fieldType: 'country', label: 'Departing From',          isRequired: true, sortOrder: 0 },
            { fieldKey: 'destinationCountry', fieldType: 'country', label: 'Final Destination',       isRequired: true, sortOrder: 1 },
            { fieldKey: 'transitDate',        fieldType: 'date',    label: 'Transit Date',            isRequired: true, sortOrder: 2 },
            { fieldKey: 'transitDuration',    fieldType: 'number',  label: 'Transit Duration (hours)', isRequired: true, sortOrder: 3, validationRulesJson: { min: 1, max: 120 } },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          sortOrder: 3,
          fields: [
            { fieldKey: 'passportScan',  fieldType: 'file', label: 'Passport Bio Page Scan', isRequired: true, sortOrder: 0, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
            { fieldKey: 'onwardTicket',  fieldType: 'file', label: 'Onward Ticket',          helpText: 'Confirmed flight ticket leaving the transit country', isRequired: true, sortOrder: 1, validationRulesJson: { accept: ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb: 5 } },
          ],
        },
      ],
    },
  ];

  // Idempotent template upsert: walks the spec tree and uses the
  // schema's compound unique constraints at each level.
  // Counters keep the seed log honest about new vs preserved rows.
  const templateIdsByKey: Record<string, string> = {};
  let createdTemplates = 0,
    updatedTemplates = 0,
    createdSectionsT = 0,
    skippedSectionsT = 0,
    createdFields = 0,
    skippedFields = 0;

  for (const t of TEMPLATES) {
    const existingTpl = await prisma.template.findUnique({ where: { key: t.key } });
    const tpl = await prisma.template.upsert({
      where: { key: t.key },
      // Update path keeps name/description/version fresh — these are
      // canonical metadata, not admin-edited field copy.
      update: { name: t.name, description: t.description, version: t.version, isActive: true },
      create: { key: t.key, name: t.name, description: t.description, version: t.version, isActive: true },
    });
    templateIdsByKey[t.key] = tpl.id;
    if (existingTpl) updatedTemplates++;
    else createdTemplates++;

    for (const s of t.sections) {
      // Sections: composite unique (templateId, key). Update non-id
      // metadata on re-run — title / description are spec-driven.
      const existingSec = await prisma.templateSection.findUnique({
        where: { templateId_key: { templateId: tpl.id, key: s.key } },
      });
      const section = await prisma.templateSection.upsert({
        where: { templateId_key: { templateId: tpl.id, key: s.key } },
        update: { title: s.title, description: s.description, sortOrder: s.sortOrder, isActive: true },
        create: {
          templateId: tpl.id,
          key: s.key,
          title: s.title,
          description: s.description,
          sortOrder: s.sortOrder,
          isActive: true,
        },
      });
      if (existingSec) skippedSectionsT++;
      else createdSectionsT++;

      for (const f of s.fields) {
        // Fields: composite unique (templateSectionId, fieldKey).
        // Update path refreshes label / help / validation / visibility
        // / options / required so the spec tree is the source of truth.
        const existingField = await prisma.templateField.findUnique({
          where: { templateSectionId_fieldKey: { templateSectionId: section.id, fieldKey: f.fieldKey } },
        });
        await prisma.templateField.upsert({
          where: { templateSectionId_fieldKey: { templateSectionId: section.id, fieldKey: f.fieldKey } },
          update: {
            fieldType: f.fieldType,
            label: f.label,
            placeholder: f.placeholder ?? null,
            helpText: f.helpText ?? null,
            isRequired: f.isRequired,
            sortOrder: f.sortOrder,
            isActive: true,
            optionsJson: (f.optionsJson as any) ?? null,
            validationRulesJson: (f.validationRulesJson as any) ?? null,
            visibilityRulesJson: (f.visibilityRulesJson as any) ?? null,
          },
          create: {
            templateSectionId: section.id,
            fieldKey: f.fieldKey,
            fieldType: f.fieldType,
            label: f.label,
            placeholder: f.placeholder,
            helpText: f.helpText,
            isRequired: f.isRequired,
            sortOrder: f.sortOrder,
            isActive: true,
            optionsJson: (f.optionsJson as any) ?? undefined,
            validationRulesJson: (f.validationRulesJson as any) ?? undefined,
            visibilityRulesJson: (f.visibilityRulesJson as any) ?? undefined,
          },
        });
        if (existingField) skippedFields++;
        else createdFields++;
      }
    }
    console.log(
      `  ✅ ${t.key} — ${t.sections.length} sections, ${t.sections.reduce((n, s) => n + s.fields.length, 0)} fields`,
    );
  }
  console.log(
    `     templates: ${createdTemplates} new + ${updatedTemplates} refreshed | sections: ${createdSectionsT} new + ${skippedSectionsT} updated | fields: ${createdFields} new + ${skippedFields} updated`,
  );

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

  // ===========================================
  // Sprint 1 / Task A — production bindings + per-nationality fees
  // ===========================================
  // Plan: 11 bindings spanning the 12 active destinations × 3 visa
  // types (tourism / business / transit). The existing TR+tourism
  // binding above keeps test-tourism template (preserved — admin may
  // have applications referencing it). All new bindings point at the
  // production templates seeded in this pack.
  //
  // Each binding gets 5 nationality fees (AZ, RU, UA, KZ, UZ).
  // Tourism/business use the standard fee table; transit halves both
  // government and service fees per Sprint 1 brief. Expedited fee
  // applies to business bindings only (`expeditedEnabled=true`).
  console.log('\n🔗 Production template bindings + nationality fees:');

  const NATIONALITY_FEES_STD = [
    { iso: 'AZ', gov: 25, svc: 15 },
    { iso: 'RU', gov: 40, svc: 20 },
    { iso: 'UA', gov: 35, svc: 20 },
    { iso: 'KZ', gov: 30, svc: 15 },
    { iso: 'UZ', gov: 30, svc: 15 },
  ];
  const NATIONALITY_FEES_TRANSIT = [
    { iso: 'AZ', gov: 12.5, svc: 7.5 },
    { iso: 'RU', gov: 20, svc: 10 },
    { iso: 'UA', gov: 17.5, svc: 10 },
    { iso: 'KZ', gov: 15, svc: 7.5 },
    { iso: 'UZ', gov: 15, svc: 7.5 },
  ];

  type BindingPlan = {
    destIso: string;
    visaPurpose: 'tourism' | 'business' | 'transit';
    templateKey: string;
  };
  const BINDING_PLAN: BindingPlan[] = [
    // tourismStandardV1 — 7 destinations (TR already has test-tourism, skip)
    { destIso: 'AE', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    { destIso: 'EG', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    { destIso: 'TH', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    { destIso: 'GE', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    { destIso: 'VN', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    { destIso: 'LK', visaPurpose: 'tourism',  templateKey: 'tourismStandardV1' },
    // businessStandardV1 — 3 destinations
    { destIso: 'TR', visaPurpose: 'business', templateKey: 'businessStandardV1' },
    { destIso: 'AE', visaPurpose: 'business', templateKey: 'businessStandardV1' },
    { destIso: 'EG', visaPurpose: 'business', templateKey: 'businessStandardV1' },
    // transitSimpleV1 — 2 destinations
    { destIso: 'TR', visaPurpose: 'transit',  templateKey: 'transitSimpleV1' },
    { destIso: 'AE', visaPurpose: 'transit',  templateKey: 'transitSimpleV1' },
  ];

  let createdBindings = 0,
    skippedBindings = 0,
    createdFees = 0,
    skippedFees = 0;

  for (const plan of BINDING_PLAN) {
    const destId = countryIds[plan.destIso];
    const visaTypeId = visaTypeIds[plan.visaPurpose];
    const tplId = templateIdsByKey[plan.templateKey];
    if (!destId || !visaTypeId || !tplId) {
      console.log(
        `  ⚠️  skip ${plan.destIso}+${plan.visaPurpose}+${plan.templateKey} — missing reference id`,
      );
      continue;
    }

    // Bindings: composite unique (destinationCountryId, visaTypeId).
    // INSERT IF MISSING — never overwrite an existing binding's
    // templateId, since live applications reference the binding and
    // re-pointing the template would break them.
    const existingBinding = await prisma.templateBinding.findUnique({
      where: { destinationCountryId_visaTypeId: { destinationCountryId: destId, visaTypeId } },
    });
    let bindingRow;
    if (existingBinding) {
      bindingRow = existingBinding;
      skippedBindings++;
    } else {
      bindingRow = await prisma.templateBinding.create({
        data: {
          destinationCountryId: destId,
          visaTypeId,
          templateId: tplId,
          isActive: true,
        },
      });
      createdBindings++;
    }

    // Fees: composite unique (templateBindingId, nationalityCountryId).
    // Per-nationality table per Sprint 1 brief; transit uses halved
    // schedule; expedited only enabled for business.
    const feeTable =
      plan.visaPurpose === 'transit' ? NATIONALITY_FEES_TRANSIT : NATIONALITY_FEES_STD;
    const isExpeditedEnabled = plan.visaPurpose === 'business';
    const expeditedAmount = isExpeditedEnabled ? 50 : null;

    for (const f of feeTable) {
      const natId = countryIds[f.iso];
      if (!natId) {
        console.log(`     ⚠️  nationality ${f.iso} not found`);
        continue;
      }
      const existingFee = await prisma.bindingNationalityFee.findUnique({
        where: {
          templateBindingId_nationalityCountryId: {
            templateBindingId: bindingRow.id,
            nationalityCountryId: natId,
          },
        },
      });
      if (existingFee) {
        skippedFees++;
        continue;
      }
      await prisma.bindingNationalityFee.create({
        data: {
          templateBindingId: bindingRow.id,
          nationalityCountryId: natId,
          governmentFeeAmount: f.gov,
          serviceFeeAmount: f.svc,
          expeditedFeeAmount: expeditedAmount ?? undefined,
          currencyCode: 'USD',
          expeditedEnabled: isExpeditedEnabled,
          isActive: true,
        },
      });
      createdFees++;
    }
    console.log(
      `  ✅ ${plan.destIso}+${plan.visaPurpose} → ${plan.templateKey}` +
        (existingBinding ? ' (binding exists)' : '') +
        ` — fees +${feeTable.length}`,
    );
  }
  console.log(
    `     bindings: ${createdBindings} new + ${skippedBindings} preserved | fees: ${createdFees} new + ${skippedFees} preserved`,
  );

  // J. Settings (singleton) — findFirst + create.
  console.log('\n⚙️  Settings (singleton):');
  const existingSetting = await prisma.setting.findFirst();
  if (existingSetting) {
    console.log(`  ⏭️  Settings exist`);
  } else {
    await prisma.setting.create({
      data: {
        // Real brand for the production environment. Service-level
        // first-create fallbacks (when seed never ran) use generic
        // placeholders — DO NOT mirror evisaglobal.com into business
        // logic; this seed is the single source of truth for the
        // production brand identity.
        siteName: 'E-Visa Global',
        siteUrl: 'https://evisaglobal.com',
        supportEmail: 'support@evisaglobal.com',
        defaultCurrency: 'USD',
        paymentTimeoutHours: 3,
        smtpFromAddress: 'noreply@evisaglobal.com',
        smtpFromName: 'E-Visa Global',
        notificationEmailEnabled: true,
        applicationCodeFormat: 'EV-{YYYY}-{NNNN}',
        maxApplicantsPerApplication: 10,
        allowMultipleVisaTypes: false,
        maintenanceMode: false,
        // termsUrl / privacyUrl / logoUrl / faviconUrl /
        // googleAnalyticsId / maintenanceMessage stay null until the
        // admin sets them via the Module 4 UI.
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

  console.log('\n📊 Sprint 1 / Task A — production seed tally (target):');
  console.log('─'.repeat(60));
  console.log(`  Countries (UN reference):       250  (ISO 3166-1 alpha-2 reference)`);
  console.log(`  Country pages (publishable):    13   (TR/AZ/AE legacy + 10 new destinations)`);
  console.log(`  Country sections:               20   (5 destinations × 4 sections, real bilingual content)`);
  console.log(`  Visa types:                     5    (tourism, business, transit, student, medical)`);
  console.log(`  Email templates:                10   (2 legacy snake_case + 8 new dot-case)`);
  console.log(`  Form templates:                 4    (test-tourism legacy + 3 production v1)`);
  console.log(`  Template sections:              ~17  (1 legacy + 16 across 3 production templates)`);
  console.log(`  Template fields:                ~58  (2 legacy + 56 across 3 production templates)`);
  console.log(`  Template bindings:              12   (1 legacy TR+tourism + 11 production)`);
  console.log(`  Binding nationality fees:       57   (2 legacy + 55 across 11 production bindings × 5 nationalities)`);
  console.log(`  Settings (singleton):           1`);
  console.log(`  Payment page config (singleton):1`);
  console.log('─'.repeat(60));
  console.log(`  Total config rows (excl. countries reference): ~198`);
  console.log('─'.repeat(60));

  // ───────────────────────────────────────────────────────────
  // M11.B — Default CMS content (5 pages + contact + 10 FAQs)
  // ───────────────────────────────────────────────────────────
  // Idempotent: each row is only created if its natural key (slug
  // for pages, id for the singleton, question+category for FAQs)
  // doesn't already exist. Re-running never overwrites existing
  // admin edits.
  console.log('\n📄 M11.B — CMS content:');
  let pagesCreated = 0;
  let pagesPreserved = 0;

  const CONTENT_PAGES: Array<{
    slug: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;
    contentHtml: string;
  }> = [
    {
      slug: 'about',
      title: 'About E-Visa Global',
      metaTitle: 'About E-Visa Global — Your Trusted E-Visa Partner',
      metaDescription:
        'E-Visa Global helps travelers worldwide apply for electronic visas quickly, securely, and transparently.',
      contentHtml: `<h1>About E-Visa Global</h1>
<p>E-Visa Global is your trusted partner for fast, reliable electronic visa applications. We simplify international travel by providing a streamlined platform that connects travelers with official e-visa services for destinations worldwide.</p>
<h2>Our Mission</h2>
<p>To make international travel accessible by removing the friction from visa applications. We handle the paperwork so you can focus on your journey.</p>
<h2>Why Choose Us</h2>
<ul>
  <li>Fast processing — most visas issued within 5–7 business days</li>
  <li>Secure platform — your data is encrypted and never shared</li>
  <li>24/7 customer support throughout your application</li>
  <li>Transparent pricing with no hidden fees</li>
  <li>Trusted by travelers from over 200 countries</li>
</ul>
<h2>How It Works</h2>
<p>Apply online in minutes, upload your documents, pay securely, and receive your e-visa via email — all from the comfort of your home or office.</p>`,
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      metaTitle: 'Privacy Policy — E-Visa Global',
      metaDescription:
        'How E-Visa Global collects, uses, and protects your personal information during the visa application process.',
      contentHtml: `<h1>Privacy Policy</h1>
<p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
<h2>1. Information We Collect</h2>
<p>We collect information necessary to process your visa application, including personal details, passport information, travel dates, and payment data.</p>
<h2>2. How We Use Your Information</h2>
<p>Your information is used solely to process your visa application and communicate with you about your application status. We do not sell or share your data with third parties except as required to process your visa.</p>
<h2>3. Data Security</h2>
<p>We implement industry-standard security measures including SSL encryption, secure data storage, and access controls to protect your information.</p>
<h2>4. Cookies</h2>
<p>We use cookies to enhance your browsing experience and maintain your session during the application process.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.</p>
<h2>6. Contact Us</h2>
<p>For privacy-related questions, please <a href="/contact">contact us</a>.</p>`,
    },
    {
      slug: 'terms',
      title: 'Terms of Service',
      metaTitle: 'Terms of Service — E-Visa Global',
      metaDescription:
        'The terms governing your use of the E-Visa Global platform and visa application service.',
      contentHtml: `<h1>Terms of Service</h1>
<p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
<h2>1. Service Description</h2>
<p>E-Visa Global provides an online platform to facilitate electronic visa applications. We are an intermediary service; visa decisions are made solely by the destination country&apos;s authorities.</p>
<h2>2. Application Process</h2>
<p>By submitting an application through our platform, you confirm that all information provided is accurate and complete. False information may result in visa denial without refund.</p>
<h2>3. Fees and Payments</h2>
<p>Service fees are non-refundable once an application is submitted to the destination country&apos;s authorities. Government fees are subject to the destination country&apos;s policies.</p>
<h2>4. Processing Times</h2>
<p>Processing times are estimates provided by destination countries. We cannot guarantee specific processing times.</p>
<h2>5. Visa Decisions</h2>
<p>We do not influence visa decisions. Approval or denial is at the sole discretion of the destination country&apos;s authorities.</p>
<h2>6. Limitation of Liability</h2>
<p>Our liability is limited to the service fees paid. We are not responsible for visa denials, travel disruptions, or other consequences arising from visa decisions.</p>
<h2>7. Changes to Terms</h2>
<p>We reserve the right to update these terms. Continued use of our service constitutes acceptance of updated terms.</p>`,
    },
    {
      slug: 'contact',
      title: 'Contact Us',
      metaTitle: 'Contact Us — E-Visa Global',
      metaDescription: 'Get in touch with the E-Visa Global team for questions about your visa application.',
      contentHtml: `<h1>Contact Us</h1>
<p>We&apos;re here to help with your visa application. Reach out through any of the channels listed below.</p>
<p>For frequently asked questions, please visit our <a href="/faq">FAQ page</a>.</p>`,
    },
    {
      slug: 'faq',
      title: 'Frequently Asked Questions',
      metaTitle: 'FAQ — E-Visa Global',
      metaDescription: 'Answers to the most common questions about applying for an e-visa with E-Visa Global.',
      contentHtml: `<h1>Frequently Asked Questions</h1>
<p>Find answers to common questions about our visa application service. Use the categories below to browse, or jump to a specific topic.</p>`,
    },
  ];

  for (const p of CONTENT_PAGES) {
    const existing = await prisma.contentPage.findUnique({ where: { slug: p.slug } });
    if (existing) {
      pagesPreserved++;
      continue;
    }
    await prisma.contentPage.create({
      data: {
        slug: p.slug,
        title: p.title,
        contentHtml: p.contentHtml,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    pagesCreated++;
  }
  console.log(`  Content pages: ${pagesCreated} new + ${pagesPreserved} preserved`);

  // Contact info singleton
  const existingContact = await prisma.contactInfo.findFirst();
  if (existingContact) {
    console.log('  Contact info: preserved (singleton)');
  } else {
    await prisma.contactInfo.create({
      data: {
        email: 'support@evisaglobal.com',
        phone: '+994 50 000 00 00',
        whatsapp: '+994 50 000 00 00',
        businessHours: 'Monday – Friday: 9:00 AM – 6:00 PM (UTC+4)',
        supportHours: '24/7 Email Support',
        socialLinksJson: {},
      },
    });
    console.log('  Contact info: created (singleton)');
  }

  // FAQ items — natural key is (question, category) so re-runs skip
  // an item the admin may already have edited.
  const FAQ_SEEDS: Array<{
    category: string;
    question: string;
    answer: string;
    displayOrder: number;
  }> = [
    {
      category: 'general', displayOrder: 0,
      question: 'What is an e-visa?',
      answer:
        'An e-visa is an electronic visa that allows you to travel to a destination country without visiting an embassy or consulate. The visa is issued digitally and linked to your passport.',
    },
    {
      category: 'general', displayOrder: 1,
      question: 'Which countries does E-Visa Global support?',
      answer:
        'We support visa applications for over 50 destination countries including Türkiye, UAE, Egypt, Georgia, Sri Lanka, Thailand, and many more. Check our homepage for the full list.',
    },
    {
      category: 'application', displayOrder: 0,
      question: 'How long does the application take?',
      answer:
        'The online application typically takes 10–15 minutes to complete. Make sure you have your passport and travel details ready before you start.',
    },
    {
      category: 'application', displayOrder: 1,
      question: 'What documents do I need?',
      answer:
        'Required documents vary by destination, but typically include a passport scan, passport photo, and proof of travel arrangements (hotel booking, flight tickets). Specific requirements are shown during the application process.',
    },
    {
      category: 'application', displayOrder: 2,
      question: 'Can I apply for multiple people in one application?',
      answer:
        'Yes. You can add multiple applicants to a single application. Each applicant requires their own passport details and documents.',
    },
    {
      category: 'payment', displayOrder: 0,
      question: 'Which payment methods do you accept?',
      answer:
        'We accept all major credit and debit cards including Visa, Mastercard, and American Express. Payments are processed securely through encrypted channels.',
    },
    {
      category: 'payment', displayOrder: 1,
      question: 'Is the service fee refundable?',
      answer:
        'Service fees are non-refundable once your application is submitted to the destination country&apos;s authorities. If you cancel before submission, we issue a full refund.',
    },
    {
      category: 'visa', displayOrder: 0,
      question: 'How long does visa processing take?',
      answer:
        'Processing times vary by destination country, typically 3–10 business days. Express processing is available for many destinations for an additional fee.',
    },
    {
      category: 'visa', displayOrder: 1,
      question: 'What if my visa is denied?',
      answer:
        'Visa decisions are made by destination country authorities. If denied, the government fee is forfeited per destination country policy. Our service fee may or may not be refundable depending on the circumstances.',
    },
    {
      category: 'visa', displayOrder: 2,
      question: 'How will I receive my approved visa?',
      answer:
        'Approved visas are sent to your registered email address as a PDF. You can also download your visa from your customer portal at /me. Print the visa and carry it with you when traveling.',
    },
  ];

  let faqCreated = 0;
  let faqPreserved = 0;
  for (const f of FAQ_SEEDS) {
    const existing = await prisma.faqItem.findFirst({
      where: { question: f.question, category: f.category, deletedAt: null },
    });
    if (existing) {
      faqPreserved++;
      continue;
    }
    await prisma.faqItem.create({
      data: {
        question: f.question,
        answer: f.answer,
        category: f.category,
        displayOrder: f.displayOrder,
        isPublished: true,
      },
    });
    faqCreated++;
  }
  console.log(`  FAQ items: ${faqCreated} new + ${faqPreserved} preserved`);
  console.log('─'.repeat(60));

  // ───────────────────────────────────────────────────────────
  // M11.1 — Default homepage carousel slides
  // ───────────────────────────────────────────────────────────
  // Idempotent: insert one slide per popular destination if no slide
  // already references that country. Image URLs are intentionally
  // null — admin uploads later via /admin/homepage-slides; the
  // public carousel renders a flag-emoji fallback meanwhile.
  console.log('\n🖼  M11.1 — Homepage slides:');
  const HOMEPAGE_SLIDE_SEEDS: Array<{
    destinationIso: string;
    title: string;
    subtitle: string;
  }> = [
    { destinationIso: 'TR', title: 'Türkiye Visa', subtitle: 'Apply in minutes, travel within days' },
    { destinationIso: 'AE', title: 'UAE Visa', subtitle: 'Skip the embassy queue — apply online' },
    { destinationIso: 'EG', title: 'Egypt Visa', subtitle: 'See the pyramids — visa in 5–7 days' },
    { destinationIso: 'GE', title: 'Georgia Visa', subtitle: 'Caucasus mountains, Black Sea coast' },
    { destinationIso: 'LK', title: 'Sri Lanka Visa', subtitle: 'Tea country & tropical beaches' },
  ];

  let slidesCreated = 0;
  let slidesPreserved = 0;
  let displayOrder = 0;
  for (const s of HOMEPAGE_SLIDE_SEEDS) {
    const country = await prisma.country.findFirst({
      where: { isoCode: s.destinationIso, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!country) {
      console.log(`  ⚠️  skip ${s.destinationIso} — country missing`);
      continue;
    }
    // Idempotency key: one slide per countryId. Re-runs never create
    // duplicates and never overwrite admin-edited content.
    const existing = await prisma.homepageSlide.findFirst({
      where: { countryId: country.id, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      slidesPreserved++;
      displayOrder++;
      continue;
    }
    await prisma.homepageSlide.create({
      data: {
        countryId: country.id,
        title: s.title,
        subtitle: s.subtitle,
        ctaText: 'Apply Now',
        displayOrder,
        isPublished: true,
      },
    });
    slidesCreated++;
    displayOrder++;
  }
  console.log(`  Homepage slides: ${slidesCreated} new + ${slidesPreserved} preserved`);
  console.log('─'.repeat(60));

  // ───────────────────────────────────────────────────────────
  // M11.2 — Boilerplate templates (idempotent, by templateKey)
  // ───────────────────────────────────────────────────────────
  // Three industry-standard templates admins clone from. All marked
  // `isBoilerplate=true` and `isActive=false` so they cannot be bound
  // to live (nationality, destination, visaType) combos. Cloning is
  // done via the existing POST /admin/templates/:id/duplicate
  // endpoint — boilerplates are explicitly skipped by the bulk-upsert
  // bindings endpoint.
  console.log('\n📋 M11.2 — Boilerplate templates:');

  // Reused option lists. Prefix `bp_` so we don't shadow the
  // identically-named locals declared earlier in main() for the
  // production templates seed.
  const bp_genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other / Prefer not to say' },
  ];
  const bp_passportTypeOptions = [
    { value: 'ordinary', label: 'Ordinary' },
    { value: 'diplomatic', label: 'Diplomatic' },
    { value: 'service', label: 'Service' },
  ];
  const bp_purposeOfVisitOptions = [
    { value: 'tourism', label: 'Tourism' },
    { value: 'visiting_family', label: 'Visiting Family' },
    { value: 'medical', label: 'Medical' },
  ];
  const bp_accommodationOptions = [
    { value: 'hotel', label: 'Hotel' },
    { value: 'airbnb', label: 'Airbnb / short-term rental' },
    { value: 'family', label: 'Staying with family' },
    { value: 'other', label: 'Other' },
  ];

  type BoilerplateField = {
    fieldKey: string;
    fieldType: string;
    label: string;
    isRequired: boolean;
    placeholder?: string;
    helpText?: string;
    optionsJson?: unknown;
    validationRulesJson?: unknown;
  };
  type BoilerplateSection = {
    key: string;
    title: string;
    description?: string;
    fields: BoilerplateField[];
  };
  type Boilerplate = {
    key: string;
    name: string;
    description: string;
    sections: BoilerplateSection[];
  };

  const BOILERPLATES: Boilerplate[] = [
    {
      key: 'tourismBoilerplateV1',
      name: 'Standard Tourism Form',
      description:
        'Industry-standard tourism visa form. Clone via "Create from boilerplate" to start a real bindable template.',
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          fields: [
            { fieldKey: 'firstName', fieldType: 'text', label: 'First Name', isRequired: true, placeholder: 'As shown on passport', validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'lastName', fieldType: 'text', label: 'Last Name', isRequired: true, placeholder: 'As shown on passport', validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'dateOfBirth', fieldType: 'date', label: 'Date of Birth', isRequired: true, validationRulesJson: { max: 'today-18years' } },
            { fieldKey: 'nationality', fieldType: 'country', label: 'Nationality', isRequired: true },
            { fieldKey: 'gender', fieldType: 'select', label: 'Gender', isRequired: true, optionsJson: bp_genderOptions },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          fields: [
            { fieldKey: 'passportNumber', fieldType: 'text', label: 'Passport Number', isRequired: true, validationRulesJson: { pattern: '^[A-Z0-9]{6,15}$', message: 'Use 6–15 uppercase letters or digits' } },
            { fieldKey: 'passportType', fieldType: 'select', label: 'Passport Type', isRequired: true, optionsJson: bp_passportTypeOptions },
            { fieldKey: 'issueDate', fieldType: 'date', label: 'Passport Issue Date', isRequired: true, validationRulesJson: { max: 'today' } },
            { fieldKey: 'expiryDate', fieldType: 'date', label: 'Passport Expiry Date', isRequired: true, helpText: 'Must be valid for at least 6 months from today', validationRulesJson: { min: 'today+6months' } },
            { fieldKey: 'issuingCountry', fieldType: 'country', label: 'Issuing Country', isRequired: true },
          ],
        },
        {
          key: 'travel',
          title: 'Travel Information',
          fields: [
            { fieldKey: 'arrivalDate', fieldType: 'date', label: 'Planned Arrival Date', isRequired: true, validationRulesJson: { min: 'today+1day' } },
            { fieldKey: 'departureDate', fieldType: 'date', label: 'Planned Departure Date', isRequired: true, validationRulesJson: { min: '$arrivalDate+1day' } },
            { fieldKey: 'purposeOfVisit', fieldType: 'select', label: 'Purpose of Visit', isRequired: true, optionsJson: bp_purposeOfVisitOptions },
            { fieldKey: 'accommodationType', fieldType: 'select', label: 'Accommodation Type', isRequired: true, optionsJson: bp_accommodationOptions },
            { fieldKey: 'accommodationAddress', fieldType: 'textarea', label: 'Accommodation Address', isRequired: true, validationRulesJson: { minLength: 10, maxLength: 500 } },
          ],
        },
        {
          key: 'contact',
          title: 'Contact Information',
          fields: [
            { fieldKey: 'email', fieldType: 'email', label: 'Email', isRequired: true },
            { fieldKey: 'phone', fieldType: 'phone', label: 'Phone', isRequired: true },
            { fieldKey: 'homeAddress', fieldType: 'textarea', label: 'Home Address', isRequired: true, validationRulesJson: { minLength: 10, maxLength: 500 } },
            { fieldKey: 'emergencyContact', fieldType: 'phone', label: 'Emergency Contact Phone', isRequired: true },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          fields: [
            { fieldKey: 'passportBioPage', fieldType: 'file', label: 'Passport Bio Page', isRequired: true, helpText: 'PDF / JPG / PNG, max 5 MB' },
            { fieldKey: 'passportPhoto', fieldType: 'file', label: 'Passport Photo', isRequired: true, helpText: 'JPG / PNG, max 5 MB' },
            { fieldKey: 'hotelBooking', fieldType: 'file', label: 'Hotel Booking Confirmation', isRequired: true, helpText: 'PDF, max 5 MB' },
            { fieldKey: 'returnFlight', fieldType: 'file', label: 'Return Flight Ticket', isRequired: true, helpText: 'PDF, max 5 MB' },
          ],
        },
      ],
    },
    {
      key: 'businessBoilerplateV1',
      name: 'Standard Business Form',
      description:
        'Industry-standard business visa form. Clone via "Create from boilerplate" to start a real bindable template.',
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          fields: [
            { fieldKey: 'firstName', fieldType: 'text', label: 'First Name', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'lastName', fieldType: 'text', label: 'Last Name', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'dateOfBirth', fieldType: 'date', label: 'Date of Birth', isRequired: true, validationRulesJson: { max: 'today-18years' } },
            { fieldKey: 'nationality', fieldType: 'country', label: 'Nationality', isRequired: true },
            { fieldKey: 'gender', fieldType: 'select', label: 'Gender', isRequired: true, optionsJson: bp_genderOptions },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          fields: [
            { fieldKey: 'passportNumber', fieldType: 'text', label: 'Passport Number', isRequired: true, validationRulesJson: { pattern: '^[A-Z0-9]{6,15}$', message: 'Use 6–15 uppercase letters or digits' } },
            { fieldKey: 'passportType', fieldType: 'select', label: 'Passport Type', isRequired: true, optionsJson: bp_passportTypeOptions },
            { fieldKey: 'issueDate', fieldType: 'date', label: 'Passport Issue Date', isRequired: true, validationRulesJson: { max: 'today' } },
            { fieldKey: 'expiryDate', fieldType: 'date', label: 'Passport Expiry Date', isRequired: true, helpText: 'Must be valid for at least 6 months from today', validationRulesJson: { min: 'today+6months' } },
            { fieldKey: 'issuingCountry', fieldType: 'country', label: 'Issuing Country', isRequired: true },
          ],
        },
        {
          key: 'business',
          title: 'Business Details',
          fields: [
            { fieldKey: 'companyName', fieldType: 'text', label: 'Company Name', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'companyAddress', fieldType: 'textarea', label: 'Company Address', isRequired: true, validationRulesJson: { minLength: 10, maxLength: 500 } },
            { fieldKey: 'jobTitle', fieldType: 'text', label: 'Job Title', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 100 } },
            { fieldKey: 'invitingCompany', fieldType: 'text', label: 'Inviting Company', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 200 } },
            { fieldKey: 'invitationLetter', fieldType: 'file', label: 'Invitation Letter', isRequired: true, helpText: 'PDF, max 5 MB' },
            { fieldKey: 'businessPurpose', fieldType: 'textarea', label: 'Business Purpose', isRequired: true, validationRulesJson: { minLength: 20, maxLength: 1000 } },
          ],
        },
        {
          key: 'travel',
          title: 'Travel Information',
          fields: [
            { fieldKey: 'arrivalDate', fieldType: 'date', label: 'Planned Arrival Date', isRequired: true, validationRulesJson: { min: 'today+1day' } },
            { fieldKey: 'departureDate', fieldType: 'date', label: 'Planned Departure Date', isRequired: true, validationRulesJson: { min: '$arrivalDate+1day' } },
            { fieldKey: 'purposeOfVisit', fieldType: 'select', label: 'Purpose of Visit', isRequired: true, optionsJson: [{ value: 'business_meeting', label: 'Business Meeting' }, { value: 'conference', label: 'Conference' }, { value: 'training', label: 'Training' }] },
            { fieldKey: 'accommodationAddress', fieldType: 'textarea', label: 'Accommodation Address', isRequired: true, validationRulesJson: { minLength: 10, maxLength: 500 } },
          ],
        },
        {
          key: 'contact',
          title: 'Contact Information',
          fields: [
            { fieldKey: 'email', fieldType: 'email', label: 'Email', isRequired: true },
            { fieldKey: 'phone', fieldType: 'phone', label: 'Phone', isRequired: true },
            { fieldKey: 'homeAddress', fieldType: 'textarea', label: 'Home Address', isRequired: true, validationRulesJson: { minLength: 10, maxLength: 500 } },
            { fieldKey: 'emergencyContact', fieldType: 'phone', label: 'Emergency Contact Phone', isRequired: true },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          fields: [
            { fieldKey: 'passportBioPage', fieldType: 'file', label: 'Passport Bio Page', isRequired: true, helpText: 'PDF / JPG / PNG, max 5 MB' },
            { fieldKey: 'passportPhoto', fieldType: 'file', label: 'Passport Photo', isRequired: true, helpText: 'JPG / PNG, max 5 MB' },
            { fieldKey: 'companyId', fieldType: 'file', label: 'Company ID / Business Card', isRequired: true, helpText: 'PDF / JPG / PNG, max 5 MB' },
            { fieldKey: 'hotelBooking', fieldType: 'file', label: 'Hotel Booking Confirmation', isRequired: true, helpText: 'PDF, max 5 MB' },
            { fieldKey: 'returnFlight', fieldType: 'file', label: 'Return Flight Ticket', isRequired: true, helpText: 'PDF, max 5 MB' },
          ],
        },
      ],
    },
    {
      key: 'transitBoilerplateV1',
      name: 'Standard Transit Form',
      description:
        'Industry-standard transit visa form (≤72h layovers). Clone via "Create from boilerplate" to start a real bindable template.',
      sections: [
        {
          key: 'personal',
          title: 'Personal Information',
          fields: [
            { fieldKey: 'firstName', fieldType: 'text', label: 'First Name', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'lastName', fieldType: 'text', label: 'Last Name', isRequired: true, validationRulesJson: { minLength: 2, maxLength: 50 } },
            { fieldKey: 'dateOfBirth', fieldType: 'date', label: 'Date of Birth', isRequired: true, validationRulesJson: { max: 'today-18years' } },
          ],
        },
        {
          key: 'passport',
          title: 'Passport Details',
          fields: [
            { fieldKey: 'passportNumber', fieldType: 'text', label: 'Passport Number', isRequired: true, validationRulesJson: { pattern: '^[A-Z0-9]{6,15}$', message: 'Use 6–15 uppercase letters or digits' } },
            { fieldKey: 'expiryDate', fieldType: 'date', label: 'Passport Expiry Date', isRequired: true, helpText: 'Must be valid for at least 6 months from today', validationRulesJson: { min: 'today+6months' } },
            { fieldKey: 'issuingCountry', fieldType: 'country', label: 'Issuing Country', isRequired: true },
          ],
        },
        {
          key: 'transit',
          title: 'Transit Information',
          fields: [
            { fieldKey: 'arrivalDate', fieldType: 'date', label: 'Arrival Date', isRequired: true, validationRulesJson: { min: 'today+1day' } },
            { fieldKey: 'departureDate', fieldType: 'date', label: 'Departure Date', isRequired: true, helpText: 'Layover must be 4–72 hours', validationRulesJson: { min: '$arrivalDate+4hours', max: '$arrivalDate+72hours' } },
            { fieldKey: 'finalDestination', fieldType: 'country', label: 'Final Destination', isRequired: true },
            { fieldKey: 'layoverHours', fieldType: 'number', label: 'Layover Hours', isRequired: true, validationRulesJson: { min: 4, max: 72 } },
          ],
        },
        {
          key: 'documents',
          title: 'Documents',
          fields: [
            { fieldKey: 'passportBioPage', fieldType: 'file', label: 'Passport Bio Page', isRequired: true, helpText: 'PDF / JPG / PNG, max 5 MB' },
            { fieldKey: 'onwardFlightTicket', fieldType: 'file', label: 'Onward Flight Ticket', isRequired: true, helpText: 'PDF, max 5 MB' },
          ],
        },
      ],
    },
  ];

  let bpCreated = 0;
  let bpPreserved = 0;
  let bpFieldsCreated = 0;
  for (const bp of BOILERPLATES) {
    const existing = await prisma.template.findUnique({ where: { key: bp.key } });
    if (existing) {
      bpPreserved++;
      console.log(`  ⏭️  Boilerplate exists: ${bp.key}`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const tpl = await tx.template.create({
        data: {
          name: bp.name,
          key: bp.key,
          description: bp.description,
          version: 1,
          isActive: false, // not directly bindable
          isBoilerplate: true,
        },
      });
      let sectionSortOrder = 0;
      for (const section of bp.sections) {
        const sec = await tx.templateSection.create({
          data: {
            templateId: tpl.id,
            title: section.title,
            key: section.key,
            description: section.description,
            sortOrder: sectionSortOrder++,
            isActive: true,
          },
        });
        let fieldSortOrder = 0;
        for (const f of section.fields) {
          await tx.templateField.create({
            data: {
              templateSectionId: sec.id,
              fieldKey: f.fieldKey,
              fieldType: f.fieldType,
              label: f.label,
              placeholder: f.placeholder,
              helpText: f.helpText,
              isRequired: f.isRequired,
              sortOrder: fieldSortOrder++,
              isActive: true,
              optionsJson: (f.optionsJson ?? undefined) as never,
              validationRulesJson: (f.validationRulesJson ?? undefined) as never,
            },
          });
          bpFieldsCreated++;
        }
      }
    });
    bpCreated++;
    const totalFields = bp.sections.reduce((n, s) => n + s.fields.length, 0);
    console.log(`  ✅ ${bp.key} — ${bp.sections.length} sections, ${totalFields} fields`);
  }
  console.log(`  Boilerplates: ${bpCreated} new + ${bpPreserved} preserved (${bpFieldsCreated} fields created)`);
  console.log('─'.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
