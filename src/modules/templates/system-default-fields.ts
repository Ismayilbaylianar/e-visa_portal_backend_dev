/**
 * M11.3 — system default fields auto-provisioned on every blank new
 * template. Boilerplates and clones skip this list (boilerplates have
 * their own curated fields from M11.2; clones inherit the source's
 * fields verbatim).
 *
 * Each field is locked to:
 *   - fieldType
 *   - validationRulesJson
 *   - isRequired (cannot flip false)
 *   - options (where applicable)
 *   - systemKey (cross-field-validator reference token)
 *
 * Admins CAN edit:
 *   - label / placeholder / helpText / sortOrder
 *   - visibilityRulesJson (use to hide via conditions instead of
 *     deleting)
 *
 * Date keyword tokens used here are resolved by the renderer's
 * `resolveDateKeyword` helper (frontend) and validator. The token
 * `$bindingMinArrivalDays` resolves to `today + binding.processingDays`
 * at validation time — post-flip-binding-flow, the source is the
 * applicant-nationality's per-nationality `processingDays` (the
 * preview API exposes it as `binding.processingDays` AND keeps the
 * legacy `binding.minArrivalDaysAdvance` alias populated with the
 * same number so seeded templates still resolve). The `$systemKey`
 * style references resolve to the value of another field with that
 * systemKey in the form payload.
 */

export interface SystemFieldSpec {
  /** Section title — fields with the same `(sectionOrder, sectionTitle)` are grouped. */
  sectionTitle: string;
  sectionDescription?: string;
  sectionOrder: number;
  field: {
    /** Stable cross-field reference token. Survives label rename. */
    systemKey: string;
    label: string;
    /** Lowercase to match the existing renderer enum (text/date/email/...). */
    fieldType:
      | 'text'
      | 'textarea'
      | 'date'
      | 'email'
      | 'phone'
      | 'select'
      | 'radio'
      | 'checkbox'
      | 'country'
      // M11.13 (BUG Y) — `file` joins the union so contact/document
      // system fields can backfill into every template.
      | 'file';
    placeholder?: string;
    helpText?: string;
    isRequired: boolean;
    /**
     * Validation rules. The renderer reads `min`/`max` (date keywords),
     * `minLength`/`maxLength`, `pattern`, and the `errorMessages`
     * shape we add here so each rule has a friendly message.
     */
    validationRulesJson: Record<string, unknown>;
    sortOrder: number;
    /**
     * M11.14 (BUG MM) — for `select` / `radio` system fields, the
     * canonical options list. Backfilled into `template_fields.options_json`
     * on first provision. Admin CAN edit the labels and order through
     * the field editor — only the option `value` is the contract for
     * cross-field validators and analytics.
     */
    optionsJson?: Array<{ value: string; label: string }>;
  };
}

export const SYSTEM_DEFAULT_FIELDS: SystemFieldSpec[] = [
  // ─── Section 1: Personal Information ───
  // M11.14 (BUG LL) — Section ordering, top → bottom:
  //   1. firstName
  //   2. lastName
  //   3. dateOfBirth
  //   4. gender         (M11.14 BUG MM — new system field)
  //   5. nationality    (was #1; pushed to the bottom because it's
  //                      pre-filled from IP detection and visually
  //                      belongs after the identity fields admins
  //                      review first).
  // Existing templates: the bootstrap pass (initializeSystemFields)
  // reconciles sortOrder on every restart so prod templates created
  // before this rename pick up the new positions automatically.
  {
    sectionTitle: 'Personal Information',
    sectionDescription: 'Please provide your personal details',
    sectionOrder: 1,
    field: {
      systemKey: 'firstName',
      label: 'First Name',
      fieldType: 'text',
      placeholder: 'Enter your first name',
      isRequired: true,
      validationRulesJson: {
        minLength: 2,
        maxLength: 50,
        errorMessages: {
          required: 'First name is required',
          minLength: 'First name must be at least 2 characters',
          maxLength: 'First name must be 50 characters or fewer',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'lastName',
      label: 'Last Name',
      fieldType: 'text',
      placeholder: 'Enter your last name',
      isRequired: true,
      validationRulesJson: {
        minLength: 2,
        maxLength: 50,
        errorMessages: {
          required: 'Last name is required',
          minLength: 'Last name must be at least 2 characters',
          maxLength: 'Last name must be 50 characters or fewer',
        },
      },
      sortOrder: 2,
    },
  },
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'dateOfBirth',
      label: 'Date of Birth',
      fieldType: 'date',
      isRequired: true,
      // M11.11 (BUG B) — Removed the +18 minimum so children
      // travelling with parents can submit. Only constraint is "not
      // in the future"; destination-specific age policies are
      // enforced manually by the operator on review.
      validationRulesJson: {
        max: 'today',
        errorMessages: {
          required: 'Date of birth is required',
          max: 'Date of birth cannot be in the future',
        },
      },
      sortOrder: 3,
    },
  },
  // M11.14 (BUG MM) — Gender is a system default field. Optional by
  // default (some destinations don't require it). Admin CAN edit the
  // label (e.g. "Cinsiyyət" for AZ), toggle required, reorder options,
  // and change visibility — but cannot delete or change the systemKey
  // or fieldType (locked by the field editor's isSystem guard).
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'gender',
      label: 'Gender',
      fieldType: 'select',
      placeholder: 'Select gender',
      helpText: 'Optional — select if your destination requires it.',
      isRequired: false,
      validationRulesJson: {
        errorMessages: {
          required: 'Gender is required',
        },
      },
      sortOrder: 4,
      optionsJson: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other' },
      ],
    },
  },
  // M11.7 (A1) → M11.14 (BUG LL): Nationality renders as a country
  // dropdown and gets pre-filled from the IP-detected country at the
  // start of the apply flow. Subsequent applicants in the same
  // application inherit this value from applicant 1 (frontend-side
  // propagation). Repositioned to the bottom of Personal Information
  // because it's auto-detected — the admin reviewing the application
  // wants to see name + DOB + gender first, then the (usually-correct)
  // nationality.
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'nationality',
      label: 'Nationality',
      fieldType: 'country',
      placeholder: 'Select your nationality',
      helpText: 'The country shown on your passport',
      isRequired: true,
      validationRulesJson: {
        errorMessages: {
          required: 'Nationality is required',
        },
      },
      sortOrder: 5,
    },
  },

  // ─── Section 2: Passport Information ───
  // M11.7 (A2): Passport-issuing country mirrors the nationality
  // dropdown (same source list, same per-applicant inheritance) but
  // is logically separate so a passenger holding a passport from a
  // different country than their nationality can still be captured.
  {
    sectionTitle: 'Passport Information',
    sectionDescription: 'Enter your passport details',
    sectionOrder: 2,
    field: {
      systemKey: 'passportIssuingCountry',
      label: 'Issuing Country',
      fieldType: 'country',
      placeholder: 'Select issuing country',
      helpText: 'The country that issued your passport',
      isRequired: true,
      validationRulesJson: {
        errorMessages: {
          required: 'Issuing country is required',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Passport Information',
    sectionOrder: 2,
    field: {
      systemKey: 'passportNumber',
      label: 'Passport Number',
      fieldType: 'text',
      placeholder: 'Enter passport number',
      isRequired: true,
      validationRulesJson: {
        pattern: '^[A-Z0-9]{6,15}$',
        errorMessages: {
          required: 'Passport number is required',
          pattern: 'Passport number must be 6–15 uppercase letters or digits',
        },
      },
      sortOrder: 2,
    },
  },
  {
    sectionTitle: 'Passport Information',
    sectionOrder: 2,
    field: {
      systemKey: 'passportIssueDate',
      label: 'Issue Date',
      fieldType: 'date',
      isRequired: true,
      validationRulesJson: {
        max: 'today',
        errorMessages: {
          required: 'Issue date is required',
          max: 'Issue date cannot be in the future',
        },
      },
      sortOrder: 3,
    },
  },
  {
    sectionTitle: 'Passport Information',
    sectionOrder: 2,
    field: {
      systemKey: 'passportExpiryDate',
      label: 'Expiry Date',
      fieldType: 'date',
      isRequired: true,
      // M11.11 (BUG B) — Hint kept (informational), but the +6mo
      // minimum is removed. The cross-field guard on
      // plannedArrivalDate (max = $passportExpiryDate) still prevents
      // travel after the passport expires — that's the real
      // correctness check. Hard-blocking on +6mo at the field level
      // turned away too many valid applicants whose destination
      // didn't actually require it.
      helpText: 'Some destinations require 6 months passport validity — check your destination requirements.',
      validationRulesJson: {
        errorMessages: {
          required: 'Expiry date is required',
        },
      },
      sortOrder: 4,
    },
  },

  // ─── Section 3: Travel Details (cross-field) ───
  {
    sectionTitle: 'Travel Details',
    sectionDescription: 'Tell us about your trip',
    sectionOrder: 3,
    field: {
      systemKey: 'plannedArrivalDate',
      label: 'Planned Arrival Date',
      fieldType: 'date',
      isRequired: true,
      helpText: 'Earliest date you can arrive at destination',
      validationRulesJson: {
        // `$bindingMinArrivalDays` resolves at validation time to
        // `today + binding.processingDays` (per-nationality, set on
        // the bulk-binding admin editor). `$passportExpiryDate` pulls
        // from the form payload by systemKey.
        min: '$bindingMinArrivalDays',
        max: '$passportExpiryDate',
        errorMessages: {
          required: 'Arrival date is required',
          min: 'Arrival date must be at least {bindingMinArrivalDays} days from today',
          max: 'Arrival date cannot be after your passport expires',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Travel Details',
    sectionOrder: 3,
    field: {
      systemKey: 'plannedDepartureDate',
      label: 'Planned Departure Date',
      fieldType: 'date',
      isRequired: true,
      validationRulesJson: {
        min: '$plannedArrivalDate+1day',
        max: '$passportExpiryDate',
        errorMessages: {
          required: 'Departure date is required',
          min: 'Departure date must be after arrival date',
          max: 'Departure date cannot be after your passport expires',
        },
      },
      sortOrder: 2,
    },
  },

  // ─── Section 4: Contact Information ───
  // M11.13 (BUG Y) — these used to live as a HARDCODED block in the
  // legacy /apply form (ApplicantSection.tsx) so admins couldn't
  // control them from the template editor. Promoted to system fields
  // so the editor (which already renders isSystem fields with the
  // 🔒 indicator) gives admins reorder + label + visibility control,
  // and the dynamic form renders them from the same template the
  // editor sees. The legacy ApplicantSection is no longer the
  // default path on /apply (flipped in the same sprint).
  {
    sectionTitle: 'Contact Information',
    sectionDescription:
      'How we should reach you about your application',
    sectionOrder: 4,
    field: {
      systemKey: 'contactEmail',
      label: 'Email',
      fieldType: 'email',
      placeholder: 'you@example.com',
      helpText: 'We send application updates to this address',
      isRequired: true,
      validationRulesJson: {
        errorMessages: {
          required: 'Email is required',
          pattern: 'Enter a valid email address',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Contact Information',
    sectionOrder: 4,
    field: {
      systemKey: 'contactPhone',
      label: 'Phone',
      fieldType: 'phone',
      placeholder: '+994 50 123 45 67',
      helpText: 'Optional — used if we need to reach you urgently',
      isRequired: false,
      validationRulesJson: {
        errorMessages: {
          pattern: 'Enter a valid phone number',
        },
      },
      sortOrder: 2,
    },
  },

  // ─── Section 5: Documents ───
  // M11.13 (BUG Y) — passport photo upload, previously hardcoded in
  // the legacy applicant form. accept/maxSizeMb are read by the
  // dynamic renderer's `file` case (DynamicFieldRenderer.tsx).
  {
    sectionTitle: 'Documents',
    sectionDescription: 'Upload the documents we need to process your application',
    sectionOrder: 5,
    field: {
      systemKey: 'passportPhoto',
      label: 'Passport bio page',
      fieldType: 'file',
      helpText:
        'Clear scan/photo of the page with your photo + passport number. PDF or image.',
      isRequired: true,
      validationRulesJson: {
        // Array form: the admin FieldEditorModal stores `accept` as
        // an array (`['pdf', 'jpg', ...]`); the public dynamic
        // renderer tolerates both forms. Storing as array means the
        // admin editor's `accept?.join(',')` rendering doesn't crash
        // when first opening a backfilled template.
        accept: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeMb: 10,
        errorMessages: {
          required: 'Passport bio page is required',
        },
      },
      sortOrder: 1,
    },
  },
];

export const SYSTEM_FIELD_KEYS: string[] = SYSTEM_DEFAULT_FIELDS.map(
  (s) => s.field.systemKey,
);
