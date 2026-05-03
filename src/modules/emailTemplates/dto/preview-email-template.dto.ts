import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/**
 * Module 8 — Master Data Management Pack.
 *
 * Body for POST /admin/emailTemplates/:templateId/preview. Variables
 * map is optional because admins commonly want to see the raw template
 * (with `{{placeholders}}` left in) on first open. When variables are
 * provided we forward them through EmailTemplateService.renderWithValidation
 * unchanged so behavior matches actual production sends.
 */
export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description:
      'Variables to substitute into the template. Keys must match the placeholders used in subject/bodyHtml/bodyText. Missing required variables for a system template will return success=false plus a missingVariables list.',
    example: {
      otpCode: '123456',
      expiryMinutes: 5,
      applicationRef: 'APP-2026-0001',
      status: 'APPROVED',
    },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string | number | boolean>;
}

/**
 * Response DTO mirrors EmailTemplateService.TemplateRenderResult so the
 * frontend can render either the iframe (when success) or a missing-vars
 * warning (when missingVariables is present). `requiredVariables` is
 * always returned so the editor can show the variable chip list even
 * before the admin has filled anything in.
 */
export class PreviewEmailTemplateResponseDto {
  @ApiProperty({ description: 'Whether rendering succeeded', example: true })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'Rendered template (only present when success=true)',
    example: {
      subject: 'Your verification code',
      html: '<p>Your code is 123456</p>',
      text: 'Your code is 123456',
    },
  })
  rendered?: {
    subject: string;
    html: string;
    text?: string;
  };

  @ApiPropertyOptional({
    description: 'Human-readable error message when success=false',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Names of required variables not provided in the request',
    type: [String],
  })
  missingVariables?: string[];

  @ApiProperty({
    description:
      'Required variable names declared by the template (empty for free-form templates without a registered variable schema).',
    type: [String],
    example: ['otpCode', 'expiryMinutes'],
  })
  requiredVariables!: string[];
}
