import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum EntityType {
  APPLICATION = 'application',
  APPLICANT = 'applicant',
  PAYMENT = 'payment',
}

export class GetTransitionsQueryDto {
  @ApiProperty({
    description: 'Entity type to get transitions for',
    enum: EntityType,
    example: 'applicant',
  })
  @IsNotEmpty()
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({
    description: 'Current status to get allowed transitions from',
    example: 'SUBMITTED',
  })
  @IsNotEmpty()
  @IsString()
  currentStatus: string;
}

export class TransitionsResponseDto {
  @ApiProperty({
    description: 'Entity type',
    enum: EntityType,
    example: 'applicant',
  })
  entityType: EntityType;

  @ApiProperty({
    description: 'Current status',
    example: 'SUBMITTED',
  })
  currentStatus: string;

  @ApiProperty({
    description: 'List of allowed status transitions from current status',
    example: ['IN_REVIEW', 'REJECTED', 'NEED_DOCS'],
    type: [String],
  })
  allowedTransitions: string[];
}
