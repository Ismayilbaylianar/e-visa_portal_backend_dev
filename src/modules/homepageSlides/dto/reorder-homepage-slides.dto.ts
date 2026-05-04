import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class HomepageSlideReorderItem {
  @ApiProperty()
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class ReorderHomepageSlidesDto {
  @ApiProperty({ type: [HomepageSlideReorderItem] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => HomepageSlideReorderItem)
  items: HomepageSlideReorderItem[];
}
