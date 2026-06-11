import { CountrySectionSlot } from '@prisma/client';

/**
 * Starter sections auto-seeded when an admin creates a new CountryPage.
 *
 * The copy mirrors the public country page's pre-CMS JSX fallbacks so
 * the admin sees the same English text they used to see baked into the
 * frontend — and can edit it from the admin UI instead of code.
 *
 * Each entry pairs a `slot` (which decides the public card skin) with
 * `sortOrder` (which decides position). Admin can reorder, retitle,
 * re-skin, or delete any of them after creation.
 *
 * Content is stored as HTML so it can be loaded straight into the
 * TipTap RichTextEditor on the admin side and rendered via
 * `dangerouslySetInnerHTML` on the public side (same boundary the
 * help articles + extra sections already use).
 */
export interface DefaultCountrySectionSeed {
  slot: CountrySectionSlot;
  title: string;
  content: string;
  sortOrder: number;
}

export const DEFAULT_COUNTRY_SECTIONS: DefaultCountrySectionSeed[] = [
  {
    slot: CountrySectionSlot.REQUIREMENTS,
    title: 'Requirements',
    sortOrder: 0,
    content: [
      '<ul>',
      '  <li>Valid passport with at least 6 months validity</li>',
      '  <li>Recent passport-style photo</li>',
      '  <li>Proof of accommodation</li>',
      '  <li>Return flight booking</li>',
      '  <li>Sufficient funds for your stay</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    slot: CountrySectionSlot.PROCESSING_TIME,
    title: 'Processing Time',
    sortOrder: 1,
    content: [
      '<p><strong>Standard processing:</strong> 5–7 business days</p>',
      '<p><strong>Expedited processing:</strong> 1–3 business days</p>',
      '<p><em>Times vary by visa type — see the sidebar for the visas available for this destination.</em></p>',
    ].join('\n'),
  },
  {
    slot: CountrySectionSlot.ELIGIBILITY,
    title: 'Eligibility',
    sortOrder: 2,
    content: [
      '<p>Citizens of eligible countries can apply for an e-Visa online. ',
      'Check if your nationality is eligible by starting an application — ',
      'the cascade selector on the homepage filters destinations by your ',
      'passport country.</p>',
    ].join(''),
  },
  {
    slot: CountrySectionSlot.HOW_TO_APPLY,
    title: 'How to Apply',
    sortOrder: 3,
    content: [
      '<ol>',
      '  <li>Select your nationality and visa type</li>',
      '  <li>Fill out the online application form</li>',
      '  <li>Upload required documents</li>',
      '  <li>Pay the visa fee</li>',
      '  <li>Receive your e-Visa by email</li>',
      '</ol>',
    ].join('\n'),
  },
];
