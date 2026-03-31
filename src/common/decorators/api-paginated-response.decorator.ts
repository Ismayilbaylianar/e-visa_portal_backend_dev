import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto, ApiResponseMetaDto } from '../dto';

/**
 * Swagger decorator for paginated responses
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto, ApiResponseMetaDto),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                allOf: [
                  { $ref: getSchemaPath(ApiResponseMetaDto) },
                  {
                    properties: {
                      pagination: { $ref: getSchemaPath(PaginationMetaDto) },
                    },
                  },
                ],
              },
              error: { type: 'null', example: null },
            },
          },
        ],
      },
    }),
  );
};
