/**
 * One-off demo data seed for the customer journey demo.
 *
 *   npx ts-node scripts/seed-demo-data.ts
 *   # or, after `npm run build`:
 *   node -r ts-node/register scripts/seed-demo-data.ts
 *
 * Creates one verified portal identity + three applications covering
 * the three visually distinct /me card states the demo wants to show:
 *
 *   1. NEED_DOCS      — orange "Action Required" card, opens resubmit modal
 *   2. READY_TO_DOWNLOAD — green card with download button(s)
 *   3. APPROVED       — green "Visa being prepared" card, no download
 *
 * NOT part of `prisma/seed.ts` — that's the production seed and we
 * never want demo accounts to leak into prod-equivalent envs by
 * accident. This script is opt-in per environment.
 *
 * Idempotency:
 *   - portalIdentity is upserted by email
 *   - applications use a stable `adminNote` marker ("DEMO_SEED_v1") so
 *     a re-run finds + updates them in place rather than spawning
 *     duplicates
 *   - the magic OTP is wiped + re-created every run (always fresh)
 *
 * OTP bypass:
 *   - The seed inserts an OtpCode row with code "000000" hashed,
 *     purpose=LOGIN, expiresAt = +30 days. The user enters "000000"
 *     in the portal OTP screen. After verify it gets marked used
 *     (one-shot) — re-run the seed to refresh.
 */
import { PrismaClient, ApplicationStatus, ApplicantStatus, OtpPurpose, PaymentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@evisatest.com';
const DEMO_OTP_CODE = '000000';
const DEMO_MARKER = 'DEMO_SEED_v1';

// One row per application we want on /me. `iso` lookups happen at
// runtime so we don't hardcode UUIDs.
interface AppSpec {
  status: ApplicationStatus;
  destinationIso: string;
  visaTypePurpose: string;
  applicant: {
    firstName: string;
    lastName: string;
    dob: string; // YYYY-MM-DD
  };
  requestedDocumentTypes?: string[];
  adminNote?: string;
  estimatedProcessingDays?: number;
  /** Set true to also create an issued_visa Document for the applicant. */
  withIssuedVisa?: boolean;
  visaReferenceNumber?: string;
}

const APPS: AppSpec[] = [
  {
    status: ApplicationStatus.NEED_DOCS,
    destinationIso: 'TR',
    visaTypePurpose: 'tourism',
    applicant: { firstName: 'Ali', lastName: 'Demo', dob: '1990-01-15' },
    requestedDocumentTypes: ['bank_statement', 'hotel_booking', 'return_ticket'],
    adminNote: 'Please provide additional supporting documents.',
  },
  {
    status: ApplicationStatus.READY_TO_DOWNLOAD,
    destinationIso: 'AE',
    visaTypePurpose: 'tourism',
    applicant: { firstName: 'Sara', lastName: 'Demo', dob: '1988-06-20' },
    estimatedProcessingDays: 5,
    withIssuedVisa: true,
    visaReferenceNumber: 'AE-2026-DEMO-001',
  },
  {
    status: ApplicationStatus.APPROVED,
    destinationIso: 'EG',
    visaTypePurpose: 'tourism',
    applicant: { firstName: 'Murad', lastName: 'Demo', dob: '1995-11-03' },
    estimatedProcessingDays: 7,
  },
];

// =========================================================
// Helpers
// =========================================================

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateResumeToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function generateApplicationCode(): string {
  // Match the format the live system uses (EV-{YYYY}-{NNNN}). The
  // exact code only needs to be unique — these are demo apps.
  const year = new Date().getFullYear();
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `EV-${year}-${seq}`;
}

async function findCountryByIso(iso: string) {
  const country = await prisma.country.findFirst({
    where: { isoCode: iso, isActive: true, deletedAt: null },
    select: { id: true, name: true, isoCode: true },
  });
  if (!country) {
    throw new Error(`No active country found for ISO code "${iso}"`);
  }
  return country;
}

async function findVisaTypeByPurpose(purpose: string) {
  const vt = await prisma.visaType.findFirst({
    where: { purpose, isActive: true, deletedAt: null },
    select: { id: true, purpose: true, label: true },
  });
  if (!vt) {
    throw new Error(`No active visa type found for purpose "${purpose}"`);
  }
  return vt;
}

/**
 * Find an active TemplateBinding for (destinationIso, visaTypePurpose,
 * AZ nationality). Returns binding + a matching active fee or null
 * when the combination isn't seeded — we skip those apps loudly.
 */
async function findBindingAndFeeForCombo(
  destinationCountryId: string,
  visaTypeId: string,
  nationalityCountryId: string,
) {
  const binding = await prisma.templateBinding.findFirst({
    where: {
      destinationCountryId,
      visaTypeId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      templateId: true,
      nationalityFees: {
        where: {
          nationalityCountryId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          governmentFeeAmount: true,
          serviceFeeAmount: true,
          currencyCode: true,
        },
        take: 1,
      },
    },
  });
  if (!binding || binding.nationalityFees.length === 0) {
    return null;
  }
  return {
    bindingId: binding.id,
    templateId: binding.templateId,
    fee: binding.nationalityFees[0],
  };
}

// =========================================================
// Main
// =========================================================

async function main() {
  console.log('🎬 Demo data seed — start');

  // 1. Portal identity (upsert by email).
  const portalIdentity = await prisma.portalIdentity.upsert({
    where: { email: DEMO_EMAIL },
    update: { isActive: true, lastVerifiedAt: new Date() },
    create: { email: DEMO_EMAIL, isActive: true, lastVerifiedAt: new Date() },
  });
  console.log(`✅ Portal identity ready: ${DEMO_EMAIL} (${portalIdentity.id})`);

  // 2. Magic OTP — wipe any prior demo OTP, insert fresh.
  await prisma.otpCode.deleteMany({
    where: { email: DEMO_EMAIL, purpose: OtpPurpose.LOGIN },
  });
  const otpExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
  await prisma.otpCode.create({
    data: {
      email: DEMO_EMAIL,
      codeHash: sha256(DEMO_OTP_CODE),
      purpose: OtpPurpose.LOGIN,
      expiresAt: otpExpiresAt,
    },
  });
  console.log(
    `✅ Magic OTP "${DEMO_OTP_CODE}" valid until ${otpExpiresAt.toISOString()} (one-shot — re-run seed if consumed)`,
  );

  // 3. Resolve fixed reference data.
  const az = await findCountryByIso('AZ');
  console.log(`📍 Nationality: ${az.name} (${az.isoCode})`);

  // 4. Wipe any prior demo apps for this user (idempotent — adminNote
  // marker keeps real apps the user might create later untouched).
  const priorDemo = await prisma.application.findMany({
    where: {
      portalIdentityId: portalIdentity.id,
      adminNote: { contains: DEMO_MARKER },
    },
    select: { id: true },
  });
  if (priorDemo.length > 0) {
    const ids = priorDemo.map((a) => a.id);
    // ApplicationApplicant cascades from Application; Document cascades from
    // ApplicationApplicant. ApplicationStatusHistory has no cascade — clear
    // it explicitly so the next FK insert doesn't see orphan rows.
    await prisma.applicationStatusHistory.deleteMany({
      where: { applicationId: { in: ids } },
    });
    await prisma.application.deleteMany({ where: { id: { in: ids } } });
    console.log(`🧹 Removed ${priorDemo.length} prior demo application(s)`);
  }

  // 5. Build each demo app.
  let created = 0;
  let skipped = 0;
  for (const spec of APPS) {
    const dest = await findCountryByIso(spec.destinationIso);
    const visaType = await findVisaTypeByPurpose(spec.visaTypePurpose);
    const combo = await findBindingAndFeeForCombo(dest.id, visaType.id, az.id);
    if (!combo) {
      console.warn(
        `⚠️  Skipping ${spec.status} app for ${dest.isoCode}+${visaType.purpose}: no active binding/fee for AZ nationality`,
      );
      skipped++;
      continue;
    }

    const totalFee = (
      Number(combo.fee.governmentFeeAmount) + Number(combo.fee.serviceFeeAmount)
    ).toFixed(2);

    const applicationCode = generateApplicationCode();
    // Prisma's JSON column types want a Prisma.InputJsonValue rather
    // than plain Record — the cast keeps the data shape readable
    // above without dragging the verbose Prisma generic everywhere.
    const formData = {
      firstName: spec.applicant.firstName,
      lastName: spec.applicant.lastName,
      dateOfBirth: spec.applicant.dob,
      passportNumber: `DEMO${Math.floor(100000 + Math.random() * 900000)}`,
    } satisfies Prisma.InputJsonObject;

    // adminNote contains both the human message + the marker we use
    // to recognize this as a demo app on re-run.
    const adminNote = `[${DEMO_MARKER}] ${spec.adminNote ?? 'Demo seed application'}`;

    const app = await prisma.application.create({
      data: {
        portalIdentityId: portalIdentity.id,
        nationalityCountryId: az.id,
        destinationCountryId: dest.id,
        visaTypeId: visaType.id,
        templateId: combo.templateId,
        templateBindingId: combo.bindingId,
        totalFeeAmount: totalFee,
        currencyCode: combo.fee.currencyCode,
        expedited: false,
        paymentStatus:
          spec.status === ApplicationStatus.DRAFT ||
          spec.status === ApplicationStatus.UNPAID
            ? PaymentStatus.PENDING
            : PaymentStatus.PAID,
        resumeToken: generateResumeToken(),
        currentStatus: spec.status,
        adminNote,
        requestedDocumentTypes: spec.requestedDocumentTypes ?? [],
        estimatedProcessingDays: spec.estimatedProcessingDays ?? null,
        estimatedTimeUpdatedAt: spec.estimatedProcessingDays ? new Date() : null,
        applicants: {
          create: {
            isMainApplicant: true,
            email: DEMO_EMAIL,
            formDataJson: formData,
            status:
              spec.status === ApplicationStatus.READY_TO_DOWNLOAD
                ? ApplicantStatus.READY_TO_DOWNLOAD
                : spec.status === ApplicationStatus.NEED_DOCS
                  ? ApplicantStatus.NEED_DOCS
                  : spec.status === ApplicationStatus.APPROVED
                    ? ApplicantStatus.APPROVED
                    : ApplicantStatus.SUBMITTED,
            applicationCode,
          },
        },
      },
    });

    // M11.3 — when the application is seeded as PAID, also create the
    // matching Payment row. The earlier path flipped
    // `application.payment_status` but never inserted a payments row,
    // which broke the admin Transactions page and zeroed the
    // dashboard's `totalRevenue` aggregate. Idempotent on re-runs:
    // skip if a non-deleted payment already exists for this app.
    if (
      spec.status !== ApplicationStatus.DRAFT &&
      spec.status !== ApplicationStatus.UNPAID
    ) {
      const existingPayment = await prisma.payment.findFirst({
        where: { applicationId: app.id, deletedAt: null },
        select: { id: true },
      });
      if (!existingPayment) {
        // totalFee above is a `.toFixed(2)` string for the application
        // row; coerce back to Number for the math + Decimal columns.
        const totalNumber = Number(totalFee);
        const govPortion = Math.round(totalNumber * 0.6 * 100) / 100;
        const servicePortion = Math.round(totalNumber * 0.4 * 100) / 100;
        await prisma.payment.create({
          data: {
            applicationId: app.id,
            paymentReference: `DEMO-${applicationCode}`,
            paymentProviderKey: 'mock_demo_seed',
            currencyCode: combo.fee.currencyCode,
            governmentFeeAmount: govPortion,
            serviceFeeAmount: servicePortion,
            totalAmount: totalNumber,
            payableAmount: totalNumber,
            paymentStatus: PaymentStatus.PAID,
            paidAt: new Date(),
          },
        });
      }
    }

    // Optional: stub an issued_visa Document so the download button
    // renders. Per the brief: "fake storageKey is fine — the download
    // will 404 but the UI state is what we're demoing."
    if (spec.withIssuedVisa) {
      // Re-fetch the applicant id — the prisma include type narrowing
      // here is finicky across versions, so a tiny extra query is
      // cheaper than fighting the inferred type.
      const applicant = await prisma.applicationApplicant.findFirstOrThrow({
        where: { applicationId: app.id, isMainApplicant: true },
        select: { id: true },
      });
      await prisma.document.create({
        data: {
          applicationApplicantId: applicant.id,
          documentTypeKey: 'issued_visa',
          originalFileName: `visa-${applicationCode}.pdf`,
          storageFileName: `visa-${applicationCode}.pdf`,
          storagePath: 'demo-visas',
          // Intentionally fake — the storage download will 404 but
          // hasIssuedVisa flips true on the /me endpoint, which is
          // what drives the download button rendering. Replace with
          // a real upload via /admin/applications/.../issue-visa for
          // a fully working download.
          storageKey: `demo-visas/visa-${applicationCode}-DEMO.pdf`,
          storageProvider: 'local',
          mimeType: 'application/pdf',
          fileSize: 1024,
          checksum: sha256(`demo-${applicationCode}`),
          reviewStatus: 'APPROVED',
          reviewNote: spec.visaReferenceNumber
            ? `Reference: ${spec.visaReferenceNumber}`
            : null,
          uploadedAt: new Date(),
          reviewedAt: new Date(),
        },
      });
    }

    console.log(
      `✅ ${spec.status.padEnd(20)} ${dest.isoCode} ${visaType.purpose.padEnd(8)} → ${app.id} [${applicationCode}]`,
    );
    created++;
  }

  console.log('───────────────────────────────────────────────');
  console.log(`📊 Demo seed summary`);
  console.log(`   Portal identity:  ${DEMO_EMAIL}`);
  console.log(`   Magic OTP:        ${DEMO_OTP_CODE} (purpose=LOGIN, valid 30 days, one-shot)`);
  console.log(`   Applications:     ${created} created · ${skipped} skipped (missing bindings)`);
  console.log('───────────────────────────────────────────────');
  console.log('🎬 Demo data seed — done');
  console.log('');
  console.log('To demo:');
  console.log(`  1. https://evisaglobal.com/me`);
  console.log(`  2. Email: ${DEMO_EMAIL}`);
  console.log(`  3. OTP:   ${DEMO_OTP_CODE}`);
  console.log('  4. (Re-run this script if you want to log in again — OTP is one-shot)');
}

main()
  .catch((err) => {
    console.error('❌ Demo seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
