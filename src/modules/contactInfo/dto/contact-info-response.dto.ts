import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Free-form social-link map. The fields below are conventional but
 *  the JSON column accepts any keys, so future channels add without a
 *  schema change. */
export class ContactSocialLinksDto {
  @ApiPropertyOptional({ example: 'https://facebook.com/evisaglobal' })
  facebook?: string;
  @ApiPropertyOptional({ example: 'https://twitter.com/evisaglobal' })
  twitter?: string;
  @ApiPropertyOptional({ example: 'https://instagram.com/evisaglobal' })
  instagram?: string;
  @ApiPropertyOptional({ example: 'https://linkedin.com/company/evisaglobal' })
  linkedin?: string;
}

export class ContactInfoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  whatsapp?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional()
  businessHours?: string;

  @ApiPropertyOptional()
  supportHours?: string;

  @ApiPropertyOptional({ type: ContactSocialLinksDto })
  socialLinks?: ContactSocialLinksDto;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  updatedByUserId?: string;
}
