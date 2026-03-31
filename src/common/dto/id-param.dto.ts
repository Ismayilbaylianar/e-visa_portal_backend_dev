import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class IdParamDto {
  @ApiProperty({
    description: 'Resource UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;
}

export class UserIdParamDto {
  @ApiProperty({
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;
}

export class RoleIdParamDto {
  @ApiProperty({
    description: 'Role UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  roleId: string;
}

export class CountryIdParamDto {
  @ApiProperty({
    description: 'Country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  countryId: string;
}

export class ApplicationIdParamDto {
  @ApiProperty({
    description: 'Application UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  applicationId: string;
}

export class ApplicantIdParamDto {
  @ApiProperty({
    description: 'Applicant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  applicantId: string;
}

export class TemplateIdParamDto {
  @ApiProperty({
    description: 'Template UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  templateId: string;
}

export class SectionIdParamDto {
  @ApiProperty({
    description: 'Section UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sectionId: string;
}

export class FieldIdParamDto {
  @ApiProperty({
    description: 'Field UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  fieldId: string;
}

export class BindingIdParamDto {
  @ApiProperty({
    description: 'Binding UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  bindingId: string;
}

export class FeeIdParamDto {
  @ApiProperty({
    description: 'Fee UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  feeId: string;
}

export class PaymentIdParamDto {
  @ApiProperty({
    description: 'Payment UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  paymentId: string;
}

export class DocumentIdParamDto {
  @ApiProperty({
    description: 'Document UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  documentId: string;
}

export class SessionIdParamDto {
  @ApiProperty({
    description: 'Session UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sessionId: string;
}

export class VisaTypeIdParamDto {
  @ApiProperty({
    description: 'Visa Type UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  visaTypeId: string;
}

export class JobIdParamDto {
  @ApiProperty({
    description: 'Job UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  jobId: string;
}

export class AuditLogIdParamDto {
  @ApiProperty({
    description: 'Audit Log UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  auditLogId: string;
}
