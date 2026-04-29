import { registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE || 'Visa Portal Backend API',
  description: process.env.SWAGGER_DESCRIPTION || 'Visa Portal Backend API Documentation',
  version: process.env.SWAGGER_VERSION || '1.0.0',
}));
