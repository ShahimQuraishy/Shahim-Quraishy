import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, fallback?: string): string => {
  if (value) return value;
  if (fallback) return fallback;
  throw new Error('Missing required environment variable.');
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required(process.env.DATABASE_URL, '******localhost:5432/senior_assistant'),
  apiUpdateKey: required(process.env.API_UPDATE_KEY, 'change-me'),
  retentionDays: Number(process.env.RETENTION_DAYS ?? 365)
};
