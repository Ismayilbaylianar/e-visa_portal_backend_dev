import { registerAs } from '@nestjs/config';

export const dbConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));
