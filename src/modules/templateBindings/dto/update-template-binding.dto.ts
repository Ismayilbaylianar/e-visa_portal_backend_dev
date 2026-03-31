import { PartialType } from '@nestjs/swagger';
import { CreateTemplateBindingDto } from './create-template-binding.dto';

export class UpdateTemplateBindingDto extends PartialType(CreateTemplateBindingDto) {}
