import { PartialType } from '@nestjs/swagger';
import { CreateTemplateSectionDto } from './create-template-section.dto';

export class UpdateTemplateSectionDto extends PartialType(CreateTemplateSectionDto) {}
