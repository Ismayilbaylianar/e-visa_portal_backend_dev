import { PartialType } from '@nestjs/swagger';
import { CreateTemplateFieldDto } from './create-template-field.dto';

export class UpdateTemplateFieldDto extends PartialType(CreateTemplateFieldDto) {}
