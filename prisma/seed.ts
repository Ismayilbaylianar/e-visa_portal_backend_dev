import { PrismaClient, PermissionEffect } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
  
  // Countries module
  { moduleKey: 'countries', actionKey: 'read', description: 'View countries and sections' },
  { moduleKey: 'countries', actionKey: 'create', description: 'Create countries' },
  { moduleKey: 'countries', actionKey: 'update', description: 'Update countries and sections' },
  { moduleKey: 'countries', actionKey: 'delete', description: 'Delete countries and sections' },
  
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
  
  // Templates module (for future use)
  { moduleKey: 'templates', actionKey: 'read', description: 'View templates' },
  { moduleKey: 'templates', actionKey: 'create', description: 'Create templates' },
  { moduleKey: 'templates', actionKey: 'update', description: 'Update templates' },
  { moduleKey: 'templates', actionKey: 'delete', description: 'Delete templates' },
  
  // Applications module (for future use)
  { moduleKey: 'applications', actionKey: 'read', description: 'View applications' },
  { moduleKey: 'applications', actionKey: 'update', description: 'Update application status' },
  { moduleKey: 'applications', actionKey: 'review', description: 'Review and process applications' },
  
  // Payments module (for future use)
  { moduleKey: 'payments', actionKey: 'read', description: 'View payments' },
  { moduleKey: 'payments', actionKey: 'refund', description: 'Process refunds' },
  
  // Audit Logs module (for future use)
  { moduleKey: 'auditLogs', actionKey: 'read', description: 'View audit logs' },
  
  // Dashboard module (for future use)
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
      'countries.read', 'countries.create', 'countries.update',
      'visaTypes.read', 'visaTypes.create', 'visaTypes.update',
      'settings.read', 'settings.update',
      'emailTemplates.read', 'emailTemplates.create', 'emailTemplates.update',
      'paymentPageConfigs.read', 'paymentPageConfigs.update',
      'templates.read', 'templates.create', 'templates.update',
      'applications.read', 'applications.update', 'applications.review',
      'payments.read',
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
      'visaTypes.read',
      'settings.read',
      'emailTemplates.read',
      'paymentPageConfigs.read',
      'templates.read',
      'applications.read', 'applications.update', 'applications.review',
      'payments.read',
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
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
